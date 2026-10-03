import {
  ApiErrorSchema,
  AuthResponseSchema,
  CardAnswerResponseSchema,
  GameReviewSchema,
  MakeCardsResponseSchema,
  NextCardSchema,
  ProfileSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import { grantPremium } from '../../test/premium.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { dayKeyOf } from '../progress/streak.js';
import type { RedisService } from '../redis/redis.service.js';
import { CARD_XP } from './cards.limits.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2';

const REVIEW = GameReviewSchema.parse({
  accuracy: { player: 40, bot: 95 },
  counts: { best: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 1 },
  chances: [50, 40, 40, 5, 0],
  qualities: ['mistake', 'best', 'blunder', 'best'],
  keyMoments: [],
  mistakes: [
    {
      ply: 1,
      fen: START,
      color: 'w',
      played: { uci: 'f2f3', san: 'f3' },
      better: { uci: 'e2e4', san: 'e4' },
    },
    {
      ply: 3,
      fen: AFTER_E5,
      color: 'w',
      played: { uci: 'g2g4', san: 'g4' },
      better: { uci: 'e2e4', san: 'e4' },
    },
  ],
});

describe('review cards', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    ({ app, prisma, redis, mail } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
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
    await prisma.user.deleteMany();
    mail.clear();
    ({ token, id: userId } = await register('cat@example.com'));
    await grantPremium(prisma, userId);
  });

  const call = (method: 'GET' | 'POST', url: string, body?: unknown, as = token) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${as}` },
      ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    });

  async function reviewedGame(owner = userId, done = true) {
    const game = await prisma.game.create({
      data: {
        userId: owner,
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
      data: {
        gameId: game.id,
        status: done ? 'done' : 'running',
        done: 5,
        total: 5,
        ...(done ? { result: REVIEW } : {}),
      },
    });
    return game;
  }

  const make = (gameId: string, as = token) =>
    call('POST', `/games/${gameId}/review/cards`, undefined, as);
  const next = async () => NextCardSchema.parse((await call('POST', '/cards/next')).json());

  it('needs a signed-in user', async () => {
    expect((await app.inject({ method: 'POST', url: '/cards/next' })).statusCode).toBe(401);
  });

  describe('making cards', () => {
    it('waits for the review of the game', async () => {
      const game = await reviewedGame(userId, false);
      const res = await make(game.id);
      expect(res.statusCode).toBe(409);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('review.not_ready');
    });

    it('makes a card of every mistake', async () => {
      const game = await reviewedGame();
      const res = await make(game.id);
      expect(res.statusCode).toBe(200);
      expect(MakeCardsResponseSchema.parse(res.json())).toEqual({
        created: 2,
        summary: { due: 2, total: 2 },
      });
    });

    it('makes no duplicates when asked twice', async () => {
      const game = await reviewedGame();
      await make(game.id);
      expect(MakeCardsResponseSchema.parse((await make(game.id)).json())).toEqual({
        created: 0,
        summary: { due: 2, total: 2 },
      });
    });

    it('keeps games to their owner', async () => {
      const game = await reviewedGame();
      const other = await register('other@example.com');
      await grantPremium(prisma, other.id);
      expect((await make(game.id, other.token)).statusCode).toBe(404);
    });
  });

  describe('repeating', () => {
    it('gives the card that waited longest, without its answer', async () => {
      const game = await reviewedGame();
      await make(game.id);
      const res = await call('POST', '/cards/next');
      const body = NextCardSchema.parse(res.json());
      expect(body.card).toMatchObject({ fen: START, solver: 'w', playedSan: 'f3', moveNumber: 1 });
      expect(res.body).not.toContain('e2e4');
      expect(body.summary).toEqual({ due: 2, total: 2 });
    });

    it('has no card when there is nothing to repeat', async () => {
      expect(await next()).toEqual({ card: null, summary: { due: 0, total: 0 } });
    });

    it('counts a right answer, moves the card away and adds XP to the day', async () => {
      await make((await reviewedGame()).id);
      const card = (await next()).card;
      if (!card) throw new Error('no card');
      const res = await call('POST', `/cards/${card.id}/answer`, { move: 'e2e4' });
      expect(CardAnswerResponseSchema.parse(res.json())).toEqual({
        result: 'correct',
        best: { uci: 'e2e4', san: 'e4' },
        nextInDays: 1,
        summary: { due: 1, total: 2 },
      });
      const day = await prisma.dailyActivity.findFirstOrThrow({ where: { userId } });
      expect(day.xp).toBe(CARD_XP.correct);
      expect(dayKeyOf(day.day)).toBe(dayKeyOf(new Date()));
    });

    it('shows the better move after a wrong answer and brings the card back tomorrow', async () => {
      await make((await reviewedGame()).id);
      const card = (await next()).card;
      if (!card) throw new Error('no card');
      const res = await call('POST', `/cards/${card.id}/answer`, { move: 'a2a3' });
      expect(CardAnswerResponseSchema.parse(res.json())).toMatchObject({
        result: 'wrong',
        best: { san: 'e4' },
        nextInDays: 1,
      });
      const row = await prisma.reviewCard.findUniqueOrThrow({ where: { id: card.id } });
      expect(row).toMatchObject({ lapses: 1, repetitions: 0, intervalDays: 1 });
      expect(row.ease).toBeCloseTo(2.3);
      expect(row.dueAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('grows the gap with right answers', async () => {
      await make((await reviewedGame()).id);
      const card = (await next()).card;
      if (!card) throw new Error('no card');
      await call('POST', `/cards/${card.id}/answer`, { move: 'e2e4' });
      await prisma.reviewCard.update({ where: { id: card.id }, data: { dueAt: new Date() } });
      const second = CardAnswerResponseSchema.parse(
        (await call('POST', `/cards/${card.id}/answer`, { move: 'e2e4' })).json(),
      );
      expect(second).toMatchObject({ result: 'correct', nextInDays: 3 });
    });

    it('does not count a move that is not legal', async () => {
      await make((await reviewedGame()).id);
      const card = (await next()).card;
      if (!card) throw new Error('no card');
      const res = await call('POST', `/cards/${card.id}/answer`, { move: 'e2e5' });
      expect(CardAnswerResponseSchema.parse(res.json())).toEqual({ result: 'illegal' });
      expect(await prisma.dailyActivity.count()).toBe(0);
      expect((await prisma.reviewCard.findUniqueOrThrow({ where: { id: card.id } })).lapses).toBe(
        0,
      );
    });

    it('keeps cards to their owner', async () => {
      await make((await reviewedGame()).id);
      const card = (await next()).card;
      if (!card) throw new Error('no card');
      const other = await register('other@example.com');
      await grantPremium(prisma, other.id);
      const res = await call('POST', `/cards/${card.id}/answer`, { move: 'e2e4' }, other.token);
      expect(res.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('card.not_found');
    });

    it('reports how many cards are due', async () => {
      await make((await reviewedGame()).id);
      const res = await call('GET', '/cards/summary');
      expect(res.json()).toEqual({ due: 2, total: 2 });
    });
  });

  describe('the profile', () => {
    const profile = async () => ProfileSchema.parse((await call('GET', '/profile')).json());

    it('starts at level 1 with nothing reached', async () => {
      const body = await profile();
      expect(body).toMatchObject({
        level: { level: 1, xpInLevel: 0, xpForNext: 100 },
        xpTotal: 0,
        streak: { current: 0, best: 0 },
        puzzles: { rating: 1000, solved: 0 },
        games: { played: 0, wins: 0, draws: 0, losses: 0 },
        cards: { due: 0, total: 0 },
        themes: [],
      });
      expect(body.achievements.every((a) => !a.unlocked)).toBe(true);
      expect(body.week).toHaveLength(7);
      expect(body.week.at(-1)).toMatchObject({
        day: dayKeyOf(new Date()),
        today: true,
        done: false,
      });
    });

    it('counts XP into levels and the day into the week and the streak', async () => {
      const today = new Date(`${dayKeyOf(new Date())}T00:00:00Z`);
      await prisma.dailyActivity.create({ data: { userId, day: today, seconds: 700, xp: 240 } });
      const body = await profile();
      expect(body.xpTotal).toBe(240);
      expect(body.level).toEqual({ level: 2, xpInLevel: 140, xpForNext: 200 });
      expect(body.week.at(-1)?.done).toBe(true);
      expect(body.streak).toEqual({ current: 1, best: 1 });
    });

    it('counts the games and unlocks the achievements they earn', async () => {
      const win = { userId, userColor: 'w', status: 'finished' as const, moves: [] as string[] };
      await prisma.game.createMany({
        data: [
          { ...win, botId: 'mikhail', outcome: 'win', endReason: 'checkmate' },
          { ...win, botId: 'alisa', outcome: 'draw', endReason: 'stalemate' },
          { ...win, botId: 'alisa', outcome: 'loss', endReason: 'resignation' },
        ],
      });
      const body = await profile();
      expect(body.games).toEqual({ played: 3, wins: 1, draws: 1, losses: 1 });
      const unlocked = body.achievements.filter((a) => a.unlocked).map((a) => a.key);
      expect(unlocked).toEqual(expect.arrayContaining(['first-mate', 'beat-bear']));
      expect(unlocked).not.toContain('first-lesson');
    });

    it('keeps an achievement that was reached once', async () => {
      await prisma.userAchievement.create({ data: { userId, key: 'streak-7' } });
      const body = await profile();
      expect(body.achievements.find((a) => a.key === 'streak-7')?.unlocked).toBe(true);
    });

    it('shows the weakest themes of the puzzles solved, once there are enough attempts', async () => {
      await prisma.puzzle.createMany({
        data: ['p1', 'p2', 'p3'].map((id) => ({
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
      const attempt = (puzzleId: string, status: 'solved' | 'failed') => ({
        userId,
        puzzleId,
        status,
        mistakes: status === 'failed' ? 1 : 0,
        ratingBefore: 1000,
      });
      await prisma.puzzleAttempt.createMany({
        data: [attempt('p1', 'solved'), attempt('p2', 'solved'), attempt('p3', 'failed')],
      });
      const body = await profile();
      expect(body.themes).toEqual([{ key: 'fork', title: 'Вилка', accuracy: 67, attempts: 3 }]);
      await prisma.puzzle.deleteMany();
    });

    it('counts the cards that are due', async () => {
      await make((await reviewedGame()).id);
      expect((await profile()).cards).toEqual({ due: 2, total: 2 });
    });
  });
});
