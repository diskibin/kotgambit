import { describe, expect, it } from 'vitest';
import { GoogleProvider } from './google.provider.js';
import { OAuthProviderError, type FetchFn } from './oauth-provider.js';
import { VkProvider } from './vk.provider.js';
import { YandexProvider } from './yandex.provider.js';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  form: Record<string, string>;
}

/** Answers with the given bodies one after another and remembers what was asked. */
function fakeFetch(...answers: { status?: number; body: unknown }[]): {
  http: FetchFn;
  calls: Call[];
} {
  const calls: Call[] = [];
  const http: FetchFn = (input, init) => {
    const body = init?.body;
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      form: body instanceof URLSearchParams ? Object.fromEntries(body.entries()) : {},
    });
    const answer = answers[calls.length - 1] ?? { status: 500, body: {} };
    return Promise.resolve(
      new Response(JSON.stringify(answer.body), {
        status: answer.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { http, calls };
}

const AUTH = {
  state: 'the-state',
  codeChallenge: 'the-challenge',
  redirectUri: 'https://api.test/cb',
};
const EXCHANGE = {
  code: 'the-code',
  codeVerifier: 'the-verifier',
  redirectUri: 'https://api.test/cb',
  state: 'the-state',
  query: {},
};

describe('Google', () => {
  const keys = { clientId: 'g-id', clientSecret: 'g-secret' };

  it('asks for the code with PKCE, the email and the profile', () => {
    const url = new URL(new GoogleProvider(keys).buildAuthUrl(AUTH));
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'g-id',
      redirect_uri: 'https://api.test/cb',
      response_type: 'code',
      scope: 'openid email profile',
      state: 'the-state',
      code_challenge: 'the-challenge',
      code_challenge_method: 'S256',
    });
  });

  it('trades the code for a token and reads the profile', async () => {
    const { http, calls } = fakeFetch(
      { body: { access_token: 'tok' } },
      { body: { sub: '1', email: 'Cat@Example.com', email_verified: true, name: 'Cat' } },
    );
    const provider = new GoogleProvider(keys, http);

    const token = await provider.exchangeCode(EXCHANGE);
    const profile = await provider.fetchProfile(token);

    expect(calls[0]).toMatchObject({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      form: {
        grant_type: 'authorization_code',
        code: 'the-code',
        client_id: 'g-id',
        client_secret: 'g-secret',
        redirect_uri: 'https://api.test/cb',
        code_verifier: 'the-verifier',
      },
    });
    expect(calls[1]?.headers['authorization']).toBe('Bearer tok');
    expect(profile).toEqual({
      providerUserId: '1',
      email: 'cat@example.com',
      emailVerified: true,
      displayName: 'Cat',
    });
  });

  it('does not trust an email Google has not verified', async () => {
    const { http } = fakeFetch({ body: { sub: '1', email: 'a@b.co', email_verified: false } });
    expect((await new GoogleProvider(keys, http).fetchProfile('tok')).emailVerified).toBe(false);
  });

  it('fails when the code is refused', async () => {
    const { http } = fakeFetch({ status: 400, body: { error: 'invalid_grant' } });
    await expect(new GoogleProvider(keys, http).exchangeCode(EXCHANGE)).rejects.toThrow(
      OAuthProviderError,
    );
  });
});

