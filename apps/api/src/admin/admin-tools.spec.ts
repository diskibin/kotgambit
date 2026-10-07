import {
  AdminUserListSchema,
  AdminUserSchema,
  AuthResponseSchema,
  LearningStatsSchema,
  PaymentsStatsSchema,
  ServerHealthSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { dayKey } from './stats.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const OWNER = 'owner@example.com';

describe('the tools of the admin page', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let savedAdmins: string | undefined;
  let admin: string;

  beforeAll(async () => {
    savedAdmins = process.env['ADMIN_EMAILS'];
    process.env['ADMIN_EMAILS'] = OWNER;
    ({ app, prisma, redis, mail } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
    if (savedAdmins === undefined) delete process.env['ADMIN_EMAILS'];
    else process.env['ADMIN_EMAILS'] = savedAdmins;
  });

  async function register(email: string): Promise<{ token: string; id: string }> {
    // Read before the request: the mail can be sent before the answer is back in the test
    const sent = mail.outbox.length;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'long-enough-password' },
    });
    // The verification email goes out after the answer, let it finish before the next test cleans up
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(sent));
    const body = AuthResponseSchema.parse(res.json());
    // The owner has confirmed the address, the others have no need to
    if (email.toLowerCase() === OWNER) {
      await prisma.user.update({
        where: { id: body.user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return { token: body.accessToken, id: body.user.id };
  }

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.adminAction.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.puzzle.deleteMany();
    await prisma.user.deleteMany();
    mail.clear();
    admin = (await register(OWNER)).token;
  });

  const get = (url: string, token = admin) =>
    app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
  const post = (url: string, payload: Record<string, unknown>, token = admin) =>
    app.inject({ method: 'POST', url, payload, headers: { authorization: `Bearer ${token}` } });

  describe('learning', () => {
    it('follows the people who signed up through the first steps, the weeks and the chapters', async () => {
      const a = await register('a@example.com');
      const b = await register('b@example.com');
      await register('c@example.com');
      const createdAt = new Date(Date.now() - 20 * MS_IN_DAY);
      await prisma.user.updateMany({
        where: { email: { in: ['a@example.com', 'b@example.com', 'c@example.com'] } },
        data: { createdAt },
      });
      const dayAfter = (days: number) =>
        new Date(`${dayKey(new Date(createdAt.getTime() + days * MS_IN_DAY))}T00:00:00.000Z`);
      for (const [userId, offset] of [
        [a.id, 1],
        [a.id, 7],
        [b.id, 7],
      ] as const) {
        await prisma.dailyActivity.create({ data: { userId, day: dayAfter(offset) } });
      }

      for (const [order, id] of [
        [1, 'l1'],
        [2, 'l2'],
      ] as const) {
        await prisma.lesson.create({
          data: {
            id,
            track: 'basics',
            order,
            access: 'free',
            piece: 'p',
            title: `Глава ${order}`,
            summary: 's',
            minutes: 5,
            steps: [],
            contentHash: 'h',
          },
        });
      }
      const done = (userId: string, lessonId: string, bestAccuracy: number, attempts: number) =>
        prisma.lessonProgress.create({
          data: { userId, lessonId, bestAccuracy, stars: 2, attempts, completedAt: new Date() },
        });
      await done(a.id, 'l1', 0.8, 2);
      await done(a.id, 'l2', 0.9, 1);
      await done(b.id, 'l1', 0.6, 1);

      const puzzle = await prisma.puzzle.create({
        data: {
          id: 'p1',
          fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
          moves: ['a1a2'],
          rating: 1000,
          ratingDeviation: 50,
          popularity: 1,
          plays: 1,
          themes: ['fork', 'short'],
        },
      });
      for (const status of ['solved', 'solved', 'failed', 'failed', 'failed'] as const) {
        await prisma.puzzleAttempt.create({
          data: { userId: a.id, puzzleId: puzzle.id, status, ratingBefore: 1000 },
        });
      }
      await prisma.game.create({ data: { userId: b.id, botId: 'fox', userColor: 'w' } });

      const res = await get('/admin/learning?days=30');
      expect(res.statusCode, res.body).toBe(200);
      const body = LearningStatsSchema.parse(res.json());

      // The owner signed up now, the others 20 days ago
      expect(body.funnel).toEqual({
        registered: 4,
        lesson: 2,
        returned: 2,
        solvedPuzzle: 1,
        playedGame: 1,
      });

      expect(body.cohorts).toHaveLength(8);
      const week = body.cohorts.find((cohort) => cohort.size === 3);
      expect(week).toMatchObject({ d1: 1, d7: 2, d30: null });
      // This week is too young for any of the days
      expect(body.cohorts.at(-1)).toMatchObject({ size: 1, d1: null, d7: null, d30: null });

      expect(body.lessons).toEqual([
        {
          id: 'l1',
          title: 'Глава 1',
          track: 'basics',
          completed: 2,
          fromPrevious: null,
          accuracy: 70,
          attempts: 1.5,
        },
        {
          id: 'l2',
          title: 'Глава 2',
          track: 'basics',
          completed: 1,
          fromPrevious: 50,
          accuracy: 90,
          attempts: 1,
        },
      ]);
      expect(body.themes).toEqual(
        expect.arrayContaining([{ theme: 'fork', attempts: 5, solved: 2 }]),
      );
    });

    it('leaves out the themes that have too few tries', async () => {
      const a = await register('a@example.com');
      await prisma.puzzle.create({
        data: {
          id: 'p1',
          fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
          moves: ['a1a2'],
          rating: 1000,
          ratingDeviation: 50,
          popularity: 1,
          plays: 1,
          themes: ['rare'],
        },
      });
      await prisma.puzzleAttempt.create({
        data: { userId: a.id, puzzleId: 'p1', status: 'failed', ratingBefore: 1000 },
      });
      const body = LearningStatsSchema.parse((await get('/admin/learning')).json());
      expect(body.themes).toEqual([]);
    });
  });

  describe('payments', () => {
    it('compares what was started with what was paid and says why payments failed', async () => {
      const learner = await register('learner@example.com');
      const other = await register('other@example.com');
      const payment = (over: Record<string, unknown>) =>
        prisma.payment.create({
          data: {
            userId: learner.id,
            planKey: 'month',
            purpose: 'initial',
            status: 'succeeded',
            amountKopecks: 29_900,
            idempotencyKey: randomUUID(),
            client: 'web',
            paidAt: new Date(),
            ...over,
          },
        });
      await payment({});
      await payment({ status: 'pending', paidAt: null });
      await payment({
        planKey: 'year',
        status: 'canceled',
        paidAt: null,
        cancelReason: 'insufficient_funds',
      });
      await payment({ purpose: 'renewal', status: 'canceled', paidAt: null });
      await prisma.subscription.create({
        data: {
          userId: learner.id,
          planKey: 'month',
          status: 'expired',
          currentPeriodEnd: new Date(Date.now() - 2 * MS_IN_DAY),
        },
      });
      await prisma.subscription.create({
        data: {
          userId: other.id,
          planKey: 'month',
          status: 'past_due',
          currentPeriodEnd: new Date(Date.now() - MS_IN_DAY),
        },
      });

      const res = await get('/admin/payments?days=30');
      expect(res.statusCode, res.body).toBe(200);
      const body = PaymentsStatsSchema.parse(res.json());
      expect(body.byPlan).toEqual([
        { plan: 'month', started: 2, paid: 1 },
        { plan: 'year', started: 1, paid: 0 },
      ]);
      expect(body.churned).toBe(1);
      expect(body.pastDue).toBe(1);
      expect(body.failures).toEqual(
        expect.arrayContaining([
          { reason: 'insufficient_funds', count: 1 },
          { reason: 'unknown', count: 1 },
        ]),
      );
      expect(body.recent).toHaveLength(4);
      expect(body.recent[0]).toMatchObject({ email: 'learner@example.com' });
      expect(body.recent.find((row) => row.cancelReason)).toMatchObject({
        cancelReason: 'insufficient_funds',
        plan: 'year',
      });
    });
  });

  describe('the server', () => {
    it('reports the database, the cache and the work in the background', async () => {
      const res = await get('/admin/health');
      expect(res.statusCode, res.body).toBe(200);
      const body = ServerHealthSchema.parse(res.json());
      expect(body.database.ok).toBe(true);
      expect(body.redis.ok).toBe(true);
      expect(body.games.active).toBe(0);
      expect(body.reviews).toEqual({ pending: 0, running: 0, failedDay: 0 });
      expect(body.process.memoryMb).toBeGreaterThan(0);
    });
  });

  describe('accounts', () => {
    it('finds an account by a part of the email, from two letters', async () => {
      await register('Learner@example.com');
      await register('other@example.com');
      const found = AdminUserListSchema.parse((await get('/admin/users?q=LEARN')).json());
      expect(found.users.map((user) => user.email)).toEqual(['learner@example.com']);
      expect(found.users[0]?.premium).toBe(false);
      expect((await get('/admin/users?q=l')).statusCode).toBe(400);
      expect((await get('/admin/users')).statusCode).toBe(400);
    });

    it('shows what the account has done and paid', async () => {
      const learner = await register('learner@example.com');
      await prisma.dailyActivity.create({
        data: {
          userId: learner.id,
          day: new Date(`${dayKey(new Date())}T00:00:00.000Z`),
          xp: 40,
        },
      });
      const res = await get(`/admin/users/${learner.id}`);
      expect(res.statusCode, res.body).toBe(200);
      const user = AdminUserSchema.parse(res.json());
      expect(user).toMatchObject({
        email: 'learner@example.com',
        emailVerified: false,
        lastActiveDay: dayKey(new Date()),
        xpTotal: 40,
        hasPassword: true,
        providers: [],
        subscription: null,
        payments: [],
        actions: [],
      });
      expect((await get(`/admin/users/${randomUUID()}`)).statusCode).toBe(404);
    });

    it('gives Premium for the days asked, from the end of what is already there, and logs it', async () => {
      const learner = await register('learner@example.com');
      const first = await post(`/admin/users/${learner.id}/premium`, {
        days: 30,
        reason: 'Подарок за помощь с тестами',
      });
      expect(first.statusCode, first.body).toBe(200);
      const given = AdminUserSchema.parse(first.json());
      expect(given.subscription).toMatchObject({
        premium: true,
        status: 'active',
        autoRenew: false,
      });
      const days = (iso: string) => (new Date(iso).getTime() - Date.now()) / MS_IN_DAY;
      expect(days(given.subscription?.currentPeriodEnd ?? '')).toBeCloseTo(30, 0);

      const again = AdminUserSchema.parse(
        (
          await post(`/admin/users/${learner.id}/premium`, { days: 30, reason: 'Ещё месяц' })
        ).json(),
      );
      expect(days(again.subscription?.currentPeriodEnd ?? '')).toBeCloseTo(60, 0);

      // The learner sees it: the server alone says who has Premium
      const mine = await get('/billing/subscription', learner.token);
      expect(mine.json()).toMatchObject({ premium: true, status: 'active' });

      expect(again.actions.map((row) => row.action)).toEqual(['grant_premium', 'grant_premium']);
      expect(again.actions[1]).toMatchObject({
        adminEmail: OWNER,
        details: '30 дн.: Подарок за помощь с тестами',
      });
    });

    it('takes Premium away at once, forgets the card, and logs it', async () => {
      const learner = await register('learner@example.com');
      await prisma.subscription.create({
        data: {
          userId: learner.id,
          planKey: 'year',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 100 * MS_IN_DAY),
          autoRenew: true,
          paymentMethodId: 'pm-1',
          cardLast4: '4477',
        },
      });
      const res = await post(`/admin/users/${learner.id}/premium/revoke`, {
        reason: 'Возврат по просьбе',
      });
      expect(res.statusCode, res.body).toBe(200);
      const user = AdminUserSchema.parse(res.json());
      expect(user.subscription).toMatchObject({
        premium: false,
        status: 'expired',
        autoRenew: false,
        cardLast4: null,
      });
      const row = await prisma.subscription.findUniqueOrThrow({ where: { userId: learner.id } });
      expect(row.paymentMethodId).toBeNull();
      expect(user.actions[0]).toMatchObject({
        action: 'revoke_premium',
        details: 'Возврат по просьбе',
      });
    });

    it('wants a reason, a sane number of days and an account that exists', async () => {
      const learner = await register('learner@example.com');
      const url = `/admin/users/${learner.id}/premium`;
      expect((await post(url, { days: 30 })).statusCode).toBe(400);
      expect((await post(url, { days: 30, reason: 'ab' })).statusCode).toBe(400);
      expect((await post(url, { days: 0, reason: 'Подарок' })).statusCode).toBe(400);
      expect((await post(url, { days: 400, reason: 'Подарок' })).statusCode).toBe(400);
      expect(
        (await post(`/admin/users/${randomUUID()}/premium`, { days: 5, reason: 'Подарок' }))
          .statusCode,
      ).toBe(404);
      expect(await prisma.adminAction.count()).toBe(0);
    });

    it('is closed to everybody who is not an admin', async () => {
      const learner = await register('learner@example.com');
      const other = await register('other@example.com');
      expect((await get('/admin/users?q=ot', learner.token)).statusCode).toBe(404);
      expect((await get(`/admin/users/${other.id}`, learner.token)).statusCode).toBe(404);
      expect(
        (
          await post(
            `/admin/users/${other.id}/premium`,
            { days: 30, reason: 'Сам себе' },
            learner.token,
          )
        ).statusCode,
      ).toBe(404);
      for (const path of ['learning', 'payments', 'health']) {
        expect((await get(`/admin/${path}`, learner.token)).statusCode).toBe(404);
      }
      expect((await get(`/billing/subscription`, other.token)).json()).toMatchObject({
        premium: false,
      });
    });
  });
});
