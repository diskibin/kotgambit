import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** The longest streak the learner has been told about during this run of the app. */
export const streakSlice = createSlice({
  name: 'streak',
  initialState: { seen: null as number | null },
  reducers: {
    streakSeen(state, action: PayloadAction<number>) {
      state.seen = action.payload;
    },
  },
});

export const { streakSeen } = streakSlice.actions;
