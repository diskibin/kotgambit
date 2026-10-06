const MS_IN_DAY = 24 * 60 * 60 * 1000;
const DAY_KEY_LENGTH = 10;

/** `YYYY-MM-DD` of a moment, in UTC: the days of the admin page are UTC days, as the daily limits are. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, DAY_KEY_LENGTH);
}

/** The first moment of the oldest day of a period of `days` days that ends with today. */
export function periodStart(now: Date, days: number): Date {
  const today = new Date(`${dayKey(now)}T00:00:00.000Z`);
  return new Date(today.getTime() - (days - 1) * MS_IN_DAY);
}

/** The UTC days from the start of the period to today, oldest first. */
export function periodDays(now: Date, days: number): string[] {
  const start = periodStart(now, days).getTime();
  return Array.from({ length: days }, (_, index) => dayKey(new Date(start + index * MS_IN_DAY)));
}

const PERCENT = 100;

/** A share as a whole percent, 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * PERCENT) : 0;
}

/** The Monday, UTC, of the week a moment falls in. */
export function weekStart(date: Date): Date {
  const day = new Date(`${dayKey(date)}T00:00:00.000Z`);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - sinceMonday * MS_IN_DAY);
}
