import { describe, expect, it } from 'vitest';
import { bestDailyStreak, currentDailyStreak } from './daily-streak.js';

describe('the streak of the puzzle of the day', () => {
  const today = '2026-10-06';

  it('counts the days in a row back from today', () => {
    expect(currentDailyStreak(['2026-10-04', '2026-10-05', '2026-10-06'], today)).toBe(3);
  });

  it('is not lost before the day is over: it counts back from yesterday', () => {
    expect(currentDailyStreak(['2026-10-04', '2026-10-05'], today)).toBe(2);
  });

  it('is lost after a missed day', () => {
    expect(currentDailyStreak(['2026-10-03', '2026-10-04'], today)).toBe(0);
    expect(currentDailyStreak(['2026-10-03', '2026-10-05', '2026-10-06'], today)).toBe(2);
    expect(currentDailyStreak([], today)).toBe(0);
  });

  it('keeps the best run over all the days', () => {
    expect(
      bestDailyStreak(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-11']),
    ).toBe(3);
    expect(bestDailyStreak([])).toBe(0);
  });
});
