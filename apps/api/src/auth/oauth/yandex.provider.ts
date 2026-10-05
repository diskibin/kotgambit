import {
  accessTokenOf,
  OAuthProviderError,
  readJson,
  text,
  timeout,
  type AuthUrlParams,
  type ExchangeParams,
  type FetchFn,
  type OAuthProfile,
  type OAuthProviderAdapter,
} from './oauth-provider.js';

// https://yandex.ru/dev/id/doc/ru/codes/code-url and https://yandex.ru/dev/id/doc/ru/user-information
const AUTH_URL = 'https://oauth.yandex.ru/authorize';
const TOKEN_URL = 'https://oauth.yandex.ru/token';
const INFO_URL = 'https://login.yandex.ru/info?format=json';

export class YandexProvider implements OAuthProviderAdapter {
  readonly id = 'yandex' as const;

  constructor(
    private readonly keys: { clientId: string; clientSecret: string },
    private readonly http: FetchFn = fetch,
  ) {}

  buildAuthUrl({ state, codeChallenge, redirectUri }: AuthUrlParams): string {
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.keys.clientId,
      redirect_uri: redirectUri,
      scope: 'login:email login:info',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async exchangeCode({ code, codeVerifier }: ExchangeParams): Promise<string> {
    const response = await this.http(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.keys.clientId,
        client_secret: this.keys.clientSecret,
        code_verifier: codeVerifier,
      }),
      signal: timeout(),
    });
    return accessTokenOf(await readJson(response, 'Yandex token endpoint'), 'Yandex');
  }

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await this.http(INFO_URL, {
      // Yandex wants the word OAuth here, not Bearer
      headers: { authorization: `OAuth ${accessToken}` },
      signal: timeout(),
    });
    const body = await readJson(response, 'Yandex user info');
    const providerUserId = text(body['id']);
    if (!providerUserId) throw new OAuthProviderError('Yandex did not return the id of the user');
    const email = text(body['default_email'])?.toLowerCase() ?? null;
    return {
      providerUserId,
      email,
      // The address of a Yandex account is its own or one that Yandex has confirmed
      emailVerified: email !== null,
      displayName:
        text(body['display_name']) ?? text(body['real_name']) ?? text(body['first_name']),
    };
  }
}
