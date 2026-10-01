import type { Mood } from '@kotgambit/mascot';

export type Tone = 'success' | 'oops' | 'hint' | 'demo' | 'celebrate' | 'soft';
export type Effect = 'confetti' | 'shake' | 'none';

/** What the cat says: the apps only show it, they never write texts of their own. */
export interface CoachMessage {
  title: string;
  text: string;
  mascot: Mood;
  tone: Tone;
  effect: Effect;
}

/** Correct answers in a row at which the cat notices the streak. */
export const STREAK_NOTICE = 3;
/** Failed attempts after which the cat offers a hint on its own. */
export const HINT_OFFER_ATTEMPTS = 2;

export type CoachEvent =
  | {
      type: 'STEP_CORRECT';
      /** The explanation written for this step, shown instead of a generic line. */
      detail?: string;
      attempts: number;
      /** Steps solved correctly in a row, this one included. */
      streak: number;
    }
  | { type: 'STEP_WRONG'; detail?: string; attempts: number }
  | { type: 'HINT'; level: 1 | 2 | 3; detail?: string }
  | { type: 'DEMO'; detail?: string }
  /** `accuracy` is the share of steps solved on the first try, from 0 to 1. */
  | { type: 'LESSON_COMPLETED'; accuracy: number };

export interface Phrase {
  title: string;
  text: string;
}
