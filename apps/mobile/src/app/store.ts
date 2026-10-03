import { gameSessionReducer } from '@kotgambit/game-player';
import { lessonSessionReducer } from '@kotgambit/lesson-player';
import { puzzleSessionReducer } from '@kotgambit/puzzle-player';
import { authSlice, sessionEnded, tokenReceived } from '@kotgambit/api-client';
import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { api, sessionBridge } from './api';
import { clearRefreshToken, saveRefreshToken } from './refreshTokenStorage';

export function makeStore() {
  const listener = createListenerMiddleware();

  // Sign-in and sign-up both end with a token
  for (const endpoint of [api.endpoints.login, api.endpoints.register]) {
    listener.startListening({
      matcher: endpoint.matchFulfilled,
      effect: async (action, { dispatch }) => {
        // The access token first: the profile request that the sign-in invalidates must already carry it
        dispatch(tokenReceived(action.payload.accessToken));
        if (action.payload.refreshToken) await saveRefreshToken(action.payload.refreshToken);
      },
    });
  }
  const store = configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      auth: authSlice.reducer,
      gameSession: gameSessionReducer,
      lessonSession: lessonSessionReducer,
      puzzleSession: puzzleSessionReducer,
    },
    middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(api.middleware),
  });

  sessionBridge.getAccessToken = () => store.getState().auth.accessToken;
  sessionBridge.setAccessToken = (token) => store.dispatch(tokenReceived(token));
  sessionBridge.onSessionExpired = () => {
    void clearRefreshToken();
    store.dispatch(sessionEnded());
  };
  return store;
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
