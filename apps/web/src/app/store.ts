import { gameSessionReducer } from '@kotgambit/game-player';
import { lessonSessionReducer } from '@kotgambit/lesson-player';
import { puzzleSessionReducer } from '@kotgambit/puzzle-player';
import { authSlice, sessionEnded, tokenReceived } from '@kotgambit/api-client';
import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { DEFAULT_PREFERENCES, type Preferences } from '@kotgambit/preferences';
import { loadPreferences, persistPreferences } from '../features/settings/preferencesStorage';
import { uiSlice } from '../features/settings/ui.slice';
import { themeSlice } from '../features/theme/theme.slice';
import { api, sessionBridge } from './api';

/** `preferences` are what the learner chose on this device earlier, tests start from the defaults. */
export function makeStore(preferences: Preferences = DEFAULT_PREFERENCES) {
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
      gameSession: gameSessionReducer,
      lessonSession: lessonSessionReducer,
      puzzleSession: puzzleSessionReducer,
      theme: themeSlice.reducer,
      ui: uiSlice.reducer,
    },
    preloadedState: {
      theme: { preference: preferences.theme },
      ui: {
        boardTheme: preferences.boardTheme,
        pieceSet: preferences.pieceSet,
        coordinates: preferences.coordinates,
        reduceMotion: preferences.reduceMotion,
      },
    },
    middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(api.middleware),
  });

  sessionBridge.getAccessToken = () => store.getState().auth.accessToken;
  sessionBridge.setAccessToken = (token) => store.dispatch(tokenReceived(token));
  sessionBridge.onSessionExpired = () => store.dispatch(sessionEnded());
  return store;
}

export const store = makeStore(loadPreferences());
persistPreferences(store);
// Lets the queries that ask for it read again when the tab gets back in focus, such as the Premium status
setupListeners(store.dispatch);

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
