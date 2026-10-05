import {
  AuthResponseSchema,
  IdentitiesResponseSchema,
  OAuthLinkStartResponseSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../../test/create-app.js';
import { DEFAULT_PROFILE, FakeProvider } from '../../../test/fake-oauth-provider.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { RedisService } from '../../redis/redis.service.js';
import { OAUTH_ADAPTERS } from './oauth-provider.js';

const WEB_URL = 'http://localhost:5173';
const COOKIE = 'kg_oauth';
const PASSWORD = 'long-enough-password';

describe('the accounts a learner signs in with', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const yandex = new FakeProvider('yandex');
  const google = new FakeProvider('google');

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp((builder) =>
      builder.overrideProvider(OAUTH_ADAPTERS).useValue(
        new Map([
          ['yandex', yandex],
          ['google', google],
        ]),
      ),
    ));
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    yandex.profile = { ...DEFAULT_PROFILE };
    google.profile = { ...DEFAULT_PROFILE, providerUserId: 'google-7', email: 'cat@gmail.example' };
  });

  async function register(email = 'cat@example.com') {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: PASSWORD },
    });
    return AuthResponseSchema.parse(res.json()).accessToken;
  }

  const as = (token: string) => ({ authorization: `Bearer ${token}` });

  const identities = async (token: string) =>
    IdentitiesResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/auth/identities', headers: as(token) })).json(),
    );

  /** Taps "link" the way a client does and walks the browser through the provider and back. */
  async function link(token: string, provider: 'yandex' | 'google' = 'yandex', client = 'web') {
    const start = await app.inject({
      method: 'POST',
      url: `/auth/oauth/${provider}/link-start`,
      payload: { client },
      headers: as(token),
    });
    const { url } = OAuthLinkStartResponseSchema.parse(start.json());
    const target = new URL(url);
    const begun = await app.inject({ method: 'GET', url: `${target.pathname}${target.search}` });
    const state = new URL(begun.headers.location as string).searchParams.get('state') ?? '';
    const browser = begun.cookies.find((cookie) => cookie.name === COOKIE)?.value ?? '';
    return app.inject({
      method: 'GET',
      url: `/auth/oauth/${provider}/callback?${new URLSearchParams({ code: 'c', state })}`,
      cookies: { [COOKIE]: browser },
    });
  }

  describe('the list', () => {
    it('needs a signed-in learner', async () => {
      expect((await app.inject({ method: 'GET', url: '/auth/identities' })).statusCode).toBe(401);
    });

    it('says the account has a password and no provider yet', async () => {
      expect(await identities(await register())).toEqual({ identities: [], hasPassword: true });
    });
  });

  describe('linking a provider from the profile', () => {
    it('ties the provider to the account that asked, whatever email the provider has', async () => {
      const token = await register();
      const res = await link(token, 'google');

      expect(res.headers.location).toBe(`${WEB_URL}/profile?linked=google`);
      expect(await identities(token)).toEqual({
        identities: [{ provider: 'google', email: 'cat@gmail.example' }],
        hasPassword: true,
      });
      // Nobody is signed in by it, the learner already was
      expect(res.cookies.find((cookie) => cookie.name === 'kg_refresh')).toBeUndefined();
    });

    it('brings the app back with the provider in the deep link', async () => {
      const res = await link(await register(), 'yandex', 'mobile');
      expect(res.headers.location).toBe('kotgambit://auth/callback?linked=yandex');
    });

    it('is the same when the provider is tied already', async () => {
      const token = await register();
      await link(token);
      const again = await link(token);
      expect(again.headers.location).toBe(`${WEB_URL}/profile?linked=yandex`);
      expect((await identities(token)).identities).toHaveLength(1);
    });

    it('refuses an account of the provider that belongs to somebody else', async () => {
      await link(await register('first@example.com'));
      const res = await link(await register('second@example.com'));
      expect(res.headers.location).toBe(`${WEB_URL}/profile?oauth_error=taken`);
      expect(await prisma.identity.count()).toBe(1);
    });

    it('goes back to the profile when the learner changes their mind', async () => {
      const token = await register();
      const start = await app.inject({
        method: 'POST',
        url: '/auth/oauth/yandex/link-start',
        payload: { client: 'web' },
        headers: as(token),
      });
      const target = new URL(OAuthLinkStartResponseSchema.parse(start.json()).url);
      const begun = await app.inject({ method: 'GET', url: `${target.pathname}${target.search}` });
      const state = new URL(begun.headers.location as string).searchParams.get('state') ?? '';
      const res = await app.inject({
        method: 'GET',
        url: `/auth/oauth/yandex/callback?${new URLSearchParams({ error: 'access_denied', state })}`,
        cookies: { [COOKIE]: begun.cookies.find((cookie) => cookie.name === COOKIE)?.value ?? '' },
      });
      expect(res.headers.location).toBe(`${WEB_URL}/profile?oauth_error=cancelled`);
      expect(await prisma.identity.count()).toBe(0);
    });

    it('needs a signed-in learner to start', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/oauth/yandex/link-start',
        payload: { client: 'web' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('answers 404 for a provider that is not on', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/oauth/vk/link-start',
        payload: { client: 'web' },
        headers: as(await register()),
      });
      expect(res.statusCode).toBe(404);
    });

    it('does not take an intent that was made up, and uses a real one once', async () => {
      const made = await app.inject({ method: 'GET', url: '/auth/oauth/yandex/start?intent=nope' });
      expect(made.statusCode).toBe(400);

      const token = await register();
      const start = await app.inject({
        method: 'POST',
        url: '/auth/oauth/yandex/link-start',
        payload: { client: 'web' },
        headers: as(token),
      });
      const target = new URL(OAuthLinkStartResponseSchema.parse(start.json()).url);
      const path = `${target.pathname}${target.search}`;
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(302);
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(400);
    });
  });

  describe('unlinking', () => {
    it('removes a provider when the account has another way in', async () => {
      const token = await register();
      await link(token);
      const res = await app.inject({
        method: 'DELETE',
        url: '/auth/identities/yandex',
        headers: as(token),
      });
      expect(res.statusCode).toBe(204);
      expect((await identities(token)).identities).toEqual([]);
    });

    it('refuses to remove the only way in', async () => {
      // An account made by a provider has no password
      const res = await signInWithProvider();
      const token = await accessTokenAfter(res);
      const del = await app.inject({
        method: 'DELETE',
        url: '/auth/identities/yandex',
        headers: as(token),
      });
      expect(del.statusCode).toBe(409);
      expect(del.json()).toMatchObject({ code: 'oauth.last_method' });
      expect(await prisma.identity.count()).toBe(1);
    });

    it('lets one of two providers go', async () => {
      const token = await accessTokenAfter(await signInWithProvider());
      await link(token, 'google');
      const del = await app.inject({
        method: 'DELETE',
        url: '/auth/identities/yandex',
        headers: as(token),
      });
      expect(del.statusCode).toBe(204);
      expect((await identities(token)).identities.map((identity) => identity.provider)).toEqual([
        'google',
      ]);
    });

    it('answers 404 for a provider that is not tied', async () => {
      const del = await app.inject({
        method: 'DELETE',
        url: '/auth/identities/google',
        headers: as(await register()),
      });
      expect(del.statusCode).toBe(404);
    });

    it('does not touch the accounts of others', async () => {
      await link(await register('first@example.com'));
      const other = await register('second@example.com');
      const del = await app.inject({
        method: 'DELETE',
        url: '/auth/identities/yandex',
        headers: as(other),
      });
      expect(del.statusCode).toBe(404);
      expect(await prisma.identity.count()).toBe(1);
    });
  });

  /** A learner who came with a provider and has no password. */
  async function signInWithProvider() {
    yandex.profile = { ...DEFAULT_PROFILE, email: 'only-yandex@example.com' };
    const begun = await app.inject({
      method: 'GET',
      url: '/auth/oauth/yandex/start?client=mobile',
    });
    const state = new URL(begun.headers.location as string).searchParams.get('state') ?? '';
    return app.inject({
      method: 'GET',
      url: `/auth/oauth/yandex/callback?${new URLSearchParams({ code: 'c', state })}`,
      cookies: { [COOKIE]: begun.cookies.find((cookie) => cookie.name === COOKIE)?.value ?? '' },
    });
  }

  async function accessTokenAfter(callback: { headers: Record<string, unknown> }) {
    const code = new URL(callback.headers['location'] as string).searchParams.get('code');
    const exchange = await app.inject({
      method: 'POST',
      url: '/auth/oauth/exchange',
      payload: { code },
    });
    return AuthResponseSchema.parse(exchange.json()).accessToken;
  }
});
