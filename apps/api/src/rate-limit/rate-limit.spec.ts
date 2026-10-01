import { ApiErrorSchema } from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import { AUTH_LIMITS } from '../auth/auth.limits.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { RateLimiterService } from './rate-limiter.service.js';

describe('rate limiting', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;

  beforeAll(async () => {
    ({ app, prisma, redis, mail } = await createTestApp());
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
  });

  const login = (email: string, remoteAddress?: string) =>
    app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'wrong-password' },
      ...(remoteAddress ? { remoteAddress } : {}),
    });

  describe('login', () => {
    it('blocks guessing one account after a few attempts and says when to retry', async () => {
      const limit = AUTH_LIMITS.loginPerEmail.limit;
      for (let attempt = 0; attempt < limit; attempt += 1) {
        expect((await login('victim@example.com')).statusCode).toBe(401);
      }
      const blocked = await login('victim@example.com');
      expect(blocked.statusCode).toBe(429);
      expect(ApiErrorSchema.parse(blocked.json()).code).toBe('http.too_many_requests');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('also blocks the account when the attempts come from other addresses', async () => {
      const limit = AUTH_LIMITS.loginPerEmail.limit;
      for (let attempt = 0; attempt < limit; attempt += 1) {
        await login('victim@example.com', `10.0.0.${attempt + 1}`);
      }
      expect((await login('victim@example.com', '10.0.1.1')).statusCode).toBe(429);
    });

    it('counts the same email in any letter case together', async () => {
      const limit = AUTH_LIMITS.loginPerEmail.limit;
      for (let attempt = 0; attempt < limit; attempt += 1) {
        await login(attempt % 2 === 0 ? 'Victim@Example.com' : 'victim@example.com');
      }
      expect((await login('VICTIM@example.com')).statusCode).toBe(429);
    });

    it('does not punish other accounts for one account being attacked', async () => {
      for (let attempt = 0; attempt < AUTH_LIMITS.loginPerEmail.limit + 1; attempt += 1) {
        await login('victim@example.com');
      }
      expect((await login('someone-else@example.com')).statusCode).toBe(401);
    });

    it('does not keep the email in Redis in the clear', async () => {
      await login('victim@example.com');
      const keys = await redis.client.keys('*');
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.some((key) => key.includes('victim'))).toBe(false);
    });
  });

  describe('registration', () => {
    it('limits sign-ups from one address', async () => {
      const limit = AUTH_LIMITS.registerPerIp.limit;
      const register = (n: number) =>
        app.inject({
          method: 'POST',
          url: '/auth/register',
          payload: { email: `new${n}@example.com`, password: 'long-enough-password' },
        });
      for (let n = 0; n < limit; n += 1) expect((await register(n)).statusCode).toBe(201);
      expect((await register(limit)).statusCode).toBe(429);
      // Let the verification emails finish before the next test removes the users
      await vi.waitFor(() => expect(mail.outbox).toHaveLength(limit));
    });
  });

  describe('RateLimiterService', () => {
    it('starts a new window once the old one ends', async () => {
      const limiter = app.get(RateLimiterService);
      expect((await limiter.consume('rl:test', 1, 1)).allowed).toBe(true);
      expect((await limiter.consume('rl:test', 1, 1)).allowed).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect((await limiter.consume('rl:test', 1, 1)).allowed).toBe(true);
    });

    it('always sets an expiry on the counter', async () => {
      await app.get(RateLimiterService).consume('rl:ttl', 5, 30);
      expect(await redis.client.ttl('rl:ttl')).toBeGreaterThan(0);
    });
  });
});
