import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api } from './api';
import { makeStore } from './store';

const BASE_URL = 'http://localhost:3000';
const USER = {
  id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
  email: 'cat@example.com',
  displayName: null,
  emailVerified: false,
  accessory: 'none',
};
const CREDENTIALS = { email: 'cat@example.com', password: 'secret' };

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const loginHandler = () =>
  http.post(`${BASE_URL}/auth/login`, () =>
    HttpResponse.json({ accessToken: 'token-1', expiresIn: 900, user: USER }),
  );

describe('app store', () => {
  it('starts without a session', () => {
    expect(makeStore().getState().auth).toEqual({ accessToken: null, status: 'unknown' });
  });

  it('keeps the access token after signing in', async () => {
    server.use(loginHandler());
    const store = makeStore();
    await store.dispatch(api.endpoints.login.initiate(CREDENTIALS));
    expect(store.getState().auth).toEqual({ accessToken: 'token-1', status: 'authenticated' });
  });

  it('sends the token with later requests and drops it on sign-out', async () => {
    let header: string | null = null;
    server.use(
      loginHandler(),
      http.get(`${BASE_URL}/users/me`, ({ request }) => {
        header = request.headers.get('Authorization');
        return HttpResponse.json(USER);
      }),
      http.post(`${BASE_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
    );
    const store = makeStore();
    await store.dispatch(api.endpoints.login.initiate(CREDENTIALS));
    await store.dispatch(api.endpoints.me.initiate());
    expect(header).toBe('Bearer token-1');

    await store.dispatch(api.endpoints.logout.initiate());
    expect(store.getState().auth).toEqual({ accessToken: null, status: 'anonymous' });
  });

  it('ends the session when the token cannot be refreshed', async () => {
    server.use(
      loginHandler(),
      http.get(`${BASE_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    );
    const store = makeStore();
    await store.dispatch(api.endpoints.login.initiate(CREDENTIALS));
    await store.dispatch(api.endpoints.me.initiate());
    expect(store.getState().auth.status).toBe('anonymous');
  });
});
