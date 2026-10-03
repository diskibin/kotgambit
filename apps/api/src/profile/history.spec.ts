import { describe, expect, it } from 'vitest';
import { monthDays, ratingHistory, type RatedAttempt } from './history.js';

const GOAL = 600;

describe('the month of the calendar', () => {
  it('lists every day of the month of today and marks the days that reached the goal', () => {
    const days = monthDays(
      '2026-09-14',
      [
        { day: '2026-09-02', seconds: GOAL },
        { day: '2026-09-03', seconds: GOAL - 1 },
        { day: '2026-08-31', seconds: GOAL },
      ],
      GOAL,
    );
    expect(days).toHaveLength(30);
    expect(days[0]?.day).toBe('2026-09-01');
    expect(days.at(-1)?.day).toBe('2026-09-30');
    expect(days.filter((d) => d.done).map((d) => d.day)).toEqual(['2026-09-02']);
    expect(days.filter((d) => d.today).map((d) => d.day)).toEqual(['2026-09-14']);
  });

  it('knows a leap February', () => {
    expect(monthDays('2028-02-10', [], GOAL)).toHaveLength(29);
  });
});

const attempt = (day: string, before: number, after: number): RatedAttempt => ({
  startedAt: new Date(`${day}T12:00:00Z`),
  ratingBefore: before,
  ratingAfter: after,
});

describe('the rating over the weeks', () => {
  it('has nothing to show before the first rated attempt', () => {
    expect(ratingHistory('2026-10-03', [])).toEqual([]);
  });

  it('takes the last rating of each week and keeps it through quiet weeks', () => {
    const history = ratingHistory('2026-10-03', [
      attempt('2026-09-01', 1000, 1012),
      attempt('2026-09-05', 1012, 1030),
      attempt('2026-09-29', 1030, 1024),
    ]);
    expect(history).toHaveLength(8);
    expect(history.at(-1)).toEqual({ day: '2026-10-03', rating: 1024 });
    expect(history.at(-2)).toEqual({ day: '2026-09-26', rating: 1030 });
    expect(history[0]).toEqual({ day: '2026-08-15', rating: 1000 });
  });

  it('ends today and goes back in whole weeks', () => {
    const history = ratingHistory('2026-10-03', [attempt('2026-10-01', 1000, 1010)]);
    expect(history.map((point) => point.day)).toEqual([
      '2026-08-15',
      '2026-08-22',
      '2026-08-29',
      '2026-09-05',
      '2026-09-12',
      '2026-09-19',
      '2026-09-26',
      '2026-10-03',
    ]);
  });
});
