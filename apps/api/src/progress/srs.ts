/** The state of one card of spaced repetition, a simplified SM-2 (PLAN.md 6.6). */
export interface Schedule {
  /** Days until the card comes back, 0 for a card that was never answered. */
  intervalDays: number;
  /** How much the interval grows after a right answer. */
  ease: number;
  /** Right answers in a row. */
  repetitions: number;
  /** How many times the card was answered wrong. */
  lapses: number;
}

export const INITIAL_SCHEDULE: Schedule = { intervalDays: 0, ease: 2.5, repetitions: 0, lapses: 0 };

export type Grade = 'correct' | 'wrong';

const FIRST_INTERVAL_DAYS = 1;
const SECOND_INTERVAL_DAYS = 3;
const MIN_EASE = 1.3;
const EASE_PENALTY = 0.2;
// A position is worth keeping fresh, but not worth a visit after half a year
const MAX_INTERVAL_DAYS = 180;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * A wrong answer starts the card over and makes it a little harder to grow again, a right one
 * pushes it further out: 1 day, 3 days, then the last interval times the ease.
 */
export function nextSchedule(schedule: Schedule, grade: Grade): Schedule {
  if (grade === 'wrong') {
    return {
      intervalDays: FIRST_INTERVAL_DAYS,
      ease: Math.max(MIN_EASE, schedule.ease - EASE_PENALTY),
      repetitions: 0,
      lapses: schedule.lapses + 1,
    };
  }
  const repetitions = schedule.repetitions + 1;
  const grown =
    repetitions === 1
      ? FIRST_INTERVAL_DAYS
      : repetitions === 2
        ? SECOND_INTERVAL_DAYS
        : Math.round(schedule.intervalDays * schedule.ease);
  return {
    ...schedule,
    repetitions,
    intervalDays: Math.min(MAX_INTERVAL_DAYS, Math.max(FIRST_INTERVAL_DAYS, grown)),
  };
}

export function dueAfter(now: Date, intervalDays: number): Date {
  return new Date(now.getTime() + intervalDays * MS_IN_DAY);
}
