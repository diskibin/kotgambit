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
// A 401 from these means "wrong credentials", not "expired token", so refreshing would not help
const NO_REFRESH_URLS = ['/auth/login', '/auth/register', REFRESH_URL];

export type KotGambitBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export interface BaseQueryOptions {
  baseUrl: string;
  session: SessionAdapter;
  fetchFn?: typeof fetch;
}

function urlOf(args: string | FetchArgs): string {
  return typeof args === 'string' ? args : args.url;
}

export function createBaseQuery({
  baseUrl,
  session,
  fetchFn,
}: BaseQueryOptions): KotGambitBaseQuery {
  const rawQuery = fetchBaseQuery({
    baseUrl,
    // Sends the httpOnly refresh cookie on web
    credentials: 'include',
    ...(fetchFn ? { fetchFn } : {}),
    prepareHeaders: (headers) => {
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
