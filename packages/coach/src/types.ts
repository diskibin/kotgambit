import type { Mood } from '@kotgambit/mascot';

export type Tone = 'neutral' | 'success' | 'oops' | 'hint' | 'demo' | 'celebrate' | 'soft';
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
      detail?: string | undefined;
      attempts: number;
      /** Steps solved correctly in a row, this one included. */
      streak: number;
    }
  | { type: 'STEP_WRONG'; detail?: string | undefined; attempts: number }
  | { type: 'HINT'; level: 1 | 2 | 3; detail?: string }
  | { type: 'DEMO'; detail?: string }
  /** `accuracy` is the share of steps solved on the first try, from 0 to 1. */
  | { type: 'LESSON_COMPLETED'; accuracy: number }
  /** A puzzle has just been shown. */
  | { type: 'PUZZLE_START' }
  /** `streak` counts the puzzles solved cleanly in a row, this one included. */
  | { type: 'PUZZLE_SOLVED'; streak: number }
  | { type: 'PUZZLE_WRONG' }
  /** `themes` are the Russian names of the puzzle's ideas, shown by the second level. */
  | { type: 'PUZZLE_HINT'; level: 1 | 2 | 3; themes?: readonly string[] }
  /** The learner asked to see the solution. */
  | { type: 'PUZZLE_SOLUTION' }
  | { type: 'GAME_START' }
  /** The learner has moved and the bot is thinking. */
  | { type: 'GAME_MOVE' }
  /** The learner's king is under attack. */
  | { type: 'GAME_CHECK' }
  | { type: 'GAME_PROMOTION' }
  /** `san` is the move the hint points at, written the way a player reads it. */
  | { type: 'GAME_HINT'; san: string }
  | { type: 'GAME_UNDO' }
  | { type: 'GAME_RESIGN_ASK' }
  /** The engine did not answer in time, the position is saved. */
  | { type: 'GAME_BUSY' }
  | { type: 'GAME_OVER'; outcome: GameOutcome; reason: GameEndReason };

export type GameOutcome = 'win' | 'loss' | 'draw';
export type GameEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'fifty-moves'
  | 'threefold-repetition'
  | 'resignation';

export interface Phrase {
  title: string;
  text: string;
}
