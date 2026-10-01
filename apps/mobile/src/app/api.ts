import { CLIENT_HEADER, MOBILE_CLIENT } from '@kotgambit/contracts';
import {
  createBaseQuery,
  endpoints,
  REDUCER_PATH,
  TAG_TYPES,
  type SessionAdapter,
} from '@kotgambit/api-client';
import { createApi } from '@reduxjs/toolkit/query/react';
import { getRefreshToken, saveRefreshToken } from './refreshTokenStorage';

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

const session: SessionAdapter = {
  getAccessToken: () => sessionBridge.getAccessToken(),
  setAccessToken: (token) => sessionBridge.setAccessToken(token),
  getRefreshToken,
  setRefreshToken: saveRefreshToken,
  onSessionExpired: () => sessionBridge.onSessionExpired(),
};

export const api = createApi({
  reducerPath: REDUCER_PATH,
  // The marker header makes the API return the refresh token in the body, there are no cookies here
  baseQuery: createBaseQuery({
    baseUrl: API_URL,
    session,
    headers: { [CLIENT_HEADER]: MOBILE_CLIENT },
  }),
  tagTypes: TAG_TYPES,
  endpoints,
});

export const {
  useForgotPasswordMutation,
  useHealthQuery,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useRegisterMutation,
  useResendVerificationMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
} = api;
