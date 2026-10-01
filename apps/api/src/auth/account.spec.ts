import { ApiErrorSchema, AuthResponseSchema } from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { REFRESH_COOKIE } from './auth.controller.js';
import { AUTH_LIMITS } from './auth.limits.js';

const EMAIL = 'cat@example.com';
const PASSWORD = 'old-password-1';

describe('account emails', () => {
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

  const post = (url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url, payload: payload as object, headers });

  async function register() {
    const res = await post('/auth/register', { email: EMAIL, password: PASSWORD });
    const body = AuthResponseSchema.parse(res.json());
    const cookie = res.cookies.find((c) => c.name === REFRESH_COOKIE)?.value ?? '';
    // The verification email goes out after the answer, wait for it so it cannot land in a later step
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(0));
    return { accessToken: body.accessToken, refreshCookie: cookie };
  }

  /** Emails are sent after the answer, so a test has to wait for them. */
  const verificationToken = () =>
    vi.waitFor(() => {
      const token = mail.latestToken(EMAIL);
      if (!token) throw new Error('no email yet');
      return token;
    });

  const profile = async (accessToken: string) =>
    (
      await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
    ).json();

  describe('email verification', () => {
    it('sends a link to the new address when someone registers', async () => {
      await register();
      await vi.waitFor(() => expect(mail.outbox).toHaveLength(1));
      const [message] = mail.outbox;
      expect(message?.to).toBe(EMAIL);
      expect(message?.subject).toBe('Подтверди почту в Кот Гамбите');
      expect(message?.text).toContain('http://localhost:5173/verify?token=');
    });

    it('starts unverified and becomes verified through the link', async () => {
      const { accessToken } = await register();
      expect((await profile(accessToken)).emailVerified).toBe(false);

      const res = await post('/auth/email/verify', { token: await verificationToken() });
      expect(res.statusCode).toBe(204);
      expect((await profile(accessToken)).emailVerified).toBe(true);
    });

    it('works once only', async () => {
      await register();
      const token = await verificationToken();
      expect((await post('/auth/email/verify', { token })).statusCode).toBe(204);

      const again = await post('/auth/email/verify', { token });
      expect(again.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(again.json()).code).toBe('auth.link_expired');
    });

    it('refuses an unknown or expired link', async () => {
      await register();
      const token = await verificationToken();
      expect((await post('/auth/email/verify', { token: 'made-up' })).statusCode).toBe(400);

      await prisma.emailToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await post('/auth/email/verify', { token })).statusCode).toBe(400);
    });

    it('sends a fresh link on request and retires the old one', async () => {
      const { accessToken } = await register();
      const first = await verificationToken();
      mail.clear();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/email/resend',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(204);
      const second = await verificationToken();

      expect(second).not.toBe(first);
      expect((await post('/auth/email/verify', { token: first })).statusCode).toBe(400);
      expect((await post('/auth/email/verify', { token: second })).statusCode).toBe(204);
    });

    it('does not resend to a verified address and needs a signed-in user', async () => {
      const { accessToken } = await register();
      await post('/auth/email/verify', { token: await verificationToken() });
      mail.clear();

      await app.inject({
        method: 'POST',
        url: '/auth/email/resend',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(mail.outbox).toHaveLength(0);
      expect((await post('/auth/email/resend')).statusCode).toBe(401);
    });

    it('still lets people sign up when the mail server is down', async () => {
      const send = vi.spyOn(mail, 'send').mockRejectedValueOnce(new Error('smtp is down'));
      const res = await post('/auth/register', { email: EMAIL, password: PASSWORD });
      expect(res.statusCode).toBe(201);
      send.mockRestore();
    });
  });

  describe('forgotten password', () => {
    it('answers the same for a known and an unknown address', async () => {
      await register();
      mail.clear();
      const known = await post('/auth/password/forgot', { email: EMAIL });
      const unknown = await post('/auth/password/forgot', { email: 'nobody@example.com' });
      expect(known.statusCode).toBe(204);
      expect(unknown.statusCode).toBe(204);
      expect(known.body).toBe(unknown.body);
    });

    it('mails a reset link only to an existing account', async () => {
      await register();
      mail.clear();
      await post('/auth/password/forgot', { email: 'nobody@example.com' });
      await post('/auth/password/forgot', { email: EMAIL });

      await vi.waitFor(() => expect(mail.outbox).toHaveLength(1));
      expect(mail.outbox[0]?.to).toBe(EMAIL);
      expect(mail.outbox[0]?.subject).toBe('Новый пароль для Кот Гамбита');
      expect(mail.outbox[0]?.text).toContain('/reset?token=');
    });

    it('limits requests for one address', async () => {
      const limit = AUTH_LIMITS.forgotPasswordPerEmail.limit;
      for (let n = 0; n < limit; n += 1) {
        expect((await post('/auth/password/forgot', { email: EMAIL })).statusCode).toBe(204);
      }
      expect((await post('/auth/password/forgot', { email: EMAIL })).statusCode).toBe(429);
    });
  });

  describe('new password', () => {
    async function requestReset() {
      mail.clear();
      await post('/auth/password/forgot', { email: EMAIL });
      return verificationToken();
    }

    it('changes the password, and only the new one signs in', async () => {
      await register();
      const token = await requestReset();

      const res = await post('/auth/password/reset', { token, password: 'brand-new-password' });
      expect(res.statusCode).toBe(204);

      expect(
        (await post('/auth/login', { email: EMAIL, password: 'brand-new-password' })).statusCode,
      ).toBe(200);
      expect((await post('/auth/login', { email: EMAIL, password: PASSWORD })).statusCode).toBe(
        401,
      );
    });

    it('signs out every session', async () => {
      const { refreshCookie } = await register();
      const token = await requestReset();
      await post('/auth/password/reset', { token, password: 'brand-new-password' });

      const refresh = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { [REFRESH_COOKIE]: refreshCookie },
      });
      expect(refresh.statusCode).toBe(401);
    });

    it('confirms the address, since the owner read the email', async () => {
      await register();
      const token = await requestReset();
      await post('/auth/password/reset', { token, password: 'brand-new-password' });
      const login = AuthResponseSchema.parse(
        (await post('/auth/login', { email: EMAIL, password: 'brand-new-password' })).json(),
      );
      expect(login.user.emailVerified).toBe(true);
    });

    it('works once only and not after it expired', async () => {
      await register();
      const token = await requestReset();
      expect(
        (await post('/auth/password/reset', { token, password: 'brand-new-password' })).statusCode,
      ).toBe(204);
      const again = await post('/auth/password/reset', { token, password: 'another-password-2' });
      expect(again.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(again.json()).code).toBe('auth.link_expired');

      const fresh = await requestReset();
      await prisma.emailToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect(
        (await post('/auth/password/reset', { token: fresh, password: 'another-password-2' }))
          .statusCode,
      ).toBe(400);
    });

    it('keeps the link usable when the new password is too weak', async () => {
      await register();
      const token = await requestReset();
      const weak = await post('/auth/password/reset', { token, password: 'short' });
      expect(weak.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(weak.json()).code).toBe('validation.failed');
      expect(
        (await post('/auth/password/reset', { token, password: 'long-enough-password' }))
          .statusCode,
      ).toBe(204);
    });

    it('retires the previous link when a new one is requested', async () => {
      await register();
      const first = await requestReset();
      const second = await requestReset();
      expect(
        (await post('/auth/password/reset', { token: first, password: 'brand-new-password' }))
          .statusCode,
      ).toBe(400);
      expect(
        (await post('/auth/password/reset', { token: second, password: 'brand-new-password' }))
          .statusCode,
      ).toBe(204);
    });

    it('does not accept an email verification link as a reset link', async () => {
      await register();
      const verify = await verificationToken();
      expect(
        (await post('/auth/password/reset', { token: verify, password: 'brand-new-password' }))
          .statusCode,
      ).toBe(400);
    });
  });
});
