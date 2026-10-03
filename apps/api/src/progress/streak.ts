const MS_IN_DAY = 24 * 60 * 60 * 1000;

/** A calendar day as YYYY-MM-DD. */
export type DayKey = string;

export function dayKeyOf(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

export function shiftDay(day: DayKey, days: number): DayKey {
  return dayKeyOf(new Date(new Date(`${day}T00:00:00Z`).getTime() + days * MS_IN_DAY));
}

/** Whole days between two day keys, `to` minus `from`. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / MS_IN_DAY,
  );
}

/**
 * Days in a row on which the daily goal was reached. A streak is not lost until the day is over:
 * when today's goal is not reached yet, the count goes back from yesterday.
 */
export function computeStreak(
  days: readonly { day: DayKey; seconds: number }[],
  goalSeconds: number,
  today: DayKey,
): number {
  const reached = new Set(days.filter((d) => d.seconds >= goalSeconds).map((d) => d.day));
  let cursor = reached.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (reached.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/** The longest run of days with the goal reached, over all the days given. */
export function bestStreak(
  days: readonly { day: DayKey; seconds: number }[],
  goalSeconds: number,
): number {
  const reached = days
    .filter((d) => d.seconds >= goalSeconds)
    .map((d) => d.day)
    .sort();
  let best = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of reached) {
    if (day === previous) continue;
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}
