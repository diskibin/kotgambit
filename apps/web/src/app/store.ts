import { lessonSessionReducer } from '@kotgambit/lesson-player';
import { puzzleSessionReducer } from '@kotgambit/puzzle-player';
import { authSlice, sessionEnded, tokenReceived } from '@kotgambit/api-client';
import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { themeSlice } from '../features/theme/theme.slice';
import { api, sessionBridge } from './api';

export function makeStore() {
  const listener = createListenerMiddleware();

  // Sign-in and sign-up both end with a token, sign-out with none
  for (const endpoint of [api.endpoints.login, api.endpoints.register]) {
    listener.startListening({
      matcher: endpoint.matchFulfilled,
      effect: (action, { dispatch }) => {
        dispatch(tokenReceived(action.payload.accessToken));
      },
    });
  }
  listener.startListening({
    matcher: api.endpoints.logout.matchFulfilled,
    effect: (_action, { dispatch }) => {
      dispatch(sessionEnded());
    },
  });

  const store = configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      auth: authSlice.reducer,
      lessonSession: lessonSessionReducer,
      puzzleSession: puzzleSessionReducer,
      theme: themeSlice.reducer,
    },
    middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(api.middleware),
  });

  sessionBridge.getAccessToken = () => store.getState().auth.accessToken;
  sessionBridge.setAccessToken = (token) => store.dispatch(tokenReceived(token));
  sessionBridge.onSessionExpired = () => store.dispatch(sessionEnded());
  return store;
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
