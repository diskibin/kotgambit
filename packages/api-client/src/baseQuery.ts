import { AuthResponseSchema } from '@kotgambit/contracts';
import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query';
import { Mutex } from 'async-mutex';
import type { SessionAdapter } from './session.js';

const UNAUTHORIZED = 401;
const REFRESH_URL = '/auth/refresh';
const REFRESH_LOCK = 'kotgambit-refresh';
// A 401 from these means "wrong credentials", not "expired token", so refreshing would not help
const NO_REFRESH_URLS = ['/auth/login', '/auth/register', REFRESH_URL];

export type KotGambitBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export interface BaseQueryOptions {
  baseUrl: string;
  session: SessionAdapter;
  fetchFn?: typeof fetch;
  /** Sent with every request, for example the header that marks the mobile client. */
  headers?: Record<string, string>;
}

/**
 * The mutex only covers one tab, yet all tabs of a browser share one refresh cookie. The Web Locks
 * API orders their refreshes; where it is missing (mobile, old browsers) there is one client anyway.
 */
function withTabLock<T>(work: () => Promise<T>): Promise<T> {
  // This package is built without the DOM lib, so the slice of the API that is used is typed here
  const locks = (
    globalThis as {
      navigator?: { locks?: { request<R>(name: string, work: () => Promise<R>): Promise<R> } };
    }
  ).navigator?.locks;
  return locks ? locks.request(REFRESH_LOCK, work) : work();
}

function urlOf(args: string | FetchArgs): string {
  return typeof args === 'string' ? args : args.url;
}

export function createBaseQuery({
  baseUrl,
  session,
  fetchFn,
  headers: extraHeaders = {},
}: BaseQueryOptions): KotGambitBaseQuery {
  const rawQuery = fetchBaseQuery({
    baseUrl,
    // Sends the httpOnly refresh cookie on web
    credentials: 'include',
    ...(fetchFn ? { fetchFn } : {}),
    prepareHeaders: (headers) => {
      for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);
      const token = session.getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  });
  // One refresh at a time: parallel 401s wait for it and reuse its result
  const mutex = new Mutex();

  async function refresh(
    api: Parameters<KotGambitBaseQuery>[1],
    extra: Parameters<KotGambitBaseQuery>[2],
  ) {
    // Read inside the lock: a tab that waited reads the cookie or token the other tab just rotated
    return withTabLock(async () => {
      const refreshToken = (await session.getRefreshToken?.()) ?? undefined;
      const result = await rawQuery(
        { url: REFRESH_URL, method: 'POST', ...(refreshToken ? { body: { refreshToken } } : {}) },
        api,
        extra,
      );
      const parsed = AuthResponseSchema.safeParse(result.data);
      if (!parsed.success) return false;
      session.setAccessToken(parsed.data.accessToken);
      if (parsed.data.refreshToken) await session.setRefreshToken?.(parsed.data.refreshToken);
      return true;
    });
  }

  return async (args, api, extra) => {
    await mutex.waitForUnlock();
    let result = await rawQuery(args, api, extra);

    const canRefresh = !NO_REFRESH_URLS.includes(urlOf(args));
    if (result.error?.status !== UNAUTHORIZED || !canRefresh) return result;

    if (mutex.isLocked()) {
      await mutex.waitForUnlock();
    } else {
      const release = await mutex.acquire();
      try {
        if (!(await refresh(api, extra))) {
          session.onSessionExpired();
          return result;
        }
      } finally {
        release();
      }
    }
    result = await rawQuery(args, api, extra);
    return result;
  };
}
