import { describe, expect, it } from 'vitest';
import { computeStreak, daysBetween, dayKeyOf, shiftDay } from './streak.js';

const GOAL = 600;
const day = (key: string, seconds = GOAL) => ({ day: key, seconds });

describe('day helpers', () => {
  it('formats and shifts days across month and year borders', () => {
    expect(dayKeyOf(new Date('2026-10-01T23:59:59Z'))).toBe('2026-10-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts the days between two keys', () => {
    expect(daysBetween('2026-10-01', '2026-10-04')).toBe(3);
    expect(daysBetween('2026-10-04', '2026-10-01')).toBe(-3);
  });
});

describe('computeStreak', () => {
  it('is zero without activity', () => {
    expect(computeStreak([], GOAL, '2026-10-05')).toBe(0);
  });

  it('counts consecutive days that reached the goal', () => {
    const days = [day('2026-10-03'), day('2026-10-04'), day('2026-10-05')];
    expect(computeStreak(days, GOAL, '2026-10-05')).toBe(3);
  });

  it('keeps the streak alive until the day is over', () => {
    const days = [day('2026-10-03'), day('2026-10-04'), day('2026-10-05', 120)];
    expect(computeStreak(days, GOAL, '2026-10-05')).toBe(2);
  });

  it('is lost after a missed day', () => {
    const days = [day('2026-10-01'), day('2026-10-02'), day('2026-10-04')];
    expect(computeStreak(days, GOAL, '2026-10-05')).toBe(1);
    expect(computeStreak([day('2026-10-02')], GOAL, '2026-10-05')).toBe(0);
  });

  it('does not count days below the goal', () => {
    const days = [day('2026-10-04', GOAL - 1), day('2026-10-05')];
    expect(computeStreak(days, GOAL, '2026-10-05')).toBe(1);
  });

  it('follows the goal the learner has now', () => {
    const days = [day('2026-10-04', 300), day('2026-10-05', 300)];
    expect(computeStreak(days, 300, '2026-10-05')).toBe(2);
    expect(computeStreak(days, 600, '2026-10-05')).toBe(0);
  });
});
