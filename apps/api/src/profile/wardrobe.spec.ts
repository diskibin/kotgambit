import type { Achievement } from '@kotgambit/contracts';
import { describe, expect, it } from 'vitest';
import { buildWardrobe, type WardrobeFacts } from './wardrobe.js';

const achievement = (key: string, unlocked: boolean): Achievement => ({
  key,
  current: unlocked ? 1 : 0,
  target: 1,
  unlocked,
});

const NOTHING: WardrobeFacts = { achievements: [], puzzlesSolved: 0, bestStreakDays: 0 };
const openKeys = (facts: WardrobeFacts, selected = 'none' as const) =>
  buildWardrobe(selected, facts)
    .items.filter((item) => item.unlocked)
    .map((item) => item.key);

describe('the wardrobe', () => {
  it('opens only the plain cat for a newcomer', () => {
    expect(openKeys(NOTHING)).toEqual(['none']);
  });

  it('opens the scarf with the achievement of a three-day streak', () => {
    expect(openKeys({ ...NOTHING, achievements: [achievement('streak-3', true)] })).toEqual([
      'none',
      'scarf',
    ]);
  });

  it('opens the glasses after a hundred puzzles, not before', () => {
    expect(openKeys({ ...NOTHING, puzzlesSolved: 99 })).toEqual(['none']);
    expect(openKeys({ ...NOTHING, puzzlesSolved: 100 })).toEqual(['none', 'glasses']);
  });

  it('opens the crown with Basics, the hat with a month of streak and the medal with the Bear', () => {
    const facts: WardrobeFacts = {
      achievements: [achievement('basics', true), achievement('beat-bear', true)],
      puzzlesSolved: 0,
      bestStreakDays: 30,
    };
    expect(openKeys(facts)).toEqual(['none', 'crown', 'hat', 'medal']);
  });

  it('keeps a worn item open even when its numbers have moved', () => {
    expect(openKeys(NOTHING, 'crown' as never)).toEqual(['none', 'crown']);
  });

  it('says what is worn', () => {
    expect(buildWardrobe('none', NOTHING).selected).toBe('none');
  });
});
