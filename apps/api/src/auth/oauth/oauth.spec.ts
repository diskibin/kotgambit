import { AuthResponseSchema, OAuthProvidersResponseSchema } from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../../test/create-app.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { RedisService } from '../../redis/redis.service.js';
import { REFRESH_COOKIE } from '../refresh-cookie.js';
import {
  OAUTH_ADAPTERS,
  OAuthProviderError,
  type AuthUrlParams,
  type ExchangeParams,
  type OAuthProfile,
  type OAuthProviderAdapter,
} from './oauth-provider.js';

const WEB_URL = 'http://localhost:5173';
const COOKIE = 'kg_oauth';
const PROFILE: OAuthProfile = {
  providerUserId: 'yandex-42',
  email: 'cat@example.com',
  emailVerified: true,
  displayName: 'Гамбит',
};

/** A provider that answers from memory, so the flow can be walked through without the network. */
class FakeProvider implements OAuthProviderAdapter {
  profile: OAuthProfile = PROFILE;
  failExchange = false;
  lastVerifier = '';
  lastQuery: Record<string, string> = {};

  constructor(readonly id: OAuthProviderAdapter['id']) {}

  buildAuthUrl({ state, codeChallenge, redirectUri }: AuthUrlParams): string {
    const url = new URL(`https://${this.id}.example/authorize`);
    url.search = new URLSearchParams({
      state,
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
    }).toString();
    return url.toString();
  }

  exchangeCode({ codeVerifier, query }: ExchangeParams): Promise<string> {
    this.lastVerifier = codeVerifier;
    this.lastQuery = query;
    if (this.failExchange) return Promise.reject(new OAuthProviderError('the code was refused'));
    return Promise.resolve('access-token');
  }

  fetchProfile(): Promise<OAuthProfile> {
    return Promise.resolve(this.profile);
  }
}

