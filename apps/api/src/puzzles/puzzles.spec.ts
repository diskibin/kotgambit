import {
  ApiErrorSchema,
  AuthResponseSchema,
  DailyPuzzleSchema,
  PuzzleGiveUpResponseSchema,
  PuzzleHintResponseSchema,
  PuzzleMoveResponseSchema,
  PuzzleSchema,
  PuzzleStatsSchema,
  PuzzleThemeListSchema,
  type Puzzle,
  type PuzzleMoveResponse,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { dayKeyOf } from '../progress/streak.js';
import type { RedisService } from '../redis/redis.service.js';
import { selectPuzzles, writePuzzles } from '../seed/puzzle-import.js';
import { DEFAULT_SELECTION } from '../seed/puzzle-selection.js';

// Real rows of the Lichess database, all six are used here
const SAMPLE = fileURLToPath(
  new URL('../../test/fixtures/lichess-puzzles-sample.csv', import.meta.url),
);
const EVERYTHING = {
  ...DEFAULT_SELECTION,
  minPopularity: -100,
  minPlays: 0,
  maxRatingDeviation: 1000,
};

const MATE_IN_ONE = '00Qqp'; // rating 1592, the only one with the theme mateIn1
const MATE_IN_TWO = '005Bm'; // rating 1434, themes endgame mate mateIn2 pin short
const A_LEGAL_MOVE_THAT_IS_NOT_THE_LINE = 'a2a3'; // in the mate in two, after the opponent's first move

describe('puzzles', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let token: string;
  const today = () => dayKeyOf(new Date());

  beforeAll(async () => {
    ({ app, prisma, redis, mail } = await createTestApp());
    await prisma.puzzle.deleteMany();
    await writePuzzles(prisma, (await selectPuzzles(SAMPLE, EVERYTHING)).rows);
  });

  afterAll(async () => {
    await prisma.puzzle.deleteMany();
    await app.close();
  });

  async function register(email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'long-enough-password' },
    });
    // The verification email goes out after the answer, let it finish before the next test cleans up
    const sent = mail.outbox.length;
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(sent));
    return AuthResponseSchema.parse(res.json()).accessToken;
  }

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.dailyPuzzle.deleteMany();
    await prisma.user.deleteMany();
    mail.clear();
    token = await register('cat@example.com');
  });

  const call = (method: 'GET' | 'POST', url: string, body?: unknown, as = token) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${as}` },
      ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    });

  const next = async (body: Record<string, unknown> = {}, as = token): Promise<Puzzle> => {
    const res = await call('POST', '/puzzles/next', body, as);
    expect(res.statusCode).toBe(200);
    return PuzzleSchema.parse(res.json());
  };

  const move = async (attemptId: string, uci: string, as = token): Promise<PuzzleMoveResponse> => {
    const res = await call('POST', `/puzzles/attempts/${attemptId}/move`, { move: uci }, as);
    expect(res.statusCode, res.body).toBe(200);
    return PuzzleMoveResponseSchema.parse(res.json());
  };

  /** Plays the solver's side of the stored line, the way a learner who knows it would. */
  async function solve(puzzle: Puzzle, as = token): Promise<PuzzleMoveResponse> {
    const line = (await prisma.puzzle.findUniqueOrThrow({ where: { id: puzzle.puzzleId } })).moves;
    let last: PuzzleMoveResponse = { result: 'illegal' };
    for (let index = 1; index < line.length; index += 2) {
      last = await move(puzzle.attemptId, line[index] as string, as);
    }
    return last;
  }

  const stats = async () => PuzzleStatsSchema.parse((await call('GET', '/puzzles/stats')).json());

  it('needs a signed-in user', async () => {
    const res = await app.inject({ method: 'POST', url: '/puzzles/next', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  describe('getting a puzzle', () => {
    it('gives a puzzle near the rating without its solution or its themes', async () => {
      const res = await call('POST', '/puzzles/next', {});
      const puzzle = PuzzleSchema.parse(res.json());
      expect(puzzle.themes).toEqual([]);
      expect(Object.keys(res.json() as object).sort()).toEqual([
        'attemptId',
        'fen',
        'lastMove',
        'puzzleId',
        'rating',
        'solver',
        'themes',
      ]);
      expect(res.body).not.toContain('"moves"');
    });

    it('shows the position after the opponent move and who solves it', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn2' });
      expect(puzzle).toMatchObject({
        puzzleId: MATE_IN_TWO,
        lastMove: 'c7f7',
        solver: 'w',
        rating: 1434,
      });
      expect(puzzle.fen).toContain(' w ');
    });

    it('shows the theme only when the learner picked it', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn1' });
      expect(puzzle.puzzleId).toBe(MATE_IN_ONE);
      expect(puzzle.themes).toEqual([{ key: 'mateIn1', title: 'Мат в 1 ход' }]);
    });

    it('answers 404 when no puzzle fits, with a calm message', async () => {
      const res = await call('POST', '/puzzles/next', { mode: 'theme', theme: 'zugzwang' });
      expect(res.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('puzzle.none');
    });

    it('rejects an unknown theme and a theme mode without a theme', async () => {
      expect(
        (await call('POST', '/puzzles/next', { mode: 'theme', theme: 'nope' })).statusCode,
      ).toBe(404);
      expect((await call('POST', '/puzzles/next', { mode: 'theme' })).statusCode).toBe(400);
    });

    it('does not repeat a puzzle the learner has already had', async () => {
      const seen = new Set<string>();
      for (let i = 0; i < 6; i += 1) seen.add((await next()).puzzleId);
      expect(seen.size).toBe(6);
      expect((await call('POST', '/puzzles/next', {})).statusCode).toBe(404);
    });

    it('leaves an unfinished puzzle behind as skipped when the next one is asked for', async () => {
      const first = await next();
      await next();
      const res = await call('POST', `/puzzles/attempts/${first.attemptId}/move`, { move: 'a1a8' });
      expect(res.statusCode).toBe(409);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('puzzle.finished');
      expect(
        (await prisma.puzzleAttempt.findUniqueOrThrow({ where: { id: first.attemptId } })).status,
      ).toBe('abandoned');
    });
  });

  describe('solving', () => {
    it('solves a mate in one, raises the rating and starts a streak', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn1' });
      const result = await solve(puzzle);

      expect(result).toMatchObject({
        result: 'correct',
        solved: true,
        reply: null,
        summary: { status: 'solved', rated: true, ratingBefore: 1000, streak: 1 },
      });
      const summary = result.result === 'correct' ? result.summary : null;
      expect(summary?.ratingAfter).toBeGreaterThan(1000);
      expect(summary?.themes.map((theme) => theme.title)).toEqual(
        expect.arrayContaining(['Мат в 1 ход', 'Эндшпиль', 'Ладейный эндшпиль']),
      );
      expect(await stats()).toMatchObject({ rating: summary?.ratingAfter, solved: 1, streak: 1 });
    });

    it('plays the replies of the opponent along a longer line', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn2' });
      const first = await move(puzzle.attemptId, 'h4g6');
      expect(first).toEqual({ result: 'correct', reply: 'f8g8', solved: false, summary: null });
      const second = await move(puzzle.attemptId, 'f6h8');
      expect(second).toMatchObject({ result: 'correct', solved: true, reply: null });
    });

    it('adds XP and a little time to the day', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn1' });
      await solve(puzzle);
      const day = await prisma.dailyActivity.findFirstOrThrow({ where: {} });
      expect(day.xp).toBe(5);
      expect(day.seconds).toBeLessThanOrEqual(90);
      expect(dayKeyOf(day.day)).toBe(today());
    });

    it('does not count an illegal move and lets the learner go on', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn1' });
      expect(await move(puzzle.attemptId, 'a1a8')).toEqual({ result: 'illegal' });
      expect(await solve(puzzle)).toMatchObject({ solved: true, summary: { status: 'solved' } });
    });

    it('settles the rating on the first mistake and breaks the streak', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn2' });
      const wrong = await move(puzzle.attemptId, A_LEGAL_MOVE_THAT_IS_NOT_THE_LINE);
      expect(wrong).toMatchObject({
        result: 'wrong',
        mistakes: 1,
        summary: { status: 'failed', rated: true, ratingBefore: 1000, streak: 0 },
      });
      const summary = wrong.result === 'wrong' ? wrong.summary : null;
      expect(summary?.ratingAfter).toBeLessThan(1000);
      expect(await stats()).toMatchObject({ failed: 1, solved: 0, streak: 0 });

      // A second mistake counts but does not touch the rating again
      expect(await move(puzzle.attemptId, A_LEGAL_MOVE_THAT_IS_NOT_THE_LINE)).toMatchObject({
        result: 'wrong',
        mistakes: 2,
        summary: null,
      });
      expect((await stats()).rating).toBe(summary?.ratingAfter);
    });

    it('lets the learner finish the line after a mistake without changing the rating again', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn2' });
      await move(puzzle.attemptId, A_LEGAL_MOVE_THAT_IS_NOT_THE_LINE);
      const afterMistake = await stats();
      expect(await solve(puzzle)).toMatchObject({ result: 'correct', solved: true, summary: null });
      expect(await stats()).toEqual(afterMistake);
      const attempt = await prisma.puzzleAttempt.findUniqueOrThrow({
        where: { id: puzzle.attemptId },
      });
      expect(attempt).toMatchObject({ status: 'failed', mistakes: 1 });
      expect(attempt.solvedAt).not.toBeNull();
    });

    it('accepts no more moves once the puzzle is solved', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn1' });
      await solve(puzzle);
      const res = await call('POST', `/puzzles/attempts/${puzzle.attemptId}/move`, {
        move: 'a1a8',
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('hints', () => {
    it('gives the piece, then the idea, then the move', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn2' });
      const hint = async () =>
        PuzzleHintResponseSchema.parse(
          (await call('POST', `/puzzles/attempts/${puzzle.attemptId}/hint`)).json(),
        );

      expect(await hint()).toEqual({ level: 1, square: 'h4' });
      const idea = await hint();
      expect(idea).toMatchObject({ level: 2 });
      // The meta themes (short, long, master...) are not shown
      expect(idea.level === 2 && idea.themes.map((theme) => theme.key)).toEqual([
        'endgame',
        'mate',
        'mateIn2',
        'pin',
      ]);
      expect(await hint()).toMatchObject({
        level: 3,
        move: 'h4g6',
        summary: { status: 'failed', rated: true },
      });
      // Asking again repeats the last level and counts nothing more
      expect(await hint()).toMatchObject({ level: 3, summary: null });
      expect(await stats()).toMatchObject({ failed: 1 });
    });

    it('counts a solve with a hint of the first two levels as half a point and keeps the streak', async () => {
      const first = await next({ mode: 'theme', theme: 'mateIn1' });
      await solve(first);
      const before = await stats();
      expect(before.streak).toBe(1);

      const second = await next({ mode: 'theme', theme: 'mateIn2' });
      await call('POST', `/puzzles/attempts/${second.attemptId}/hint`);
      const result = await solve(second);
      expect(result).toMatchObject({ solved: true, summary: { status: 'solved', streak: 1 } });
      expect((await stats()).streak).toBe(1);
    });

    it('starts the chain of hints again after every move of the line', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn2' });
      const hint = async () =>
        PuzzleHintResponseSchema.parse(
          (await call('POST', `/puzzles/attempts/${puzzle.attemptId}/hint`)).json(),
        );

      expect(await hint()).toEqual({ level: 1, square: 'h4' });
      expect(await hint()).toMatchObject({ level: 2 });
      await move(puzzle.attemptId, 'h4g6');
      // The second move of the line is the queen's, and the piece comes first again
      expect(await hint()).toEqual({ level: 1, square: 'f6' });

      // The rating still remembers the highest level: a hint of level two means half a point
      const result = await move(puzzle.attemptId, 'f6h8');
      expect(result).toMatchObject({ solved: true, summary: { status: 'solved' } });
      const attempt = await prisma.puzzleAttempt.findUniqueOrThrow({
        where: { id: puzzle.attemptId },
      });
      expect(attempt.hintLevel).toBe(2);
    });

    it('does not give a hint for a puzzle that is over', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn1' });
      await solve(puzzle);
      const res = await call('POST', `/puzzles/attempts/${puzzle.attemptId}/hint`);
      expect(res.statusCode).toBe(409);
    });
  });

  describe('giving up', () => {
    it('shows the rest of the line, counts a miss, and closes the attempt', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn2' });
      await move(puzzle.attemptId, 'h4g6');
      const res = await call('POST', `/puzzles/attempts/${puzzle.attemptId}/give-up`);
      const body = PuzzleGiveUpResponseSchema.parse(res.json());

      // The reply to the first move was already shown, so only the last move is left
      expect(body.solution).toEqual(['f6h8']);
      expect(body.summary).toMatchObject({ status: 'failed' });
      expect(
        (await call('POST', `/puzzles/attempts/${puzzle.attemptId}/move`, { move: 'f6h8' }))
          .statusCode,
      ).toBe(409);
    });
  });

  describe('giving up at the start', () => {
    it('shows the whole line from the first move of the learner', async () => {
      const puzzle = await next({ mode: 'theme', theme: 'mateIn2' });
      const res = await call('POST', `/puzzles/attempts/${puzzle.attemptId}/give-up`);
      expect(PuzzleGiveUpResponseSchema.parse(res.json()).solution).toEqual([
        'h4g6',
        'f8g8',
        'f6h8',
      ]);
    });
  });

  describe('repeating', () => {
    it('brings back a failed puzzle in the review mode and does not rate the repeat', async () => {
      const failed = await next({ mode: 'theme', theme: 'mateIn2' });
      await move(failed.attemptId, A_LEGAL_MOVE_THAT_IS_NOT_THE_LINE);
      const afterFail = await stats();

      const again = await next({ mode: 'review' });
      expect(again.puzzleId).toBe(MATE_IN_TWO);
      expect(await solve(again)).toMatchObject({
        solved: true,
        summary: {
          status: 'solved',
          rated: false,
          ratingBefore: afterFail.rating,
          ratingAfter: afterFail.rating,
        },
      });
      expect(await stats()).toEqual(afterFail);
      // Solved now, so it is no longer something to review
      expect((await call('POST', '/puzzles/next', { mode: 'review' })).statusCode).toBe(404);
    });

    it('has nothing to review for a learner who has not failed anything', async () => {
      const res = await call('POST', '/puzzles/next', { mode: 'review' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('puzzle of the day', () => {
    it('is the same for every learner and stays the same all day', async () => {
      const other = await register('dog@example.com');
      const mine = await next({ mode: 'daily', localDate: today() });
      const theirs = await next({ mode: 'daily', localDate: today() }, other);
      expect(theirs.puzzleId).toBe(mine.puzzleId);
      expect((await next({ mode: 'daily', localDate: today() })).puzzleId).toBe(mine.puzzleId);
    });

    it('moves the rating only the first time it is solved', async () => {
      const first = await next({ mode: 'daily', localDate: today() });
      const solved = await solve(first);
      expect(solved).toMatchObject({ summary: { rated: true } });
      const afterFirst = await stats();

      const second = await next({ mode: 'daily', localDate: today() });
      expect(await solve(second)).toMatchObject({ summary: { rated: false } });
      expect(await stats()).toEqual(afterFirst);
    });

    it('rejects a day far from the date of the server', async () => {
      const res = await call('POST', '/puzzles/next', { mode: 'daily', localDate: '2001-01-01' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('lists', () => {
    it('lists the themes a learner can practise with their counts, without the meta themes', async () => {
      const list = PuzzleThemeListSchema.parse((await call('GET', '/puzzles/themes')).json());
      const keys = list.themes.map((theme) => theme.key);
      expect(keys).toContain('mateIn1');
      expect(keys).not.toContain('short');
      expect(keys).not.toContain('long');
      expect(list.themes.find((theme) => theme.key === 'mate')).toMatchObject({
        title: 'Мат',
        count: 3,
        solved: 0,
      });
    });

    it('counts the puzzles the learner has solved in every theme', async () => {
      await solve(await next({ mode: 'theme', theme: 'mateIn1' }));
      const list = PuzzleThemeListSchema.parse((await call('GET', '/puzzles/themes')).json());
      const solved = Object.fromEntries(list.themes.map((theme) => [theme.key, theme.solved]));
      // The mate in one is also an endgame, a rook endgame and a mate
      expect(solved).toMatchObject({ mateIn1: 1, mate: 1, endgame: 1, rookEndgame: 1, mateIn2: 0 });
    });

    it('shows the puzzle of the day without starting an attempt, and says when it is solved', async () => {
      const preview = DailyPuzzleSchema.parse(
        (await call('GET', `/puzzles/daily?localDate=${today()}`)).json(),
      );
      expect(preview).toMatchObject({ solved: false, solver: expect.stringMatching(/^[wb]$/) });
      expect(preview.title).not.toBe('');
      expect(await prisma.puzzleAttempt.count()).toBe(0);

      // It is the one the daily mode then hands out
      const started = await next({ mode: 'daily', localDate: today() });
      expect(started.puzzleId).toBe(preview.puzzleId);
      await solve(started);
      const after = DailyPuzzleSchema.parse(
        (await call('GET', `/puzzles/daily?localDate=${today()}`)).json(),
      );
      expect(after.solved).toBe(true);
    });

    it('names a puzzle by its idea, not by the phase of the game', async () => {
      // 00Qqp has endgame, mate, mateIn1, oneMove, rookEndgame: the idea is the mate in one
      const puzzle = await prisma.puzzle.findUniqueOrThrow({ where: { id: MATE_IN_ONE } });
      expect(puzzle.themes).toContain('mateIn1');
      const day = today();
      const date = new Date(`${day}T00:00:00.000Z`);
      await prisma.dailyPuzzle.create({ data: { day: date, puzzleId: MATE_IN_ONE } });
      const preview = DailyPuzzleSchema.parse(
        (await call('GET', `/puzzles/daily?localDate=${day}`)).json(),
      );
      expect(preview.title).toBe('Мат в 1 ход');
    });

    it('starts the stats at the beginner level', async () => {
      expect(await stats()).toEqual({
        rating: 1000,
        solved: 0,
        failed: 0,
        streak: 0,
        bestStreak: 0,
      });
    });
  });

  describe('other learners', () => {
    it('cannot touch the attempt of somebody else', async () => {
      const other = await register('dog@example.com');
      const puzzle = await next();
      const res = await call(
        'POST',
        `/puzzles/attempts/${puzzle.attemptId}/move`,
        { move: 'a1a8' },
        other,
      );
      expect(res.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('puzzle.attempt_not_found');
    });

    it('keeps the rating of each learner apart', async () => {
      const other = await register('dog@example.com');
      await solve(await next({ mode: 'theme', theme: 'mateIn1' }));
      const theirs = PuzzleStatsSchema.parse(
        (await call('GET', '/puzzles/stats', undefined, other)).json(),
      );
      expect(theirs.rating).toBe(1000);
    });

    it('rejects an attempt id that is not an id', async () => {
      const res = await call('POST', '/puzzles/attempts/nonsense/move', { move: 'a1a8' });
      expect(res.statusCode).toBe(400);
    });
  });
});
