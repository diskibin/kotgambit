// Written out instead of read from Intl: the month has to be in the genitive ("с сентября"),
// and the short weekday is the same on every device, including those with a thin Intl
const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'] as const;

const parse = (day: string) => new Date(`${day}T00:00:00Z`);

/** The month of a YYYY-MM-DD day in the genitive: "сентября". */
export function monthGenitive(day: string): string {
  return MONTHS_GENITIVE[parse(day).getUTCMonth()] ?? '';
}

export function yearOf(day: string): number {
  return parse(day).getUTCFullYear();
}

/** "пн", "вт" … for a YYYY-MM-DD day. */
export function weekdayShort(day: string): string {
  return WEEKDAYS_SHORT[parse(day).getUTCDay()] ?? '';
}

/** How full the bar of a level is, from 0 to 100. */
export function levelPercent(xpInLevel: number, xpForNext: number): number {
  return xpForNext > 0 ? Math.min(100, Math.round((xpInLevel / xpForNext) * 100)) : 0;
}
