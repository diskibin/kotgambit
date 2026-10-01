import {
  createBaseQuery,
  endpoints,
  REDUCER_PATH,
  TAG_TYPES,
  type SessionAdapter,
} from '@kotgambit/api-client';
import { createApi } from '@reduxjs/toolkit/query/react';

// 10.0.2.2 is how the Android emulator reaches the host machine; release builds get their URL
// together with the release configuration.
const API_URL = 'http://10.0.2.2:3000';

/**
 * The api is created before the store, but the session lives in the store.
 * `makeStore` fills in these functions, they are only called when a request runs.
 */
export const sessionBridge: Pick<
  SessionAdapter,
  'getAccessToken' | 'setAccessToken' | 'onSessionExpired'
> = {
  getAccessToken: () => null,
  setAccessToken: () => undefined,
  onSessionExpired: () => undefined,
};

// The refresh token adapter (Keychain/Keystore) arrives together with the sign-in screens
const session: SessionAdapter = {
  getAccessToken: () => sessionBridge.getAccessToken(),
  setAccessToken: (token) => sessionBridge.setAccessToken(token),
  onSessionExpired: () => sessionBridge.onSessionExpired(),
};

export const api = createApi({
  reducerPath: REDUCER_PATH,
  baseQuery: createBaseQuery({ baseUrl: API_URL, session }),
  tagTypes: TAG_TYPES,
  endpoints,
});

export const {
  useHealthQuery,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useRegisterMutation,
} = api;
