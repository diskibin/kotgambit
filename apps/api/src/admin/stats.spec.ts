import { describe, expect, it } from 'vitest';
import { dayKey, periodDays, periodStart } from './stats.js';

describe('the days of a period', () => {
  const now = new Date('2026-10-06T23:30:00.000Z');

  it('ends with today and starts days - 1 days before it', () => {
    expect(periodStart(now, 7).toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(periodDays(now, 3)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06']);
  });

  it('cuts the day at UTC midnight', () => {
    expect(dayKey(new Date('2026-10-06T00:00:00.000Z'))).toBe('2026-10-06');
    expect(dayKey(new Date('2026-10-05T23:59:59.999Z'))).toBe('2026-10-05');
  });

  it('gives one day for a period of one day', () => {
    expect(periodDays(now, 1)).toEqual(['2026-10-06']);
  });
});
