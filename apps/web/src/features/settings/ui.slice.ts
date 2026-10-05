import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  DEFAULT_PREFERENCES,
  type BoardTheme,
  type PieceSet,
  type Preferences,
} from '@kotgambit/preferences';

/** What the learner chose for the board and for motion. The theme has its own slice. */
export type UiState = Pick<Preferences, 'boardTheme' | 'pieceSet' | 'coordinates' | 'reduceMotion'>;

export const initialUiState: UiState = {
  boardTheme: DEFAULT_PREFERENCES.boardTheme,
  pieceSet: DEFAULT_PREFERENCES.pieceSet,
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
    pieceSetChanged(state, action: PayloadAction<PieceSet>) {
      state.pieceSet = action.payload;
    },
    coordinatesChanged(state, action: PayloadAction<boolean>) {
      state.coordinates = action.payload;
    },
    reduceMotionChanged(state, action: PayloadAction<boolean>) {
      state.reduceMotion = action.payload;
    },
  },
});

export const { boardThemeChanged, pieceSetChanged, coordinatesChanged, reduceMotionChanged } =
  uiSlice.actions;
