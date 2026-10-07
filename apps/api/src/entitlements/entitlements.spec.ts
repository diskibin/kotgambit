import {
  ApiErrorSchema,
  AuthResponseSchema,
  CatalogResponseSchema,
  EntitlementsSchema,
  GameReviewSchema,
  ReviewStatusSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import { grantPremium } from '../../test/premium.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import {
  EntitlementsService,
  FREE_ANALYSES_PER_DAY,
  FREE_PUZZLES_PER_DAY,
} from './entitlements.service.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

const moment = (ply: number, kind: 'blunder' | 'mistake' | 'highlight') => ({
  ply,
  moveNumber: Math.ceil(ply / 2),
  color: 'w' as const,
  kind,
  played: { uci: 'f2f3', san: 'f3' },
  better: kind === 'highlight' ? null : { uci: 'e2e4', san: 'e4' },
  fen: START,
  explanation: 'Объяснение.',
});
const mistake = (ply: number) => ({
  ply,
  fen: START,
  color: 'w' as const,
  played: { uci: 'f2f3', san: 'f3' },
  better: { uci: 'e2e4', san: 'e4' },
});
const REVIEW = GameReviewSchema.parse({
  accuracy: { player: 40, bot: 95 },
  counts: { best: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 1 },
  chances: [50, 40, 40, 5, 0],
  qualities: ['mistake', 'best', 'blunder', 'best'],
  keyMoments: [moment(1, 'mistake'), moment(3, 'blunder'), moment(4, 'highlight')],
  mistakes: [mistake(1), mistake(3)],
});

