import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, evaluateAchievements, type AchievementStats } from './achievements.js';
import { levelOf } from './levels.js';
import { INITIAL_SCHEDULE, dueAfter, nextSchedule } from './srs.js';
import { bestStreak } from './streak.js';

describe('levelOf', () => {
  it('starts at level 1 with 100 XP to go', () => {
    expect(levelOf(0)).toEqual({ level: 1, xpInLevel: 0, xpForNext: 100 });
  });

  it('asks for more XP at every level', () => {
    expect(levelOf(99)).toMatchObject({ level: 1, xpInLevel: 99 });
    expect(levelOf(100)).toEqual({ level: 2, xpInLevel: 0, xpForNext: 200 });
    expect(levelOf(300)).toEqual({ level: 3, xpInLevel: 0, xpForNext: 300 });
  });

  it('matches the numbers of the design: level 4 at 240 of 400', () => {
    expect(levelOf(100 + 200 + 300 + 240)).toEqual({ level: 4, xpInLevel: 240, xpForNext: 400 });
  });

  it('ignores a negative or fractional total', () => {
    expect(levelOf(-5).level).toBe(1);
    expect(levelOf(100.9).level).toBe(2);
  });
});

describe('nextSchedule', () => {
  it('brings a card back after 1 day, then 3, then by the ease', () => {
    const first = nextSchedule(INITIAL_SCHEDULE, 'correct');
    expect(first).toMatchObject({ intervalDays: 1, repetitions: 1 });
    const second = nextSchedule(first, 'correct');
    expect(second).toMatchObject({ intervalDays: 3, repetitions: 2 });
    const third = nextSchedule(second, 'correct');
    expect(third.intervalDays).toBe(8);
    expect(nextSchedule(third, 'correct').intervalDays).toBe(20);
  });

  it('starts over after a wrong answer and makes the card a little harder', () => {
    const grown = nextSchedule(
      nextSchedule(nextSchedule(INITIAL_SCHEDULE, 'correct'), 'correct'),
      'correct',
    );
    const lapsed = nextSchedule(grown, 'wrong');
    expect(lapsed).toEqual({ intervalDays: 1, ease: 2.3, repetitions: 0, lapses: 1 });
  });

  it('never lets the ease fall below 1.3', () => {
    let schedule = INITIAL_SCHEDULE;
    for (let i = 0; i < 10; i += 1) schedule = nextSchedule(schedule, 'wrong');
    expect(schedule.ease).toBe(1.3);
    expect(schedule.lapses).toBe(10);
  });

  it('caps the interval at half a year', () => {
    let schedule = { ...INITIAL_SCHEDULE, repetitions: 5, intervalDays: 150, ease: 2.5 };
    schedule = nextSchedule(schedule, 'correct');
    expect(schedule.intervalDays).toBe(180);
  });

  it('adds the interval to a date', () => {
    expect(dueAfter(new Date('2026-10-03T10:00:00Z'), 3).toISOString()).toBe(
      '2026-10-06T10:00:00.000Z',
    );
  });
});

describe('bestStreak', () => {
  const goal = 60;
  const day = (date: string, seconds = 60) => ({ day: date, seconds });

  it('finds the longest run, not the current one', () => {
    const days = [
      day('2026-09-01'),
      day('2026-09-02'),
      day('2026-09-03'),
      day('2026-09-04'),
      day('2026-09-10'),
      day('2026-09-11'),
    ];
    expect(bestStreak(days, goal)).toBe(4);
  });

  it('skips days below the goal and counts a day once', () => {
    expect(bestStreak([day('2026-09-01'), day('2026-09-02', 10), day('2026-09-03')], goal)).toBe(1);
    expect(bestStreak([day('2026-09-01'), day('2026-09-01')], goal)).toBe(1);
  });

  it('is 0 without days', () => {
    expect(bestStreak([], goal)).toBe(0);
  });
});

describe('evaluateAchievements', () => {
  const none: AchievementStats = {
    lessonsCompleted: 0,
    basicsComplete: false,
    bestStreakDays: 0,
    bestPuzzleStreak: 0,
    bestDailyPuzzleStreak: 0,
    matesDelivered: 0,
    gamesReviewed: 0,
    winsAgainstBear: 0,
  };
  const by = (stats: AchievementStats) =>
    Object.fromEntries(evaluateAchievements(stats).map((a) => [a.key, a]));

  it('has the achievements of the design in order', () => {
    expect(ACHIEVEMENTS.map((a) => a.key)).toEqual([
      'first-lesson',
      'first-mate',
      'streak-3',
      'basics',
      'streak-7',
      'puzzles-10-row',
      'daily-3',
      'daily-7',
      'daily-30',
      'review-5',
      'beat-bear',
    ]);
  });

  it('locks everything for a newcomer, with the progress at zero', () => {
    expect(evaluateAchievements(none).every((a) => !a.unlocked && a.current === 0)).toBe(true);
  });

  it('unlocks when the target is reached and shows the progress before', () => {
    const result = by({
      ...none,
      lessonsCompleted: 3,
      bestStreakDays: 5,
      bestPuzzleStreak: 6,
      gamesReviewed: 2,
    });
    expect(result['first-lesson']).toMatchObject({ unlocked: true, current: 1, target: 1 });
    expect(result['streak-3']?.unlocked).toBe(true);
    expect(result['streak-7']).toMatchObject({ unlocked: false, current: 5, target: 7 });
    expect(result['puzzles-10-row']).toMatchObject({ unlocked: false, current: 6, target: 10 });
    expect(result['review-5']).toMatchObject({ unlocked: false, current: 2, target: 5 });
  });

  it('counts the streak of the puzzle of the day towards three of them', () => {
    const result = by({ ...none, bestDailyPuzzleStreak: 8 });
    expect(result['daily-3']?.unlocked).toBe(true);
    expect(result['daily-7']?.unlocked).toBe(true);
    expect(result['daily-30']).toMatchObject({ unlocked: false, current: 8, target: 30 });
  });

  it('knows the one-time achievements', () => {
    const result = by({ ...none, basicsComplete: true, matesDelivered: 4, winsAgainstBear: 1 });
    expect(result.basics?.unlocked).toBe(true);
    expect(result['first-mate']?.unlocked).toBe(true);
    expect(result['beat-bear']?.unlocked).toBe(true);
  });
});
