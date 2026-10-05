import {
  OAUTH_MOBILE_CALLBACK,
  OAuthErrorSchema,
  OAuthProviderSchema,
  type OAuthError,
  type OAuthProviderId,
} from '@kotgambit/contracts';

export type OAuthDeepLink =
  | { kind: 'code'; code: string }
  | { kind: 'error'; error: OAuthError }
  | { kind: 'link'; ticket: string; provider: OAuthProviderId | null };

/**
 * Reads what the API put in the address that brings the app back from the browser, or `null` for any
 * other address. The address is typed by whoever sends it, so nothing in it is trusted before it is checked.
 */
export function parseOAuthDeepLink(url: string): OAuthDeepLink | null {
  const [base = '', query = ''] = url.split('?', 2);
  if (base !== OAUTH_MOBILE_CALLBACK) return null;
  const params = new URLSearchParams(query);

  const code = params.get('code');
  if (code) return { kind: 'code', code };

  const ticket = params.get('link');
  if (ticket) {
    const provider = OAuthProviderSchema.safeParse(params.get('provider'));
    return { kind: 'link', ticket, provider: provider.success ? provider.data : null };
  }

  const error = OAuthErrorSchema.safeParse(params.get('error'));
  return { kind: 'error', error: error.success ? error.data : 'failed' };
}
