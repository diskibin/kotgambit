import {
  checkPuzzleMove,
  nextSolutionMove,
  remainingSolution,
  startPuzzle,
} from '@kotgambit/chess-core';
import type {
  DailyPuzzle,
  NextPuzzleRequest,
  Puzzle,
  PuzzleGiveUpResponse,
  PuzzleHintResponse,
  PuzzleMoveResponse,
  PuzzleStats,
  PuzzleSummary,
  PuzzleThemeList,
} from '@kotgambit/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import type { Prisma, Puzzle as PuzzleRow, PuzzleAttempt } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { START_RATING, nextRating, outcomeOf, type AttemptOutcome } from './puzzle-rating.js';
import { PuzzleThemesService } from './puzzle-themes.service.js';

const RATING_WINDOW_STEP = 100;
const MAX_RATING_WINDOW = 500;
// The daily puzzle should suit most learners: not too hard and one that people liked
const DAILY_MIN_RATING = 800;
const DAILY_MAX_RATING = 1600;
const DAILY_MIN_POPULARITY = 90;
const MAX_HINT_LEVEL = 3;

type Tx = Prisma.TransactionClient;
type AttemptWithPuzzle = PuzzleAttempt & { puzzle: PuzzleRow };

@Injectable()
export class PuzzlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly themes: PuzzleThemesService,
    private readonly progress: ProgressService,
  ) {}

  async next(userId: string, request: NextPuzzleRequest): Promise<Puzzle> {
    const mode = request.mode ?? 'rating';
    const stats = await this.prisma.userPuzzleStats.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    const puzzle = await this.pick(userId, mode, stats.rating, request);
    if (!puzzle) throw new AppError('puzzle.none', HttpStatus.NOT_FOUND);

    const start = startPuzzle(puzzle.fen, puzzle.moves);
    // The import only keeps puzzles whose line plays through, so this would be a corrupted row
    if (!start) throw new Error(`Puzzle ${puzzle.id} cannot be started`);

    // Only the first run at a puzzle moves the rating, a known solution must not be farmable
    const earlier = await this.prisma.puzzleAttempt.findFirst({
      where: { userId, puzzleId: puzzle.id, rated: true, ratingAfter: { not: null } },
      select: { id: true },
    });
    const attempt = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // A puzzle that is left behind without a move is a skip, one with a mistake stays a failure
      await tx.puzzleAttempt.updateMany({
        where: { userId, closedAt: null, status: 'open' },
        data: { status: 'abandoned', closedAt: now },
      });
      await tx.puzzleAttempt.updateMany({
        where: { userId, closedAt: null },
        data: { closedAt: now },
      });
      return tx.puzzleAttempt.create({
        data: {
          userId,
          puzzleId: puzzle.id,
          rated: earlier === null,
          ratingBefore: Math.round(stats.rating),
        },
      });
    });

    return {
      attemptId: attempt.id,
      puzzleId: puzzle.id,
      fen: start.fen,
      lastMove: start.lastMove,
      solver: start.solver,
      rating: puzzle.rating,
      // In the other modes the theme would give the idea away
      themes: mode === 'theme' && request.theme ? this.themes.labels([request.theme]) : [],
    };
  }

  async move(userId: string, attemptId: string, move: string): Promise<PuzzleMoveResponse> {
    const attempt = await this.openAttempt(userId, attemptId);
    const { puzzle } = attempt;
    const check = checkPuzzleMove(puzzle.fen, puzzle.moves, attempt.playedMoves, move);
    if (check.kind === 'illegal') return { result: 'illegal' };

    return this.prisma.$transaction(async (tx) => {
      // The moves played so far must still be what they were when the attempt was read, so that two
      // moves sent at once cannot both be taken
      const guard = {
        id: attempt.id,
        closedAt: null,
        playedMoves: { equals: attempt.playedMoves },
      };

      if (check.kind === 'wrong') {
        const changed = await tx.puzzleAttempt.updateMany({
          where: guard,
          data: { mistakes: { increment: 1 } },
        });
        if (changed.count === 0) throw new AppError('puzzle.finished', HttpStatus.CONFLICT);
        const summary = attempt.status === 'open' ? await this.settle(tx, attempt, 'failed') : null;
        return { result: 'wrong', mistakes: attempt.mistakes + 1, summary };
      }

      const now = new Date();
      const changed = await tx.puzzleAttempt.updateMany({
        where: guard,
        data: {
          playedMoves: [...attempt.playedMoves, move],
          ...(check.solved ? { solvedAt: now, closedAt: now } : {}),
        },
      });
      if (changed.count === 0) throw new AppError('puzzle.finished', HttpStatus.CONFLICT);

      // After a mistake the rating is already settled, a late solve changes nothing more
      const summary =
        check.solved && attempt.status === 'open'
          ? await this.settle(tx, attempt, outcomeOf(attempt.mistakes, attempt.hintLevel))
          : null;
      return { result: 'correct', reply: check.reply, solved: check.solved, summary };
    });
  }

  async hint(userId: string, attemptId: string): Promise<PuzzleHintResponse> {
    const attempt = await this.openAttempt(userId, attemptId);
    const { puzzle } = attempt;
    const solution = nextSolutionMove(puzzle.fen, puzzle.moves, attempt.playedMoves);
    if (solution === null) throw new AppError('puzzle.finished', HttpStatus.CONFLICT);

    const level = Math.min(MAX_HINT_LEVEL, attempt.hintLevel + 1);
    return this.prisma.$transaction(async (tx) => {
      await tx.puzzleAttempt.update({
        where: { id: attempt.id },
        data: { hintLevel: Math.max(level, attempt.hintLevel) },
      });
      if (level === 1) return { level: 1, square: solution.slice(0, 2) };
      if (level === 2) return { level: 2, themes: this.themes.labels(puzzle.themes) };
      // Being shown the move counts as a miss
      const summary = attempt.status === 'open' ? await this.settle(tx, attempt, 'failed') : null;
      return { level: 3, move: solution, summary };
    });
  }

  async giveUp(userId: string, attemptId: string): Promise<PuzzleGiveUpResponse> {
    const attempt = await this.openAttempt(userId, attemptId);
    const { puzzle } = attempt;
    const solution = remainingSolution(puzzle.fen, puzzle.moves, attempt.playedMoves) ?? [];

    return this.prisma.$transaction(async (tx) => {
      const summary = attempt.status === 'open' ? await this.settle(tx, attempt, 'failed') : null;
      await tx.puzzleAttempt.update({ where: { id: attempt.id }, data: { closedAt: new Date() } });
      return { solution, summary };
    });
  }

  async stats(userId: string): Promise<PuzzleStats> {
    const row = await this.prisma.userPuzzleStats.findUnique({ where: { userId } });
    return {
      rating: Math.round(row?.rating ?? START_RATING),
      solved: row?.solved ?? 0,
      failed: row?.failed ?? 0,
      streak: row?.streak ?? 0,
      bestStreak: row?.bestStreak ?? 0,
    };
  }

  /** The themes a learner can practise, with how many puzzles each has and how many they have solved. */
  async themeList(userId: string): Promise<PuzzleThemeList> {
    const rows = await this.prisma.$queryRaw<{ theme: string; count: number; solved: number }[]>`
      WITH mine AS (
        SELECT DISTINCT puzzle_id FROM puzzle_attempts
        WHERE user_id = ${userId}::uuid AND solved_at IS NOT NULL
      )
      SELECT theme, COUNT(*)::int AS count, COUNT(mine.puzzle_id)::int AS solved
      FROM puzzles p
      CROSS JOIN LATERAL unnest(p.themes) AS theme
      LEFT JOIN mine ON mine.puzzle_id = p.id
      GROUP BY theme`;
    const themes = rows
      .flatMap(({ theme, count, solved }) => {
        const label = this.themes.label(theme);
        return label ? [{ ...label, count, solved }] : [];
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    return { themes };
  }

  /** A look at the puzzle of the day for the catalog. Nothing is started and no attempt is recorded. */
  async dailyPreview(userId: string, localDate: string | undefined): Promise<DailyPuzzle> {
    const puzzle = await this.daily(this.progress.resolveToday(localDate));
    if (!puzzle) throw new AppError('puzzle.none', HttpStatus.NOT_FOUND);
    const start = startPuzzle(puzzle.fen, puzzle.moves);
    if (!start) throw new Error(`Puzzle ${puzzle.id} cannot be started`);
    const solved = await this.prisma.puzzleAttempt.findFirst({
      where: { userId, puzzleId: puzzle.id, solvedAt: { not: null } },
      select: { id: true },
    });
    return {
      puzzleId: puzzle.id,
      fen: start.fen,
      lastMove: start.lastMove,
      solver: start.solver,
      title: this.themes.headline(puzzle.themes)?.title ?? '',
      solved: solved !== null,
    };
  }

  private async openAttempt(userId: string, id: string): Promise<AttemptWithPuzzle> {
    const attempt = await this.prisma.puzzleAttempt.findFirst({
      where: { id, userId },
      include: { puzzle: true },
    });
    if (!attempt) throw new AppError('puzzle.attempt_not_found', HttpStatus.NOT_FOUND);
    if (attempt.closedAt) throw new AppError('puzzle.finished', HttpStatus.CONFLICT);
    return attempt;
  }

  /**
   * Counts the attempt in the learner's rating and stats, once. An attempt at a puzzle the learner has
   * already tried is "unrated": it is recorded but moves nothing.
   */
  private async settle(
    tx: Tx,
    attempt: AttemptWithPuzzle,
    outcome: AttemptOutcome,
  ): Promise<PuzzleSummary> {
    const stats = await tx.userPuzzleStats.upsert({
      where: { userId: attempt.userId },
      create: { userId: attempt.userId },
      update: {},
    });
    const failed = outcome === 'failed';
    let ratingAfter = attempt.ratingBefore;
    let streak = stats.streak;

    if (attempt.rated) {
      const next = nextRating(
        stats.rating,
        attempt.puzzle.rating,
        outcome,
        stats.solved + stats.failed,
      );
      // A solve with a hint keeps the streak but does not add to it
      streak = failed ? 0 : outcome === 'clean' ? stats.streak + 1 : stats.streak;
      await tx.userPuzzleStats.update({
        where: { userId: attempt.userId },
        data: {
          rating: next,
          solved: { increment: failed ? 0 : 1 },
          failed: { increment: failed ? 1 : 0 },
          streak,
          bestStreak: Math.max(stats.bestStreak, streak),
        },
      });
      ratingAfter = Math.round(next);
    }

    await tx.puzzleAttempt.update({
      where: { id: attempt.id },
      data: {
        status: failed ? 'failed' : 'solved',
        ratingAfter: attempt.rated ? ratingAfter : null,
      },
    });
    return {
      status: failed ? 'failed' : 'solved',
      rated: attempt.rated,
      ratingBefore: attempt.ratingBefore,
      ratingAfter,
      themes: this.themes.labels(attempt.puzzle.themes),
      streak,
    };
  }

  private pick(
    userId: string,
    mode: NonNullable<NextPuzzleRequest['mode']>,
    rating: number,
    request: NextPuzzleRequest,
  ): Promise<PuzzleRow | null> {
    const unseen: Prisma.PuzzleWhereInput = { attempts: { none: { userId } } };
    switch (mode) {
      case 'rating':
        return this.nearRating(unseen, rating);
      case 'theme':
        if (!request.theme || !this.themes.label(request.theme)) return Promise.resolve(null);
        return this.nearRating({ ...unseen, themes: { has: request.theme } }, rating);
      case 'review':
        return this.random({
          attempts: {
            some: { userId, status: 'failed', solvedAt: null },
            none: { userId, solvedAt: { not: null } },
          },
        });
      case 'daily':
        return this.daily(this.progress.resolveToday(request.localDate));
    }
  }

  /** A puzzle close to the rating, looking further away until one is found, and anywhere as the last resort. */
  private async nearRating(
    where: Prisma.PuzzleWhereInput,
    rating: number,
  ): Promise<PuzzleRow | null> {
    for (
      let window = RATING_WINDOW_STEP;
      window <= MAX_RATING_WINDOW;
      window += RATING_WINDOW_STEP
    ) {
      const found = await this.random({
        ...where,
        rating: { gte: rating - window, lte: rating + window },
      });
      if (found) return found;
    }
    return this.random(where);
  }

  /** The puzzle of the day is chosen on the first request of the day and kept, so that everybody gets the same one. */
  private async daily(day: string): Promise<PuzzleRow | null> {
    const date = new Date(`${day}T00:00:00.000Z`);
    const existing = await this.prisma.dailyPuzzle.findUnique({
      where: { day: date },
      include: { puzzle: true },
    });
    if (existing) return existing.puzzle;

    const candidate = await this.random({
      rating: { gte: DAILY_MIN_RATING, lte: DAILY_MAX_RATING },
      popularity: { gte: DAILY_MIN_POPULARITY },
    });
    if (!candidate) return null;
    // Two first requests may race, the row that gets in first wins and both read it back
    await this.prisma.dailyPuzzle.createMany({
      data: [{ day: date, puzzleId: candidate.id }],
      skipDuplicates: true,
    });
    const chosen = await this.prisma.dailyPuzzle.findUniqueOrThrow({
      where: { day: date },
      include: { puzzle: true },
    });
    return chosen.puzzle;
  }

  private async random(where: Prisma.PuzzleWhereInput): Promise<PuzzleRow | null> {
    const count = await this.prisma.puzzle.count({ where });
    if (count === 0) return null;
    return this.prisma.puzzle.findFirst({ where, orderBy: { id: 'asc' }, skip: randomInt(count) });
  }
}
