import {
  createBaseQuery,
  endpoints,
  REDUCER_PATH,
  TAG_TYPES,
  type SessionAdapter,
} from '@kotgambit/api-client';
import { createApi } from '@reduxjs/toolkit/query/react';

const DEFAULT_API_URL = 'http://localhost:3000';

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
  onSessionExpired: () => sessionBridge.onSessionExpired(),
};

export const api = createApi({
  reducerPath: REDUCER_PATH,
  baseQuery: createBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
    session,
  }),
  tagTypes: TAG_TYPES,
  endpoints,
});

export const {
  useActiveGameQuery,
  useBotsQuery,
  useCreateGameMutation,
  useGameBotMoveMutation,
  useGameHintMutation,
  useGameMoveMutation,
  useGameQuery,
  useGameResignMutation,
  useGameUndoMutation,
  useCompleteLessonMutation,
  useDailyPuzzleQuery,
  useForgotPasswordMutation,
  useHealthQuery,
  useLazyGameQuery,
  useLessonQuery,
  useLessonsQuery,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useNextPuzzleMutation,
  useProgressQuery,
  usePuzzleGiveUpMutation,
  usePuzzleHintMutation,
  usePuzzleMoveMutation,
  usePuzzleStatsQuery,
  usePuzzleThemesQuery,
  useRegisterMutation,
  useResendVerificationMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
} = api;
