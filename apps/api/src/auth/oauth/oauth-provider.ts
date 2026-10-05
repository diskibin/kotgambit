import type { OAuthProviderId } from '@kotgambit/contracts';

export interface OAuthProfile {
  /** The id of the person at the provider, the stable key of the identity. */
  providerUserId: string;
  email: string | null;
  /** Only an email the provider vouches for may start or join an account. */
  emailVerified: boolean;
  displayName: string | null;
}

export interface AuthUrlParams {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface ExchangeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  state: string;
  /** What else came back in the redirect, such as the `device_id` of VK ID. */
  query: Record<string, string>;
}

/** What the server needs from a provider: the address of the login page, the code exchange and the profile. */
export interface OAuthProviderAdapter {
  readonly id: OAuthProviderId;
  buildAuthUrl(params: AuthUrlParams): string;
  /** Returns the access token. */
  exchangeCode(params: ExchangeParams): Promise<string>;
  fetchProfile(accessToken: string): Promise<OAuthProfile>;
}

/** The providers that have keys, by id. A spec replaces it with fakes. */
export const OAUTH_ADAPTERS = Symbol('OAUTH_ADAPTERS');
export type OAuthAdapters = ReadonlyMap<OAuthProviderId, OAuthProviderAdapter>;

export class OAuthProviderError extends Error {}

export type FetchFn = typeof fetch;

const REQUEST_TIMEOUT_MS = 10_000;

/** A provider that hangs must not hang the sign-in of the learner. */
export function timeout(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function text(value: unknown): string | null {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export async function readJson(response: Response, what: string): Promise<Record<string, unknown>> {
  if (!response.ok) throw new OAuthProviderError(`${what} answered ${response.status}`);
  return asRecord(await response.json());
}

export function accessTokenOf(body: Record<string, unknown>, what: string): string {
  const token = text(body['access_token']);
  if (!token) throw new OAuthProviderError(`${what} did not return an access token`);
  return token;
}
