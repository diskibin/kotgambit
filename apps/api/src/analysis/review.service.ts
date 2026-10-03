import { playGame } from '@kotgambit/chess-core';
import { GameReviewSchema, type ReviewStatus } from '@kotgambit/contracts';
import { HttpStatus, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { isEngineFailure } from '../engine/engine-errors.js';
import { Priority } from '../engine/engine-pool.js';
import { EngineService } from '../engine/engine.service.js';
import type { Game as GameRow, GameReview } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { briefReview, buildReview, type PositionEval } from './review.js';

// A little deeper than a hint: the review judges every move of a game, but it is not in a hurry
const REVIEW_DEPTH = 12;
const RETRY_DELAY_MS = 3000;
// About two minutes of a busy engine, after that the review is marked as failed and can be started again
const MAX_RETRIES = 40;

type Side = 'w' | 'b';

/**
 * The review of a finished game: the engine looks at every position at the lowest priority of the
 * queue, one game at a time, and the learner's screen follows the progress. The work survives a restart:
 * unfinished reviews are picked up again when the server starts.
 */
@Injectable()
export class ReviewService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReviewService.name);
  private readonly queue: string[] = [];
  private working = false;
  /** Public so that tests do not wait seconds for a busy engine. */
  retryDelayMs = RETRY_DELAY_MS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const unfinished = await this.prisma.gameReview.findMany({
      where: { status: { in: ['pending', 'running'] } },
      select: { gameId: true },
    });
    for (const { gameId } of unfinished) this.enqueue(gameId);
  }

  /** Starts the review of a finished game, or reports the one that is already there. */
  async start(userId: string, gameId: string): Promise<ReviewStatus> {
    const game = await this.ownedGame(userId, gameId);
    if (game.status !== 'finished') {
      throw new AppError('review.not_ready', HttpStatus.CONFLICT);
    }
    const existing = await this.prisma.gameReview.findUnique({ where: { gameId } });
    if (existing && existing.status !== 'failed') return this.view(existing, userId);

    const review = await this.prisma.gameReview.upsert({
      where: { gameId },
      create: { gameId, total: game.moves.length + 1 },
      update: { status: 'pending', done: 0 },
    });
    this.enqueue(gameId);
    return this.view(review, userId);
  }

  async status(userId: string, gameId: string): Promise<ReviewStatus> {
    await this.ownedGame(userId, gameId);
    const review = await this.prisma.gameReview.findUnique({ where: { gameId } });
    if (!review) throw new AppError('review.not_found', HttpStatus.NOT_FOUND);
    return this.view(review, userId);
  }

  /** Resolves when the queue is empty, for tests. */
  async idle(): Promise<void> {
    while (this.working || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  private enqueue(gameId: string): void {
    if (this.queue.includes(gameId)) return;
    this.queue.push(gameId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.working) return;
    this.working = true;
    try {
      for (let gameId = this.queue.shift(); gameId; gameId = this.queue.shift()) {
        await this.work(gameId);
      }
    } finally {
      this.working = false;
    }
  }

  private async work(gameId: string): Promise<void> {
    try {
      const game = await this.prisma.game.findUnique({ where: { id: gameId } });
      if (!game) return;
      await this.prisma.gameReview.update({ where: { gameId }, data: { status: 'running' } });
      const positions = await this.lookAtPositions(game);
      const moves = (playGame(game.moves)?.moves ?? []).map(({ uci, san }) => ({ uci, san }));
      const review = GameReviewSchema.parse(buildReview(moves, positions, game.userColor as Side));
      await this.prisma.gameReview.update({
        where: { gameId },
        data: { status: 'done', result: review, finishedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `The review of game ${gameId} failed`,
        error instanceof Error ? error.stack : error,
      );
      await this.prisma.gameReview
        .update({ where: { gameId }, data: { status: 'failed' } })
        .catch(() => undefined);
    }
  }

  /** The engine's look at every position of the game, from the start to the last, in order. */
  private async lookAtPositions(game: GameRow): Promise<PositionEval[]> {
    const positions: PositionEval[] = [];
    for (let ply = 0; ply <= game.moves.length; ply += 1) {
      const played = playGame(game.moves.slice(0, ply));
      if (!played) throw new Error(`Game ${game.id} has a move that is not legal`);
      const side = played.fen.split(' ')[1] as Side;
      if (played.status.kind === 'checkmate') {
        positions.push({
          fen: played.fen,
          turn: side,
          score: null,
          bestUci: null,
          ending: 'checkmate',
        });
      } else if (played.status.kind === 'draw') {
        positions.push({ fen: played.fen, turn: side, score: null, bestUci: null, ending: 'draw' });
      } else {
        const analysis = await this.analyzeWithRetries(played.fen);
        positions.push({
          fen: played.fen,
          turn: side,
          score: analysis.lines[0]?.score ?? null,
          bestUci: analysis.bestMove,
          ending: null,
        });
      }
      await this.prisma.gameReview.update({ where: { gameId: game.id }, data: { done: ply + 1 } });
    }
    return positions;
  }

  /** A busy engine is normal for a background job: it waits and asks again instead of failing. */
  private async analyzeWithRetries(fen: string) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.engine.analyze({
          fen,
          depth: REVIEW_DEPTH,
          multipv: 1,
          priority: Priority.Review,
        });
      } catch (error) {
        if (!isEngineFailure(error) || attempt >= MAX_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }
  }

  private async ownedGame(userId: string, gameId: string): Promise<GameRow> {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, userId } });
    if (!game) throw new AppError('game.not_found', HttpStatus.NOT_FOUND);
    return game;
  }

  private async view(review: GameReview, userId: string): Promise<ReviewStatus> {
    // Reviews saved before the list of mistakes existed have none
    const parsed =
      review.result === null
        ? null
        : GameReviewSchema.safeParse({ mistakes: [], ...(review.result as object) });
    const full = await this.entitlements.isPremium(userId);
    return {
      status: review.status,
      done: review.done,
      total: review.total,
      review: parsed?.success ? (full ? parsed.data : briefReview(parsed.data)) : null,
      full,
    };
  }
}
