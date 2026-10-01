import { describe, expect, it } from 'vitest';
import { authSlice, sessionEnded, tokenReceived } from './auth.slice.js';

describe('authSlice', () => {
  it('starts with an unknown session', () => {
    expect(authSlice.reducer(undefined, { type: 'init' })).toEqual({
      accessToken: null,
      status: 'unknown',
    });
  });

  it('keeps the token and marks the user as signed in', () => {
    expect(authSlice.reducer(undefined, tokenReceived('abc'))).toEqual({
      accessToken: 'abc',
      status: 'authenticated',
    });
  });

  it('drops the token when the session ends', () => {
    const signedIn = authSlice.reducer(undefined, tokenReceived('abc'));
    expect(authSlice.reducer(signedIn, sessionEnded())).toEqual({
      accessToken: null,
      status: 'anonymous',
    });
  });
});
