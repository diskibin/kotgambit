import { dayKeyOf, shiftDay, type DayKey } from '../progress/streak.js';

const WEEK_DAYS = 7;
export const RATING_WEEKS = 8;

interface ActiveDay {
  day: DayKey;
  seconds: number;
}

/** Every day of the month of `today`, with the ones that reached the goal. */
export function monthDays(
  today: DayKey,
  days: readonly ActiveDay[],
  goalSeconds: number,
): { day: DayKey; done: boolean; today: boolean }[] {
  const reached = new Set(days.filter((d) => d.seconds >= goalSeconds).map((d) => d.day));
  const first = `${today.slice(0, 8)}01`;
  const result: { day: DayKey; done: boolean; today: boolean }[] = [];
  for (let day = first; day.slice(0, 7) === today.slice(0, 7); day = shiftDay(day, 1)) {
    result.push({ day, done: reached.has(day), today: day === today });
  }
  return result;
}

export interface RatedAttempt {
  startedAt: Date;
  ratingBefore: number;
  ratingAfter: number;
}

/**
 * The rating at the end of each of the last eight weeks. A week without attempts keeps the rating of the one
 * before it, and the weeks before the first attempt start from the rating that attempt started at.
 * `attempts` must be sorted from the oldest.
 */
export function ratingHistory(
  today: DayKey,
  attempts: readonly RatedAttempt[],
): { day: DayKey; rating: number }[] {
  const first = attempts[0];
  if (!first) return [];
  return Array.from({ length: RATING_WEEKS }, (_, index) => {
    const day = shiftDay(today, (index - (RATING_WEEKS - 1)) * WEEK_DAYS);
    const last = attempts.findLast((attempt) => dayKeyOf(attempt.startedAt) <= day);
    return { day, rating: last ? last.ratingAfter : first.ratingBefore };
  });
}