describe('sign-in with a provider', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const yandex = new FakeProvider('yandex');
  const vk = new FakeProvider('vk');
  const google = new FakeProvider('google');

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp((builder) =>
      builder.overrideProvider(OAUTH_ADAPTERS).useValue(
        new Map([
          ['google', google],
          ['yandex', yandex],
          ['vk', vk],
        ]),
      ),
    ));
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    for (const provider of [yandex, vk, google]) {
      provider.profile = { ...PROFILE };
      provider.failExchange = false;
    }
  });

  /** Starts a sign-in the way the browser does and returns what the provider would send back. */
  async function start(provider = 'yandex', client = 'web') {
    const res = await app.inject({
      method: 'GET',
      url: `/auth/oauth/${provider}/start?client=${client}`,
    });
    const target = new URL(res.headers.location as string);
    return {
      res,
      state: target.searchParams.get('state') ?? '',
      challenge: target.searchParams.get('code_challenge') ?? '',
      browser: res.cookies.find((cookie) => cookie.name === COOKIE)?.value ?? '',
    };
  }

  const callback = (provider: string, query: Record<string, string>, browser: string | undefined) =>
    app.inject({
      method: 'GET',
      url: `/auth/oauth/${provider}/callback?${new URLSearchParams(query).toString()}`,
      cookies: browser ? { [COOKIE]: browser } : {},
    });

  async function signIn(provider = 'yandex', client = 'web', extra: Record<string, string> = {}) {
    const { state, browser } = await start(provider, client);
    return callback(provider, { code: 'the-code', state, ...extra }, browser);
  }

  describe('the buttons', () => {
    it('lists the providers in the order of the design', async () => {
      const res = await app.inject({ method: 'GET', url: '/auth/oauth/providers' });
      expect(OAuthProvidersResponseSchema.parse(res.json()).providers).toEqual([
        'yandex',
        'vk',
        'google',
      ]);
    });
  });

  describe('the start', () => {
    it('sends the browser to the provider with a state and a PKCE challenge', async () => {
      const { res, state, challenge } = await start();
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/^https:\/\/yandex\.example\/authorize\?/);
      expect(state.length).toBeGreaterThanOrEqual(32);
      expect(challenge).not.toBe('');
      const url = new URL(res.headers.location as string);
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/auth/oauth/yandex/callback',
      );
    });

    it('ties the sign-in to the browser with an httpOnly cookie', async () => {
      const { res } = await start();
      expect(res.cookies.find((cookie) => cookie.name === COOKIE)).toMatchObject({
        httpOnly: true,
        sameSite: 'Lax',
        path: '/auth/oauth',
      });
    });

    it('answers 404 for a provider that is not there', async () => {
      const res = await app.inject({ method: 'GET', url: '/auth/oauth/github/start' });
      expect(res.statusCode).toBe(404);
    });

    it('sends the code verifier to the provider and keeps it off the browser', async () => {
      const { state, challenge, browser, res } = await start();
      await callback('yandex', { code: 'c', state }, browser);
      expect(yandex.lastVerifier).not.toBe('');
      expect(createHash('sha256').update(yandex.lastVerifier).digest('base64url')).toBe(challenge);
      expect(res.headers.location).not.toContain(yandex.lastVerifier);
    });
  });

  describe('a new learner on the web', () => {
    it('opens an account with the verified email and signs in', async () => {
      const res = await signIn();
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe(`${WEB_URL}/learn`);
      expect(res.cookies.find((cookie) => cookie.name === REFRESH_COOKIE)).toMatchObject({
        httpOnly: true,
        path: '/auth',
      });

      const user = await prisma.user.findFirstOrThrow({
        include: { identities: true, credential: true },
      });
      expect(user.email).toBe('cat@example.com');
      expect(user.displayName).toBe('Гамбит');
      expect(user.emailVerifiedAt).not.toBeNull();
      expect(user.credential).toBeNull();
      expect(user.identities).toMatchObject([{ provider: 'yandex', providerUserId: 'yandex-42' }]);
    });

    it('signs the same person in to the same account the next time', async () => {
      await signIn();
      await signIn();
      expect(await prisma.user.count()).toBe(1);
      expect(await prisma.identity.count()).toBe(1);
    });

    it('does not let an account without a password sign in with one', async () => {
      await signIn();
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'cat@example.com', password: 'whatever-password' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('the app', () => {
    it('gets a one-time code on the deep link and trades it for tokens', async () => {
      const res = await signIn('vk', 'mobile', { device_id: 'device-1' });
      const target = new URL(res.headers.location as string);
      expect(`${target.protocol}//${target.host}${target.pathname}`).toBe(
        'kotgambit://auth/callback',
      );
      expect(vk.lastQuery['device_id']).toBe('device-1');

      const code = target.searchParams.get('code') ?? '';
      const exchange = await app.inject({
        method: 'POST',
        url: '/auth/oauth/exchange',
        payload: { code },
      });
      expect(exchange.statusCode).toBe(200);
      const body = AuthResponseSchema.parse(exchange.json());
      expect(body.refreshToken).toBeDefined();
      expect(body.user.email).toBe('cat@example.com');
    });

    it('accepts the code once', async () => {
      const res = await signIn('yandex', 'mobile');
      const code = new URL(res.headers.location as string).searchParams.get('code');
      const exchange = () =>
        app.inject({ method: 'POST', url: '/auth/oauth/exchange', payload: { code } });
      expect((await exchange()).statusCode).toBe(200);
      expect((await exchange()).statusCode).toBe(401);
    });

    it('refuses a made-up code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/oauth/exchange',
        payload: { code: 'nope' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: 'oauth.code_invalid' });
    });
  });

  describe('the state', () => {
    it('cannot be used twice', async () => {
      const { state, browser } = await start();
      expect((await callback('yandex', { code: 'c', state }, browser)).statusCode).toBe(302);
      const again = await callback('yandex', { code: 'c', state }, browser);
      expect(again.headers.location).toBe(`${WEB_URL}/login?oauth_error=expired`);
      expect(await prisma.user.count()).toBe(1);
    });

    it('is refused without the cookie of the browser that started the sign-in', async () => {
      const { state } = await start();
      const res = await callback('yandex', { code: 'c', state }, undefined);
      expect(res.headers.location).toBe(`${WEB_URL}/login?oauth_error=expired`);
      expect(await prisma.user.count()).toBe(0);
    });

    it('is refused with the cookie of another sign-in', async () => {
      const { state } = await start();
      const other = await start();
      const res = await callback('yandex', { code: 'c', state }, other.browser);
      expect(res.headers.location).toBe(`${WEB_URL}/login?oauth_error=expired`);
    });

    it('is refused for another provider than the one it was made for', async () => {
      const { state, browser } = await start('yandex');
      const res = await callback('google', { code: 'c', state }, browser);
      expect(res.headers.location).toBe(`${WEB_URL}/login?oauth_error=expired`);
    });

    it('is refused when it is made up', async () => {
      const res = await callback('yandex', { code: 'c', state: 'made-up' }, 'cookie');
      expect(res.headers.location).toBe(`${WEB_URL}/login?oauth_error=expired`);
    });
  });

  describe('when the sign-in does not finish', () => {
    it('says the learner changed their mind', async () => {
      const { state, browser } = await start();
      const res = await callback('yandex', { error: 'access_denied', state }, browser);
      expect(res.headers.location).toBe(`${WEB_URL}/login?oauth_error=cancelled`);
    });

    it('says it failed when the provider refuses the code', async () => {
      yandex.failExchange = true;
      const res = await signIn();
      expect(res.headers.location).toBe(`${WEB_URL}/login?oauth_error=failed`);
      expect(await prisma.user.count()).toBe(0);
    });

    it('brings the app back with the reason in the deep link', async () => {
      yandex.failExchange = true;
      const res = await signIn('yandex', 'mobile');
      expect(res.headers.location).toBe('kotgambit://auth/callback?error=failed');
    });

    it('does not open an account without an email', async () => {
      yandex.profile = { ...PROFILE, email: null, emailVerified: false };
      const res = await signIn();
      expect(res.headers.location).toBe(`${WEB_URL}/login?oauth_error=no_email`);
      expect(await prisma.user.count()).toBe(0);
    });

    it('does not open an account on an email the provider does not vouch for', async () => {
      google.profile = { ...PROFILE, providerUserId: 'g-1', emailVerified: false };
      const res = await signIn('google');
      expect(res.headers.location).toBe(`${WEB_URL}/login?oauth_error=no_email`);
      expect(await prisma.user.count()).toBe(0);
    });
  });

  describe('an email that already has an account', () => {
    const PASSWORD = 'long-enough-password';

    async function existingLearner() {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'cat@example.com', password: PASSWORD },
      });
      return AuthResponseSchema.parse(res.json()).accessToken;
    }

    it('is not merged silently, the learner is asked to sign in first', async () => {
      await existingLearner();
      const res = await signIn();
      const target = new URL(res.headers.location as string);
      expect(`${target.origin}${target.pathname}`).toBe(`${WEB_URL}/login`);
      expect(target.searchParams.get('provider')).toBe('yandex');
      expect(target.searchParams.get('link')).not.toBeNull();
      expect(res.cookies.find((cookie) => cookie.name === REFRESH_COOKIE)).toBeUndefined();
      expect(await prisma.identity.count()).toBe(0);
      expect(await prisma.user.count()).toBe(1);
    });

    it('is linked after the learner signs in to that account', async () => {
      const accessToken = await existingLearner();
      const res = await signIn();
      const ticket = new URL(res.headers.location as string).searchParams.get('link');

      const link = await app.inject({
        method: 'POST',
        url: '/auth/oauth/link',
        payload: { ticket },
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(link.statusCode).toBe(204);
      expect(await prisma.identity.count()).toBe(1);

      // From now on the provider signs in to that account
      const next = await signIn();
      expect(next.headers.location).toBe(`${WEB_URL}/learn`);
      expect(await prisma.user.count()).toBe(1);
    });

    it('cannot be linked twice with the same ticket', async () => {
      const accessToken = await existingLearner();
      const ticket = new URL((await signIn()).headers.location as string).searchParams.get('link');
      const post = () =>
        app.inject({
          method: 'POST',
          url: '/auth/oauth/link',
          payload: { ticket },
          headers: { authorization: `Bearer ${accessToken}` },
        });
      expect((await post()).statusCode).toBe(204);
      expect((await post()).statusCode).toBe(400);
    });

    it('cannot be linked by somebody else', async () => {
      await existingLearner();
      const ticket = new URL((await signIn()).headers.location as string).searchParams.get('link');
      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'dog@example.com', password: PASSWORD },
      });
      const link = await app.inject({
        method: 'POST',
        url: '/auth/oauth/link',
        payload: { ticket },
        headers: { authorization: `Bearer ${AuthResponseSchema.parse(other.json()).accessToken}` },
      });
      expect(link.statusCode).toBe(400);
      expect(await prisma.identity.count()).toBe(0);
    });

    it('needs a signed-in learner to link', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/oauth/link',
        payload: { ticket: 'x' },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
