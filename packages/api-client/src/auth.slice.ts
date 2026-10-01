import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

export interface AuthState {
  /** Kept in memory only, never persisted. */
  accessToken: string | null;
  status: AuthStatus;
}

const initialState: AuthState = { accessToken: null, status: 'unknown' };

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    tokenReceived(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      state.status = 'authenticated';
    },
    sessionEnded(state) {
      state.accessToken = null;
      state.status = 'anonymous';
    },
  },
});

export const { tokenReceived, sessionEnded } = authSlice.actions;