describe('Yandex', () => {
  const keys = { clientId: 'y-id', clientSecret: 'y-secret' };

  it('asks for the code with PKCE and the email', () => {
    const url = new URL(new YandexProvider(keys).buildAuthUrl(AUTH));
    expect(`${url.origin}${url.pathname}`).toBe('https://oauth.yandex.ru/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'y-id',
      scope: 'login:email login:info',
      code_challenge_method: 'S256',
    });
  });

  it('trades the code for a token and reads the profile with the OAuth header', async () => {
    const { http, calls } = fakeFetch(
      { body: { access_token: 'tok', token_type: 'bearer' } },
      { body: { id: '42', default_email: 'Cat@Yandex.ru', display_name: 'Кот' } },
    );
    const provider = new YandexProvider(keys, http);

    const profile = await provider.fetchProfile(await provider.exchangeCode(EXCHANGE));

    expect(calls[0]).toMatchObject({
      url: 'https://oauth.yandex.ru/token',
      form: {
        grant_type: 'authorization_code',
        code: 'the-code',
        client_id: 'y-id',
        client_secret: 'y-secret',
        code_verifier: 'the-verifier',
      },
    });
    expect(calls[1]?.url).toBe('https://login.yandex.ru/info?format=json');
    expect(calls[1]?.headers['authorization']).toBe('OAuth tok');
    expect(profile).toEqual({
      providerUserId: '42',
      email: 'cat@yandex.ru',
      emailVerified: true,
      displayName: 'Кот',
    });
  });

  it('has no email when the learner did not share it', async () => {
    const { http } = fakeFetch({ body: { id: '42' } });
    expect(await new YandexProvider(keys, http).fetchProfile('tok')).toMatchObject({
      email: null,
      emailVerified: false,
    });
  });
});

describe('VK ID', () => {
  const keys = { clientId: 'vk-id' };

  it('asks for the code with PKCE and the email', () => {
    const url = new URL(new VkProvider(keys).buildAuthUrl(AUTH));
    expect(`${url.origin}${url.pathname}`).toBe('https://id.vk.ru/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'vk-id',
      scope: 'vkid.personal_info email',
      code_challenge_method: 'S256',
    });
  });

  it('sends the device id of the redirect back with the code', async () => {
    const { http, calls } = fakeFetch({ body: { access_token: 'tok', user_id: 7 } });
    await new VkProvider(keys, http).exchangeCode({ ...EXCHANGE, query: { device_id: 'dev-1' } });
    expect(calls[0]).toMatchObject({
      url: 'https://id.vk.ru/oauth2/auth',
      form: {
        grant_type: 'authorization_code',
        code: 'the-code',
        code_verifier: 'the-verifier',
        client_id: 'vk-id',
        device_id: 'dev-1',
        state: 'the-state',
      },
    });
    expect(calls[0]?.form['service_token']).toBeUndefined();
  });

  it('sends the service key when the app has one', async () => {
    const { http, calls } = fakeFetch({ body: { access_token: 'tok' } });
    await new VkProvider({ ...keys, serviceToken: 'svc' }, http).exchangeCode({
      ...EXCHANGE,
      query: { device_id: 'dev-1' },
    });
    expect(calls[0]?.form['service_token']).toBe('svc');
  });

  it('fails without the device id', async () => {
    await expect(new VkProvider(keys, fakeFetch().http).exchangeCode(EXCHANGE)).rejects.toThrow(
      /device_id/,
    );
  });

  it('reads the profile from the top level of the answer', async () => {
    const { http, calls } = fakeFetch({
      body: { user_id: '7', first_name: 'Кот', last_name: 'Гамбит', email: 'Cat@Mail.ru' },
    });
    const profile = await new VkProvider(keys, http).fetchProfile('tok');
    expect(calls[0]).toMatchObject({
      url: 'https://id.vk.ru/oauth2/user_info',
      form: { access_token: 'tok', client_id: 'vk-id' },
    });
    expect(profile).toEqual({
      providerUserId: '7',
      email: 'cat@mail.ru',
      emailVerified: true,
      displayName: 'Кот Гамбит',
    });
  });

  it('reads the profile from under the user key as well', async () => {
    const { http } = fakeFetch({ body: { user: { user_id: 7, first_name: 'Кот' } } });
    expect(await new VkProvider(keys, http).fetchProfile('tok')).toMatchObject({
      providerUserId: '7',
      displayName: 'Кот',
      email: null,
    });
  });
});
