import type { LessonDetail } from '@kotgambit/contracts';
import type { Coach } from '@kotgambit/coach';
import type { LessonSession } from '@kotgambit/lesson-player';
import { useAppDispatch } from '../../app/hooks';

/** What the lesson screen hands to every step. */
export interface StepContext {
  lesson: LessonDetail;
  session: LessonSession;
  coach: Coach;
  /** "Основы · глава 9 · шаг 2 из 5" */
  caption: string;
  /** What the next step is, to tell whether the learner goes on to try it themselves. */
  nextType: LessonDetail['steps'][number]['type'] | null;
}

/** The moves of the lesson session that every step can make. */
export function useStepActions() {
  const dispatch = useAppDispatch();
  return {
    check: (correct: boolean) => dispatch({ type: 'step/checked', correct }),
    retry: () => dispatch({ type: 'step/retried' }),
    hint: () => dispatch({ type: 'hint/requested' }),
    advance: () => dispatch({ type: 'step/advanced', now: Date.now() }),
  };
}
