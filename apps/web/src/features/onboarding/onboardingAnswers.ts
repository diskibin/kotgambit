export const LEVELS = ['novice', 'basics', 'player'] as const;
export type Level = (typeof LEVELS)[number];
export const GOALS = [5, 10, 15] as const;
export type Goal = (typeof GOALS)[number];

export interface Onboarding {
  level: Level;
  goal: Goal;
}

export const DEFAULT_ONBOARDING: Onboarding = { level: 'basics', goal: 10 };

// The first chapter of every level. The numbers are those of the lesson files in content/lessons
export const FIRST_LESSON: Record<
  Level,
  { id: string; piece: 'k' | 'n' | 'b'; minutes: number; steps: number }
> = {
  novice: { id: 'basics-board', piece: 'k', minutes: 5, steps: 5 },
  basics: { id: 'basics-knight', piece: 'n', minutes: 6, steps: 6 },
  player: { id: 'openings-italian', piece: 'b', minutes: 6, steps: 5 },
};

const KEY = 'kotgambit.onboarding';

/**
 * The answers of a visitor wait on the device until the account exists: the server has nowhere to keep them
 * before that. Nothing here is private, and storage may be shut.
 */
export function savePending(answers: Onboarding): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(answers));
  } catch {
    // The goal is then chosen again in the settings, the lesson does not depend on it
  }
}

export function loadPending(): Onboarding | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return null;
    const value = JSON.parse(raw) as Partial<Onboarding>;
    const level = LEVELS.find((item) => item === value.level);
    const goal = GOALS.find((item) => item === value.goal);
    return level && goal ? { level, goal } : null;
  } catch {
    return null;
  }
}

export function clearPending(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Applied again next time at worst: the same goal is sent twice
  }
}
