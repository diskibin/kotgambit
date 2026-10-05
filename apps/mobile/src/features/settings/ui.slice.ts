import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  DEFAULT_PREFERENCES,
  type BoardTheme,
  type PieceSet,
  type Preferences,
  type ThemePreference,
} from '@kotgambit/preferences';

/** What the learner chose on this phone. `loaded` is false until the saved choices have been read. */
export type UiState = Preferences & { loaded: boolean };

export const initialUiState: UiState = { ...DEFAULT_PREFERENCES, loaded: false };

export const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    preferencesLoaded(_state, action: PayloadAction<Preferences>) {
      return { ...action.payload, loaded: true };
    },
    themeChanged(state, action: PayloadAction<ThemePreference>) {
      state.theme = action.payload;
    },
    boardThemeChanged(state, action: PayloadAction<BoardTheme>) {
      state.boardTheme = action.payload;
    },
    pieceSetChanged(state, action: PayloadAction<PieceSet>) {
      state.pieceSet = action.payload;
    },
    coordinatesChanged(state, action: PayloadAction<boolean>) {
      state.coordinates = action.payload;
    },
    reduceMotionChanged(state, action: PayloadAction<boolean>) {
      state.reduceMotion = action.payload;
    },
    vibrationChanged(state, action: PayloadAction<boolean>) {
      state.vibration = action.payload;
    },
  },
});

export const {
  preferencesLoaded,
  themeChanged,
  boardThemeChanged,
  pieceSetChanged,
  coordinatesChanged,
  reduceMotionChanged,
  vibrationChanged,
} = uiSlice.actions;
