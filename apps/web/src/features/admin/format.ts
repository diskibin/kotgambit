const KOPECKS_IN_RUBLE = 100;
const PERCENT = 100;

const numbers = new Intl.NumberFormat('ru-RU');

export const formatCount = (value: number): string => numbers.format(value);

export const formatRubles = (kopecks: number): string =>
  `${numbers.format(Math.round(kopecks / KOPECKS_IN_RUBLE))} ₽`;

/** A share as a whole percent, 0 when there is nothing to divide by. */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * PERCENT) : 0;
}

/** `06.10` from `2026-10-06`: the year is clear from the period. */
export function shortDay(day: string): string {
  const [, month, date] = day.split('-');
  return `${date}.${month}`;
}
