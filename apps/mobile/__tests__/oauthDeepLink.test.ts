import { parseOAuthDeepLink } from '../src/features/auth/oauthDeepLink';

const BASE = 'kotgambit://auth/callback';

describe('parseOAuthDeepLink', () => {
  it('reads the one-time code', () => {
    expect(parseOAuthDeepLink(`${BASE}?code=abc_123-x`)).toEqual({
      kind: 'code',
      code: 'abc_123-x',
    });
  });

  it('reads the reason a sign-in did not finish', () => {
    expect(parseOAuthDeepLink(`${BASE}?error=cancelled`)).toEqual({
      kind: 'error',
      error: 'cancelled',
    });
    expect(parseOAuthDeepLink(`${BASE}?error=no_email`)).toEqual({
      kind: 'error',
      error: 'no_email',
    });
  });

  it('takes an unknown reason for a failure', () => {
    expect(parseOAuthDeepLink(`${BASE}?error=whatever`)).toEqual({
      kind: 'error',
      error: 'failed',
    });
    expect(parseOAuthDeepLink(BASE)).toEqual({ kind: 'error', error: 'failed' });
  });

  it('reads the ticket to link an account with the provider it came from', () => {
    expect(parseOAuthDeepLink(`${BASE}?link=ticket-1&provider=yandex`)).toEqual({
      kind: 'link',
      ticket: 'ticket-1',
      provider: 'yandex',
    });
    expect(parseOAuthDeepLink(`${BASE}?link=ticket-1&provider=github`)).toEqual({
      kind: 'link',
      ticket: 'ticket-1',
      provider: null,
    });
  });

  it('ignores every other address', () => {
    expect(parseOAuthDeepLink('kotgambit://billing/return?code=1')).toBeNull();
    expect(parseOAuthDeepLink('https://example.com/auth/callback?code=1')).toBeNull();
    expect(parseOAuthDeepLink('kotgambit://auth/callback/extra?code=1')).toBeNull();
  });
});
