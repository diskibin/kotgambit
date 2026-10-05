import {
  accessTokenOf,
  asRecord,
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

// VK ID, https://id.vk.ru/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-integration/api-description
const AUTH_URL = 'https://id.vk.ru/authorize';
const TOKEN_URL = 'https://id.vk.ru/oauth2/auth';
const USER_INFO_URL = 'https://id.vk.ru/oauth2/user_info';

export class VkProvider implements OAuthProviderAdapter {
  readonly id = 'vk' as const;

  constructor(
    private readonly keys: { clientId: string; serviceToken?: string },
    private readonly http: FetchFn = fetch,
  ) {}

  buildAuthUrl({ state, codeChallenge, redirectUri }: AuthUrlParams): string {
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.keys.clientId,
      redirect_uri: redirectUri,
      scope: 'vkid.personal_info email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async exchangeCode({
    code,
    codeVerifier,
    redirectUri,
    state,
    query,
  }: ExchangeParams): Promise<string> {
    // VK sends the id of the device with the code and wants it back
    const deviceId = query['device_id'];
    if (!deviceId) throw new OAuthProviderError('VK ID did not return device_id');
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: this.keys.clientId,
      device_id: deviceId,
      state,
    });
    if (this.keys.serviceToken) form.set('service_token', this.keys.serviceToken);
    const response = await this.http(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: timeout(),
    });
    return accessTokenOf(await readJson(response, 'VK ID token endpoint'), 'VK ID');
  }

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await this.http(USER_INFO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: accessToken, client_id: this.keys.clientId }),
      signal: timeout(),
    });
    const body = await readJson(response, 'VK ID user info');
    // The fields come at the top level in the reference and under `user` in practice, both are read
    const user = { ...body, ...asRecord(body['user']) };
    const providerUserId = text(user['user_id']);
    if (!providerUserId) throw new OAuthProviderError('VK ID did not return the id of the user');
    const email = text(user['email'])?.toLowerCase() ?? null;
    const name = [text(user['first_name']), text(user['last_name'])].filter(Boolean).join(' ');
    return {
      providerUserId,
      email,
      // VK asks the owner to confirm an address with a code, but the docs do not say it in so many words
      emailVerified: email !== null,
      displayName: name === '' ? null : name,
    };
  }
}
