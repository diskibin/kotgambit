import { sessionEnded, tokenReceived } from '@kotgambit/api-client';
import { api, sessionBridge } from './api';
import { makeStore } from './store';

describe('app store', () => {
  it('starts without a session', () => {
    expect(makeStore().getState().auth).toEqual({ accessToken: null, status: 'unknown' });
  });

  it('lets the api read and update the session through the bridge', () => {
    const store = makeStore();
    store.dispatch(tokenReceived('token-1'));
    expect(sessionBridge.getAccessToken()).toBe('token-1');

    sessionBridge.setAccessToken('token-2');
    expect(store.getState().auth.accessToken).toBe('token-2');

    sessionBridge.onSessionExpired();
    expect(store.getState().auth).toEqual({ accessToken: null, status: 'anonymous' });
  });

  it('registers the api reducer', () => {
    expect(makeStore().getState()[api.reducerPath]).toBeDefined();
  });

  it('ignores sessionEnded when nobody was signed in', () => {
    const store = makeStore();
    store.dispatch(sessionEnded());
    expect(store.getState().auth.status).toBe('anonymous');
  });
});
