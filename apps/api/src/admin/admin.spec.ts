import { AdminStatsSchema, AuthResponseSchema } from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import { grantPremium } from '../../test/premium.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { dayKey } from './stats.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const OWNER = 'owner@example.com';

describe('analytics and the admin page', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let savedAdmins: string | undefined;

  beforeAll(async () => {
    savedAdmins = process.env['ADMIN_EMAILS'];
    process.env['ADMIN_EMAILS'] = ` ${OWNER.toUpperCase()} `;
    ({ app, prisma, redis, mail } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
    if (savedAdmins === undefined) delete process.env['ADMIN_EMAILS'];
    else process.env['ADMIN_EMAILS'] = savedAdmins;
  });

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.analyticsEvent.deleteMany();
    await prisma.user.deleteMany();
    mail.clear();
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

  const event = (name: string, visitorId: string = randomUUID(), detail?: string) =>
    app.inject({
      method: 'POST',
      url: '/analytics/events',
      payload: { visitorId, name, ...(detail ? { detail } : {}) },
    });

  const stats = (token: string | null, days?: number) =>
    app.inject({
      method: 'GET',
      url: `/admin/stats${days === undefined ? '' : `?days=${days}`}`,
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
    });

  describe('events', () => {
    it('keeps the id and the step of a visitor who has not signed in', async () => {
      const visitorId = randomUUID();
      const res = await event('premium_view', visitorId);
      expect(res.statusCode).toBe(204);
      const rows = await prisma.analyticsEvent.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ visitorId, name: 'premium_view' });
    });

    it('keeps which hint about Premium was shown, and only for the events about hints', async () => {
      expect((await event('nudge_view', randomUUID(), 'puzzles-soft')).statusCode).toBe(204);
      expect(await prisma.analyticsEvent.findFirstOrThrow()).toMatchObject({
        name: 'nudge_view',
        detail: 'puzzles-soft',
      });
      expect((await event('nudge_view')).statusCode).toBe(400);
      expect((await event('visit', randomUUID(), 'puzzles-soft')).statusCode).toBe(400);
      expect((await event('nudge_click', randomUUID(), 'a person@example.com')).statusCode).toBe(
        400,
      );
      expect(await prisma.analyticsEvent.count()).toBe(1);
    });

    it('refuses a step that is not one of the known and an id that is not an id', async () => {
      expect((await event('page_view')).statusCode).toBe(400);
      expect((await event('visit', 'not-an-id')).statusCode).toBe(400);
      expect(await prisma.analyticsEvent.count()).toBe(0);
    });

    it('slows down an address that sends too many', async () => {
      const visitorId = randomUUID();
      const codes: number[] = [];
      for (let i = 0; i < 61; i += 1) codes.push((await event('visit', visitorId)).statusCode);
      expect(codes.slice(0, 60).every((code) => code === 204)).toBe(true);
      expect(codes[60]).toBe(429);
    });
  });

  describe('who may look', () => {
    it('needs a sign-in, and shows nothing to an account that is not in the list', async () => {
      expect((await stats(null)).statusCode).toBe(401);
      const { token } = await register('learner@example.com');
      expect((await stats(token)).statusCode).toBe(404);
    });

    it('does not let in an account with the address of the list that has not confirmed it', async () => {
      // Somebody signed up with the owner's address before the owner confirmed it
      const { token, id } = await register(OWNER);
      await prisma.user.update({ where: { id }, data: { emailVerifiedAt: null } });
      expect((await stats(token)).statusCode).toBe(404);
      const all = ['/admin/learning', '/admin/payments', '/admin/health', `/admin/users/${id}`];
      for (const url of all) {
        const res = await app.inject({
          method: 'GET',
          url,
          headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode, url).toBe(404);
      }
      await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
      expect((await stats(token)).statusCode).toBe(200);
    });

    it('lets in an account of the list, whatever the case of the list', async () => {
      const { token } = await register(OWNER);
      const res = await stats(token);
      expect(res.statusCode, res.body).toBe(200);
      const body = AdminStatsSchema.parse(res.json());
      expect(body.days).toBe(30);
      expect(body.daily).toHaveLength(30);
    });

    it('takes only the known periods', async () => {
      const { token } = await register(OWNER);
      expect((await stats(token, 7)).statusCode).toBe(200);
      expect((await stats(token, 5)).statusCode).toBe(400);
    });
  });

  describe('the numbers', () => {
    it('counts the visitors once per step and the payments from the database', async () => {
      const { token } = await register(OWNER);
      const learner = await register('learner@example.com');

      const first = randomUUID();
      const second = randomUUID();
      for (const name of ['visit', 'signed_in', 'premium_view', 'checkout_start']) {
        await event(name, first);
      }
      // The same visitor coming again is still one visitor
      await event('visit', first);
      await event('visit', second);
      // Long ago: in a period of 90 days, not in a week
      await prisma.analyticsEvent.create({
        data: {
          visitorId: randomUUID(),
          name: 'visit',
          createdAt: new Date(Date.now() - 40 * MS_IN_DAY),
        },
      });

      const paidAt = new Date();
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
            paidAt,
            ...over,
          },
        });
      await payment({});
      await payment({ purpose: 'renewal', client: 'mobile' });
      await payment({ status: 'canceled', paidAt: null });
      await grantPremium(prisma, learner.id);
      await prisma.dailyActivity.create({
        data: { userId: learner.id, day: new Date(`${dayKey(new Date())}T00:00:00.000Z`) },
      });

      const week = AdminStatsSchema.parse((await stats(token, 7)).json());
      expect(week.funnel).toEqual({
        visitors: 2,
        signedIn: 1,
        premiumView: 1,
        checkoutStart: 1,
        paid: 1,
      });
      expect(week.daily.at(-1)).toMatchObject({
        day: dayKey(new Date()),
        visitors: 2,
        registrations: 2,
        payments: 2,
        revenueKopecks: 59_800,
      });
      expect(week.users).toMatchObject({ total: 2, registered: 2, dau: 1, wau: 1, mau: 1 });
      expect(week.premium).toMatchObject({
        active: 1,
        month: 1,
        year: 0,
        newInPeriod: 1,
        renewalsInPeriod: 1,
        failedPayments: 1,
        revenueKopecks: 59_800,
        totalRevenueKopecks: 59_800,
      });

      const long = AdminStatsSchema.parse((await stats(token, 90)).json());
      expect(long.funnel.visitors).toBe(3);
    });

    it('counts the visitors who saw a hint about Premium and who pressed it, each once', async () => {
      const { token } = await register(OWNER);
      const first = randomUUID();
      const second = randomUUID();
      await event('nudge_view', first, 'puzzles-limit');
      await event('nudge_view', first, 'puzzles-limit');
      await event('nudge_view', second, 'puzzles-limit');
      await event('nudge_click', first, 'puzzles-limit');
      await event('nudge_view', second, 'analysis-soft');

      const body = AdminStatsSchema.parse((await stats(token)).json());
      expect(body.nudges).toEqual([
        { kind: 'puzzles-limit', viewed: 2, clicked: 1 },
        { kind: 'puzzles-soft', viewed: 0, clicked: 0 },
        { kind: 'analysis-limit', viewed: 0, clicked: 0 },
        { kind: 'analysis-soft', viewed: 1, clicked: 0 },
        { kind: 'cards-limit', viewed: 0, clicked: 0 },
      ]);
      // A hint is not a visit
      expect(body.funnel.visitors).toBe(0);
    });

    it('does not count an expired subscription as Premium', async () => {
      const { token } = await register(OWNER);
      const learner = await register('learner@example.com');
      await prisma.subscription.create({
        data: {
          userId: learner.id,
          planKey: 'year',
          status: 'expired',
          currentPeriodEnd: new Date(Date.now() - 10 * MS_IN_DAY),
        },
      });
      const body = AdminStatsSchema.parse((await stats(token)).json());
      expect(body.premium.active).toBe(0);
    });
  });
});
