import {
  ApiErrorSchema,
  AuthResponseSchema,
  ProfileSchema,
  SettingsSchema,
  WardrobeSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';

describe('the settings and the account', () => {
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

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'cat@example.com',
        password: 'long-enough-password',
        displayName: 'Дмитрий',
      },
    });
    // The verification email goes out after the answer, let it finish before the next test cleans up
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(0));
    const body = AuthResponseSchema.parse(res.json());
    token = body.accessToken;
    userId = body.user.id;
  });

  const call = (method: 'GET' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    });

  it('needs a signed-in user', async () => {
    for (const method of ['GET', 'PATCH'] as const) {
      const res = await app.inject({ method, url: '/users/me/settings' });
      expect(res.statusCode, method).toBe(401);
    }
    expect((await app.inject({ method: 'DELETE', url: '/users/me' })).statusCode).toBe(401);
  });

  it('gives the goal of ten minutes and the name to start with', async () => {
    const res = await call('GET', '/users/me/settings');
    expect(SettingsSchema.parse(res.json())).toEqual({
      dailyGoalMinutes: 10,
      displayName: 'Дмитрий',
    });
  });

  it('changes the goal to one of the three and the day bar follows', async () => {
    const res = await call('PATCH', '/users/me/settings', { dailyGoalMinutes: 15 });
    expect(SettingsSchema.parse(res.json())).toMatchObject({ dailyGoalMinutes: 15 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).dailyGoalMinutes).toBe(
      15,
    );
    const summary = await call('GET', '/progress/summary');
    expect(summary.json()).toMatchObject({ goalSeconds: 900 });
  });

  it('refuses a goal that is not one of the three', async () => {
    for (const bad of [0, 7, 20, '10']) {
      const res = await call('PATCH', '/users/me/settings', { dailyGoalMinutes: bad });
      expect(res.statusCode, String(bad)).toBe(400);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('validation.failed');
    }
  });

  it('changes only what is sent', async () => {
    await call('PATCH', '/users/me/settings', { dailyGoalMinutes: 5 });
    const res = await call('PATCH', '/users/me/settings', { displayName: '  Маша  ' });
    expect(SettingsSchema.parse(res.json())).toEqual({ dailyGoalMinutes: 5, displayName: 'Маша' });
  });

  it('takes the name away with an empty one and refuses a name that is too long', async () => {
    const cleared = await call('PATCH', '/users/me/settings', { displayName: '   ' });
    expect(SettingsSchema.parse(cleared.json()).displayName).toBeNull();
    const long = await call('PATCH', '/users/me/settings', { displayName: 'я'.repeat(41) });
    expect(long.statusCode).toBe(400);
  });

  describe('deleting the account', () => {
    it('removes the learner with everything that hangs on them', async () => {
      await prisma.dailyActivity.create({
        data: { userId, day: new Date('2026-10-01T00:00:00Z'), seconds: 60, xp: 10 },
      });
      await prisma.game.create({ data: { userId, botId: 'alisa', userColor: 'w' } });
      await prisma.subscription.create({
        data: {
          userId,
          planKey: 'month',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 1e9),
        },
      });

      const res = await call('DELETE', '/users/me');
      expect(res.statusCode).toBe(204);
      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.dailyActivity.count()).toBe(0);
      expect(await prisma.game.count()).toBe(0);
      expect(await prisma.subscription.count()).toBe(0);
      expect(await prisma.refreshToken.count()).toBe(0);
    });

    it('leaves the token worth nothing afterwards', async () => {
      await call('DELETE', '/users/me');
      expect((await call('GET', '/users/me')).statusCode).toBe(401);
      expect((await call('GET', '/users/me/settings')).statusCode).toBe(401);
    });

    it('does not touch other learners', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'other@example.com', password: 'long-enough-password' },
      });
      await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(1));
      await call('DELETE', '/users/me');
      expect(await prisma.user.count()).toBe(1);
    });
  });

  describe('the wardrobe of the cat', () => {
    const openKeys = async () =>
      ProfileSchema.parse((await call('GET', '/profile')).json())
        .wardrobe.items.filter((item) => item.unlocked)
        .map((item) => item.key);

    it('starts with the plain cat and nothing else open', async () => {
      const profile = ProfileSchema.parse((await call('GET', '/profile')).json());
      expect(profile.wardrobe.selected).toBe('none');
      expect(await openKeys()).toEqual(['none']);
      expect((await call('GET', '/users/me')).json()).toMatchObject({ accessory: 'none' });
    });

    it('refuses an item that is not earned yet', async () => {
      const res = await call('PUT', '/profile/accessory', { accessory: 'crown' });
      expect(res.statusCode).toBe(403);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('wardrobe.locked');
      expect((await call('GET', '/users/me')).json()).toMatchObject({ accessory: 'none' });
    });

    it('refuses a name that is not in the wardrobe', async () => {
      expect((await call('PUT', '/profile/accessory', { accessory: 'cape' })).statusCode).toBe(400);
    });

    it('puts on an item after it is earned, and the cat wears it everywhere', async () => {
      await prisma.userPuzzleStats.create({ data: { userId, solved: 100 } });
      expect(await openKeys()).toEqual(['none', 'glasses']);
      const res = await call('PUT', '/profile/accessory', { accessory: 'glasses' });
      expect(res.statusCode).toBe(200);
      expect(WardrobeSchema.parse(res.json()).selected).toBe('glasses');
      expect((await call('GET', '/users/me')).json()).toMatchObject({ accessory: 'glasses' });
    });

    it('takes the item off again by choosing the plain cat', async () => {
      await prisma.userPuzzleStats.create({ data: { userId, solved: 100 } });
      await call('PUT', '/profile/accessory', { accessory: 'glasses' });
      const res = await call('PUT', '/profile/accessory', { accessory: 'none' });
      expect(WardrobeSchema.parse(res.json()).selected).toBe('none');
    });

    it('needs a signed-in user', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/profile/accessory',
        payload: { accessory: 'none' },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
