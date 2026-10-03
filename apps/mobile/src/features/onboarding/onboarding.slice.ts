import { tokenReceived } from '@kotgambit/api-client';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export const LEVELS = ['novice', 'basics', 'player'] as const;
export type Level = (typeof LEVELS)[number];
export const GOALS = [5, 10, 15] as const;
export type Goal = (typeof GOALS)[number];

// The first chapter of every level. The numbers are those of the lesson files in content/lessons
export const FIRST_LESSON: Record<Level, { id: string; minutes: number; steps: number }> = {
  novice: { id: 'basics-board', minutes: 5, steps: 5 },
  basics: { id: 'basics-knight', minutes: 6, steps: 6 },
  player: { id: 'openings-italian', minutes: 6, steps: 5 },
};

interface OnboardingState {
  /** The goal waits for the account: the server has nowhere to keep it before that. */
  pendingGoal: Goal | null;
  /** The chapter to open right after signing up, when the learner asked for it. */
  firstLesson: string | null;
  /** Someone has signed in on this run of the app, so a sign-out leads back to the sign-in, not to the first steps. */
  hadSession: boolean;
}

export const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState: { pendingGoal: null, firstLesson: null, hadSession: false } as OnboardingState,
  reducers: {
    answered(state, action: PayloadAction<{ goal: Goal; lesson: string | null }>) {
      return { ...state, pendingGoal: action.payload.goal, firstLesson: action.payload.lesson };
    },
    goalApplied(state) {
      state.pendingGoal = null;
    },
    firstLessonOpened(state) {
      state.firstLesson = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(tokenReceived, (state) => {
      state.hadSession = true;
    });
  },
});

export const { answered, goalApplied, firstLessonOpened } = onboardingSlice.actions;
