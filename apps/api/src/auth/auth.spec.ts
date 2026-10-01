import {
  ApiErrorSchema,
  AuthResponseSchema,
  CLIENT_HEADER,
  MOBILE_CLIENT,
  UserSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { REFRESH_COOKIE } from './auth.controller.js';

const CREDENTIALS = { email: 'cat@example.com', password: 'long-enough-password' };
const MOBILE = { [CLIENT_HEADER]: MOBILE_CLIENT };

describe('auth', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;

  beforeAll(async () => {
    ({ app, prisma, redis, mail } = await createTestApp());
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    // Rate limit counters would otherwise pile up across the tests
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
  });

  const post = (url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url, payload: payload as object, headers });

  async function register(headers: Record<string, string> = {}) {
    const res = await post('/auth/register', CREDENTIALS, headers);
    // The verification email goes out after the answer, let it finish before the next test cleans up
    if (res.statusCode === 201)
      await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(0));
    return res;
  }

  const refreshCookie = (res: { cookies: { name: string; value: string }[] }) =>
    res.cookies.find((cookie) => cookie.name === REFRESH_COOKIE);

  describe('registration', () => {
    it('creates the account and signs in', async () => {
      const res = await register();
      expect(res.statusCode).toBe(201);
      const body = AuthResponseSchema.parse(res.json());
      expect(body.user.email).toBe(CREDENTIALS.email);
      expect(body.refreshToken).toBeUndefined();
    });

    it('hands the refresh token over in an httpOnly cookie on web', async () => {
      const res = await register();
      expect(res.cookies.find((c) => c.name === REFRESH_COOKIE)).toMatchObject({
        httpOnly: true,
        sameSite: 'Lax',
        path: '/auth',
      });
    });

    it('stores an argon2id hash, never the password', async () => {
      await register();
      const credential = await prisma.credential.findFirstOrThrow();
      expect(credential.passwordHash).toMatch(/^\$argon2id\$/);
      expect(credential.passwordHash).not.toContain(CREDENTIALS.password);
    });

    it('stores only the hash of the refresh token', async () => {
      const res = await register();
      const token = refreshCookie(res)?.value ?? '';
      const stored = await prisma.refreshToken.findFirstOrThrow();
      expect(stored.tokenHash).not.toBe(token);
      expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects a second account with the same email in any letter case', async () => {
      await register();
      const res = await post('/auth/register', { ...CREDENTIALS, email: 'CAT@Example.com' });
      expect(res.statusCode).toBe(409);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('auth.email_taken');
    });

    it('rejects invalid input', async () => {
      const res = await post('/auth/register', { email: 'nope', password: 'x' });
      expect(res.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('validation.failed');
    });

    it('gives the mobile app the refresh token in the body and no cookie', async () => {
      const res = await register(MOBILE);
      expect(AuthResponseSchema.parse(res.json()).refreshToken).toBeTruthy();
      expect(refreshCookie(res)).toBeUndefined();
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await register();
    });

    it('signs in with the right password', async () => {
      const res = await post('/auth/login', { ...CREDENTIALS, email: 'Cat@Example.com' });
      expect(res.statusCode).toBe(200);
      expect(AuthResponseSchema.parse(res.json()).user.email).toBe(CREDENTIALS.email);
    });

    it('answers a wrong password and an unknown email identically', async () => {
      const wrongPassword = await post('/auth/login', {
        ...CREDENTIALS,
        password: 'wrong-password',
      });
      const unknownEmail = await post('/auth/login', {
        ...CREDENTIALS,
        email: 'nobody@example.com',
      });
      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownEmail.statusCode).toBe(401);
      expect(wrongPassword.json()).toEqual(unknownEmail.json());
      expect(ApiErrorSchema.parse(wrongPassword.json()).code).toBe('auth.invalid_credentials');
    });
  });

  describe('current user', () => {
    const me = (authorization?: string) =>
      app.inject({
        method: 'GET',
        url: '/users/me',
        headers: authorization ? { authorization } : {},
      });

    it('returns the profile for a valid access token', async () => {
      const { accessToken } = AuthResponseSchema.parse((await register()).json());
      const res = await me(`Bearer ${accessToken}`);
      expect(res.statusCode).toBe(200);
      expect(UserSchema.parse(res.json()).email).toBe(CREDENTIALS.email);
    });

    it('refuses a missing, malformed or forged token', async () => {
      await register();
      expect((await me()).statusCode).toBe(401);
      expect((await me('Bearer garbage')).statusCode).toBe(401);
      expect((await me('Basic abc')).statusCode).toBe(401);
      const forged = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11')
        .setIssuer('kotgambit')
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode('another-secret-another-secret-123456'));
      expect((await me(`Bearer ${forged}`)).statusCode).toBe(401);
    });

    it('refuses an expired token', async () => {
      const { user } = AuthResponseSchema.parse((await register()).json());
      const expired = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuer('kotgambit')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(new TextEncoder().encode(process.env['JWT_ACCESS_SECRET']));
      expect((await me(`Bearer ${expired}`)).statusCode).toBe(401);
    });
  });

  describe('refresh', () => {
    const refreshWithCookie = (value: string) =>
      app.inject({ method: 'POST', url: '/auth/refresh', cookies: { [REFRESH_COOKIE]: value } });

    it('issues a new pair and rotates the cookie', async () => {
      const first = refreshCookie(await register())?.value ?? '';
      const res = await refreshWithCookie(first);
      expect(res.statusCode).toBe(200);
      AuthResponseSchema.parse(res.json());
      const second = refreshCookie(res)?.value;
      expect(second).toBeTruthy();
      expect(second).not.toBe(first);
    });

    it('works with the body for the mobile app', async () => {
      const { refreshToken } = AuthResponseSchema.parse((await register(MOBILE)).json());
      const res = await post('/auth/refresh', { refreshToken }, MOBILE);
      expect(res.statusCode).toBe(200);
      const next = AuthResponseSchema.parse(res.json()).refreshToken;
      expect(next).toBeTruthy();
      expect(next).not.toBe(refreshToken);
    });

    it('treats a reused token as theft and revokes the whole family', async () => {
      const first = refreshCookie(await register())?.value ?? '';
      const rotated = refreshCookie(await refreshWithCookie(first))?.value ?? '';

      const replay = await refreshWithCookie(first);
      expect(replay.statusCode).toBe(401);
      expect(ApiErrorSchema.parse(replay.json()).code).toBe('auth.session_expired');

      // The thief's replay also killed the token the real owner got in exchange
      expect((await refreshWithCookie(rotated)).statusCode).toBe(401);
    });

    it('lets only one of two parallel requests use the same token', async () => {
      const first = refreshCookie(await register())?.value ?? '';
      const results = await Promise.all([refreshWithCookie(first), refreshWithCookie(first)]);
      expect(results.filter((res) => res.statusCode === 200)).toHaveLength(1);
    });

    it('refuses an expired token', async () => {
      const first = refreshCookie(await register())?.value ?? '';
      await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await refreshWithCookie(first)).statusCode).toBe(401);
    });

    it('refuses a missing or unknown token', async () => {
      expect((await post('/auth/refresh')).statusCode).toBe(401);
      expect((await refreshWithCookie('unknown-token')).statusCode).toBe(401);
    });
  });

  describe('logout', () => {
    it('ends the session and clears the cookie', async () => {
      const token = refreshCookie(await register())?.value ?? '';
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        cookies: { [REFRESH_COOKIE]: token },
      });
      expect(res.statusCode).toBe(204);
      expect(refreshCookie(res)?.value).toBe('');

      const after = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { [REFRESH_COOKIE]: token },
      });
      expect(after.statusCode).toBe(401);
    });

    it('succeeds even when nobody is signed in', async () => {
      expect((await post('/auth/logout')).statusCode).toBe(204);
    });
  });
});
