import type { AccessoryKey, Achievement, Wardrobe } from '@kotgambit/contracts';
import { ACCESSORY_KEYS } from '@kotgambit/contracts';

const GLASSES_PUZZLES = 100;
const HAT_STREAK_DAYS = 30;

export interface WardrobeFacts {
  /** Achievements as the profile keeps them: once reached, they stay. */
  achievements: readonly Achievement[];
  puzzlesSolved: number;
  bestStreakDays: number;
}

/** The rule of every item, the same ones that the locales put into words ("за серию 3 дня", "пройти «Основы»"). */
const RULES: Record<AccessoryKey, (facts: WardrobeFacts, reached: Set<string>) => boolean> = {
  none: () => true,
  scarf: (_facts, reached) => reached.has('streak-3'),
  glasses: (facts) => facts.puzzlesSolved >= GLASSES_PUZZLES,
  crown: (_facts, reached) => reached.has('basics'),
  hat: (facts) => facts.bestStreakDays >= HAT_STREAK_DAYS,
  medal: (_facts, reached) => reached.has('beat-bear'),
};

/** What is open, and what is worn. An item that is worn stays open even if the numbers behind it moved. */
export function buildWardrobe(selected: AccessoryKey, facts: WardrobeFacts): Wardrobe {
  const reached = new Set(facts.achievements.filter((a) => a.unlocked).map((a) => a.key));
  const items = ACCESSORY_KEYS.map((key) => ({
    key,
    unlocked: key === selected || RULES[key](facts, reached),
  }));
  return { selected, items };
}
