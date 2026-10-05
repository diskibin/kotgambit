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

// https://developers.google.com/identity/openid-connect/openid-connect
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export class GoogleProvider implements OAuthProviderAdapter {
  readonly id = 'google' as const;

  constructor(
    private readonly keys: { clientId: string; clientSecret: string },
    private readonly http: FetchFn = fetch,
  ) {}

  buildAuthUrl({ state, codeChallenge, redirectUri }: AuthUrlParams): string {
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      client_id: this.keys.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      // The learner may have several Google accounts, the browser should not pick one silently
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  async exchangeCode({ code, codeVerifier, redirectUri }: ExchangeParams): Promise<string> {
    const response = await this.http(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.keys.clientId,
        client_secret: this.keys.clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
      signal: timeout(),
    });
    return accessTokenOf(await readJson(response, 'Google token endpoint'), 'Google');
  }

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await this.http(USERINFO_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: timeout(),
    });
    const body = await readJson(response, 'Google userinfo');
    const providerUserId = text(body['sub']);
    if (!providerUserId) throw new OAuthProviderError('Google did not return the id of the user');
    const verified = body['email_verified'];
    return {
      providerUserId,
      email: text(body['email'])?.toLowerCase() ?? null,
      // Documented as a boolean, older answers carried the string "true"
      emailVerified: verified === true || verified === 'true',
      displayName: text(body['name']),
    };
  }
}