describe('entitlements', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let entitlements: EntitlementsService;
  let token: string;
  let userId: string;

  // CI sets the path of a real engine for the whole run, and this spec relies on there being none
  const previousPath = process.env.ENGINE_PATH;

  beforeAll(async () => {
    delete process.env.ENGINE_PATH;
    ({ app, prisma, redis, mail } = await createTestApp());
    entitlements = app.get(EntitlementsService);
  });

  afterAll(async () => {
    await app.close();
    if (previousPath !== undefined) process.env.ENGINE_PATH = previousPath;
  });

  async function register(email: string): Promise<{ token: string; id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'long-enough-password' },
    });
    // The verification email goes out after the answer, let it finish before the next test cleans up
    const sent = mail.outbox.length;
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(sent));
    const body = AuthResponseSchema.parse(res.json());
    return { token: body.accessToken, id: body.user.id };
  }

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.lesson.deleteMany();
    await prisma.puzzle.deleteMany();
    await prisma.user.deleteMany();
    mail.clear();
    ({ token, id: userId } = await register('cat@example.com'));
  });

  const call = (method: 'GET' | 'POST', url: string, body?: unknown, as = token) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${as}` },
      ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    });
  const errorCode = (res: { json(): unknown }) => ApiErrorSchema.parse(res.json()).code;
  const mine = async () => EntitlementsSchema.parse((await call('GET', '/entitlements')).json());

  describe('what a free learner has', () => {
    it('shows the limits and what is left of them', async () => {
      expect(await mine()).toEqual({
        premium: false,
        puzzles: { limit: FREE_PUZZLES_PER_DAY, left: FREE_PUZZLES_PER_DAY },
        analysis: { limit: FREE_ANALYSES_PER_DAY, left: FREE_ANALYSES_PER_DAY },
        fullReview: false,
        cards: false,
      });
    });

    it('shows no limits for Premium', async () => {
      await grantPremium(prisma, userId);
      expect(await mine()).toEqual({
        premium: true,
        puzzles: { limit: null, left: null },
        analysis: { limit: null, left: null },
        fullReview: true,
        cards: true,
      });
    });

    it('needs a signed-in user', async () => {
      expect((await app.inject({ method: 'GET', url: '/entitlements' })).statusCode).toBe(401);
    });
  });

  describe('puzzles', () => {
    async function startedToday(count: number) {
      // One puzzle is worn out by the attempts, the other is new
      await prisma.puzzle.createMany({
        data: ['p1', 'p2'].map((id) => ({
          id,
          fen: START,
          moves: ['e2e4', 'e7e5'],
          rating: 1000,
          ratingDeviation: 50,
          popularity: 90,
          plays: 1000,
          themes: ['fork'],
          openingTags: [],
        })),
      });
      await prisma.puzzleAttempt.createMany({
        data: Array.from({ length: count }, () => ({
          userId,
          puzzleId: 'p1',
          status: 'abandoned' as const,
          ratingBefore: 1000,
        })),
      });
    }

    it('turns the eleventh puzzle of the day away with a word about Premium', async () => {
      await startedToday(FREE_PUZZLES_PER_DAY);
      expect((await mine()).puzzles.left).toBe(0);
      const res = await call('POST', '/puzzles/next', {});
      expect(res.statusCode).toBe(403);
      expect(errorCode(res)).toBe('puzzle.limit');
      expect(ApiErrorSchema.parse(res.json()).message).toBe(
        'На сегодня задачи закончились. Завтра будут новые.',
      );
    });

    it('still gives a puzzle while there are some left', async () => {
      await startedToday(FREE_PUZZLES_PER_DAY - 1);
      expect((await mine()).puzzles.left).toBe(1);
      expect((await call('POST', '/puzzles/next', {})).statusCode).toBe(200);
    });

    it('does not count the puzzles of another day', async () => {
      await startedToday(FREE_PUZZLES_PER_DAY);
      await prisma.puzzleAttempt.updateMany({
        data: { startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      });
      expect((await mine()).puzzles.left).toBe(FREE_PUZZLES_PER_DAY);
    });

    it('has no limit for Premium', async () => {
      await startedToday(FREE_PUZZLES_PER_DAY + 5);
      await grantPremium(prisma, userId);
      expect((await call('POST', '/puzzles/next', {})).statusCode).toBe(200);
    });
  });

  describe('the analysis of a position', () => {
    const analyze = (fen = START) => call('POST', '/analysis/position', { fen });

    it('turns the fourth analysis of the day away', async () => {
      for (let i = 0; i < FREE_ANALYSES_PER_DAY; i += 1) await entitlements.recordAnalysis(userId);
      expect((await mine()).analysis.left).toBe(0);
      const res = await analyze();
      expect(res.statusCode).toBe(403);
      expect(errorCode(res)).toBe('analysis.limit');
    });

    it('does not use up the day on a position that was refused', async () => {
      const res = await analyze('8/8/8/8/8/8/8/4K3 w - - 0 1');
      expect(res.statusCode).toBe(422);
      expect((await mine()).analysis.left).toBe(FREE_ANALYSES_PER_DAY);
    });

    it('has no limit for Premium', async () => {
      for (let i = 0; i < FREE_ANALYSES_PER_DAY; i += 1) await entitlements.recordAnalysis(userId);
      await grantPremium(prisma, userId);
      // Past the limit check: the engine is not set up in this test, which is a 503 and not a 403
      expect((await analyze()).statusCode).toBe(503);
    });
  });

  describe('the review of a game', () => {
    async function reviewedGame() {
      const game = await prisma.game.create({
        data: {
          userId,
          botId: 'alisa',
          userColor: 'w',
          status: 'finished',
          moves: FOOLS_MATE,
          outcome: 'loss',
          endReason: 'checkmate',
          xp: 10,
          finishedAt: new Date(),
        },
      });
      await prisma.gameReview.create({
        data: { gameId: game.id, status: 'done', done: 5, total: 5, result: REVIEW },
      });
      return game;
    }
    const review = async (gameId: string) =>
      ReviewStatusSchema.parse((await call('GET', `/games/${gameId}/review`)).json());

    it('is brief for a free learner: one moment, the worst one, and no mistakes for cards', async () => {
      const game = await reviewedGame();
      const body = await review(game.id);
      expect(body.full).toBe(false);
      expect(body.review?.keyMoments).toHaveLength(1);
      expect(body.review?.keyMoments[0]).toMatchObject({ ply: 3, kind: 'blunder' });
      expect(body.review?.mistakes).toEqual([]);
      // The numbers of the game are the same, only the depth differs
      expect(body.review?.accuracy).toEqual(REVIEW.accuracy);
      expect(body.review?.chances).toEqual(REVIEW.chances);
    });

    it('is full for Premium', async () => {
      const game = await reviewedGame();
      await grantPremium(prisma, userId);
      const body = await review(game.id);
      expect(body.full).toBe(true);
      expect(body.review?.keyMoments).toHaveLength(3);
      expect(body.review?.mistakes).toHaveLength(2);
    });
  });

  describe('the repetition of mistakes', () => {
    it('is for Premium: a free learner is told so', async () => {
      for (const [method, url] of [
        ['POST', '/cards/next'],
        ['POST', '/games/5a1c2d3e-8a56-4b52-9d6a-0c1c6e1f7a22/review/cards'],
        ['POST', '/cards/5a1c2d3e-8a56-4b52-9d6a-0c1c6e1f7a22/answer'],
      ] as const) {
        const res = await call(method, url, url.includes('answer') ? { move: 'e2e4' } : undefined);
        expect(res.statusCode, url).toBe(403);
        expect(errorCode(res)).toBe('premium.required');
      }
    });
  });

  describe('the chapters', () => {
    const chapter = (id: string, order: number, access: 'free' | 'premium') =>
      prisma.lesson.create({
        data: {
          id,
          track: 'openings',
          order,
          access,
          piece: 'p',
          title: id,
          summary: 'Глава',
          minutes: 5,
          steps: [{ type: 'text' }],
          contentHash: id,
        },
      });
    const status = async (id: string) => {
      const { lessons } = CatalogResponseSchema.parse((await call('GET', '/lessons')).json());
      return lessons.find((lesson) => lesson.id === id)?.status;
    };

    it('shows a chapter of Premium as closed for a free learner and as open for a subscriber', async () => {
      await chapter('free-one', 1, 'free');
      await chapter('paid-one', 2, 'premium');
      expect(await status('paid-one')).toBe('premium');
      await grantPremium(prisma, userId);
      // A subscriber walks the track in order like everybody: the paid chapter opens after the free one
      expect(await status('paid-one')).toBe('locked');
      expect(await status('free-one')).toBe('available');
    });
  });
});
