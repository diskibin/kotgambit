import type { OAuthProviderId } from '@kotgambit/contracts';
import {
  OAuthProviderError,
  type AuthUrlParams,
  type ExchangeParams,
  type OAuthProfile,
  type OAuthProviderAdapter,
} from '../src/auth/oauth/oauth-provider.js';

export const DEFAULT_PROFILE: OAuthProfile = {
  providerUserId: 'yandex-42',
  email: 'cat@example.com',
  emailVerified: true,
  displayName: 'Гамбит',
};

/** A provider that answers from memory, so the flow can be walked through without the network. */
export class FakeProvider implements OAuthProviderAdapter {
  profile: OAuthProfile = DEFAULT_PROFILE;
  failExchange = false;
  lastVerifier = '';
  lastQuery: Record<string, string> = {};

  constructor(readonly id: OAuthProviderId) {}

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
