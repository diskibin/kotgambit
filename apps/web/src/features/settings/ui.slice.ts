import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_PREFERENCES, type BoardTheme, type Preferences } from '@kotgambit/preferences';

/** What the learner chose for the board and for motion. The theme has its own slice. */
export type UiState = Pick<Preferences, 'boardTheme' | 'coordinates' | 'reduceMotion'>;

export const initialUiState: UiState = {
  boardTheme: DEFAULT_PREFERENCES.boardTheme,
  coordinates: DEFAULT_PREFERENCES.coordinates,
  reduceMotion: DEFAULT_PREFERENCES.reduceMotion,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    boardThemeChanged(state, action: PayloadAction<BoardTheme>) {
      state.boardTheme = action.payload;
    },
    coordinatesChanged(state, action: PayloadAction<boolean>) {
      state.coordinates = action.payload;
    },
    reduceMotionChanged(state, action: PayloadAction<boolean>) {
      state.reduceMotion = action.payload;
    },
  },
});

export const { boardThemeChanged, coordinatesChanged, reduceMotionChanged } = uiSlice.actions;
