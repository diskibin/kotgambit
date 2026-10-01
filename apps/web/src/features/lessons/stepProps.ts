import type { LessonDetail } from '@kotgambit/contracts';
import type { Coach } from '@kotgambit/coach';
import type { LessonSession } from '@kotgambit/lesson-player';

/** What the lesson page hands to every step. */
export interface StepContext {
  lesson: LessonDetail;
  session: LessonSession;
  coach: Coach;
  /** "Основы · глава 9 · шаг 2 из 5" */
  caption: string;
}
