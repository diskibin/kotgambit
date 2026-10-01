import type { StepType } from '@kotgambit/content-schema';

/**
 * Where the learner is in a lesson. A plain reducer, so that web and mobile keep it in their Redux
 * stores and the rules of a lesson are written (and tested) once.
 */
export interface LessonSession {
  lessonId: string | null;
  stepTypes: StepType[];
  index: number;
  /** Checks made at every step. A task solved at the first try has 1, text and demo steps have 0. */
  attempts: number[];
  /** Tasks solved at the first try in a row, for the cat's praise. */
  firstTryStreak: number;
  /** `working`: the learner is doing the step. After a check it is `correct` or `wrong`. */
  phase: 'working' | 'correct' | 'wrong';
  /** How many hints were asked for at this step, 0 to 3. */
  hintLevel: 0 | 1 | 2 | 3;
  startedAt: number | null;
  finishedAt: number | null;
}

export const initialLessonSession: LessonSession = {
  lessonId: null,
  stepTypes: [],
  index: 0,
  attempts: [],
  firstTryStreak: 0,
  phase: 'working',
  hintLevel: 0,
  startedAt: null,
  finishedAt: null,
};

export type LessonSessionAction =
  | { type: 'lesson/started'; lessonId: string; stepTypes: StepType[]; now: number }
  /** The learner pressed "Check" at a task step. */
  | { type: 'step/checked'; correct: boolean }
  /** After a wrong answer, back to trying. */
  | { type: 'step/retried' }
  | { type: 'hint/requested' }
  /** "Continue" (or "Next" after a text or demo step); the last step finishes the lesson. */
  | { type: 'step/advanced'; now: number }
  | { type: 'lesson/exited' };

const MAX_HINT_LEVEL = 3;
const TASK_STEPS: readonly StepType[] = ['move', 'quiz', 'find-squares'];

export const isTaskStep = (type: StepType | undefined): boolean =>
  type !== undefined && TASK_STEPS.includes(type);

export function lessonSessionReducer(
  state: LessonSession = initialLessonSession,
  action: LessonSessionAction,
): LessonSession {
  switch (action.type) {
    case 'lesson/started':
      return {
        ...initialLessonSession,
        lessonId: action.lessonId,
        stepTypes: action.stepTypes,
        attempts: action.stepTypes.map(() => 0),
        startedAt: action.now,
      };

    case 'step/checked': {
      if (state.lessonId === null || state.phase !== 'working') return state;
      const attempts = state.attempts.map((count, i) => (i === state.index ? count + 1 : count));
      return { ...state, attempts, phase: action.correct ? 'correct' : 'wrong' };
    }

    case 'step/retried':
      return state.phase === 'wrong' ? { ...state, phase: 'working' } : state;

    case 'hint/requested':
      return state.hintLevel >= MAX_HINT_LEVEL || state.phase !== 'working'
        ? state
        : { ...state, hintLevel: (state.hintLevel + 1) as LessonSession['hintLevel'] };

    case 'step/advanced': {
      if (state.lessonId === null) return state;
      const task = isTaskStep(state.stepTypes[state.index]);
      const firstTry = task && state.attempts[state.index] === 1;
      const firstTryStreak = task
        ? firstTry
          ? state.firstTryStreak + 1
          : 0
        : state.firstTryStreak;
      const last = state.index >= state.stepTypes.length - 1;
      return last
        ? { ...state, firstTryStreak, finishedAt: action.now }
        : { ...state, firstTryStreak, index: state.index + 1, phase: 'working', hintLevel: 0 };
    }

    case 'lesson/exited':
      return initialLessonSession;
  }
}

/** What the server wants to know: tries per step in order, at least 1 for steps that cannot be failed. */
export function reportedAttempts(state: LessonSession): number[] {
  return state.attempts.map((count) => Math.max(1, count));
}

export function elapsedSeconds(state: LessonSession): number {
  if (state.startedAt === null || state.finishedAt === null) return 0;
  return Math.max(0, Math.round((state.finishedAt - state.startedAt) / 1000));
}
