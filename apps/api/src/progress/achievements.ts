/** What the achievements are decided from, all read from the learner's records. */
export interface AchievementStats {
  lessonsCompleted: number;
  /** Every chapter of the Basics track is done. */
  basicsComplete: boolean;
  /** The longest run of days with the daily goal reached. */
  bestStreakDays: number;
  /** The longest run of puzzles solved cleanly. */
  bestPuzzleStreak: number;
  /** The longest run of days with the puzzle of the day solved. */
  bestDailyPuzzleStreak: number;
  /** Games won by checkmate. */
  matesDelivered: number;
  gamesReviewed: number;
  winsAgainstBear: number;
}

export interface AchievementDefinition {
  key: string;
  /** What the achievement counts, so that a locked one can show "2 из 5". */
  target: number;
  current: (stats: AchievementStats) => number;
}

const flag = (value: boolean) => (value ? 1 : 0);

/** The order is the order of the profile. The names and hints live in the locale files. */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { key: 'first-lesson', target: 1, current: (s) => s.lessonsCompleted },
  { key: 'first-mate', target: 1, current: (s) => s.matesDelivered },
  { key: 'streak-3', target: 3, current: (s) => s.bestStreakDays },
  { key: 'basics', target: 1, current: (s) => flag(s.basicsComplete) },
  { key: 'streak-7', target: 7, current: (s) => s.bestStreakDays },
  { key: 'puzzles-10-row', target: 10, current: (s) => s.bestPuzzleStreak },
  { key: 'daily-3', target: 3, current: (s) => s.bestDailyPuzzleStreak },
  { key: 'daily-7', target: 7, current: (s) => s.bestDailyPuzzleStreak },
  { key: 'daily-30', target: 30, current: (s) => s.bestDailyPuzzleStreak },
  { key: 'review-5', target: 5, current: (s) => s.gamesReviewed },
  { key: 'beat-bear', target: 1, current: (s) => s.winsAgainstBear },
];

export interface AchievementProgress {
  key: string;
  current: number;
  target: number;
  unlocked: boolean;
}

/** How far the learner is on every achievement, a reached target counts as unlocked. */
export function evaluateAchievements(stats: AchievementStats): AchievementProgress[] {
  return ACHIEVEMENTS.map(({ key, target, current }) => {
    const value = current(stats);
    return { key, current: Math.min(value, target), target, unlocked: value >= target };
  });
}
