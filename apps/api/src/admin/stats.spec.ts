import { describe, expect, it } from 'vitest';
import { dayKey, percent, periodDays, periodStart, weekStart } from './stats.js';

describe('weeks and shares', () => {
  it('finds the Monday of a week, UTC', () => {
    // 2026-10-06 is a Tuesday
    expect(dayKey(weekStart(new Date('2026-10-06T23:30:00.000Z')))).toBe('2026-10-05');
    expect(dayKey(weekStart(new Date('2026-10-05T00:00:00.000Z')))).toBe('2026-10-05');
    expect(dayKey(weekStart(new Date('2026-10-11T12:00:00.000Z')))).toBe('2026-10-05');
  });

  it('rounds a share and does not divide by zero', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(3, 0)).toBe(0);
  });
});

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
