import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeState {
  preference: ThemePreference;
}

const initialState: ThemeState = { preference: 'system' };

export const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    preferenceChanged(state, action: PayloadAction<ThemePreference>) {
      state.preference = action.payload;
    },
  },
});

export const { preferenceChanged } = themeSlice.actions;
