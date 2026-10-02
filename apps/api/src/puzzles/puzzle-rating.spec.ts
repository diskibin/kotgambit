import { describe, expect, it } from 'vitest';
import { START_RATING, expectedScore, nextRating, outcomeOf } from './puzzle-rating.js';

describe('expectedScore', () => {
  it('is one half between equals', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it('is about 0.76 for a player 200 points above the puzzle, and mirrors below', () => {
    expect(expectedScore(1400, 1200)).toBeCloseTo(0.76, 2);
    expect(expectedScore(1000, 1200) + expectedScore(1400, 1200)).toBeCloseTo(1);
  });
});

describe('nextRating', () => {
  it('gains a half step of K for a clean solve against an equal puzzle', () => {
    expect(nextRating(1200, 1200, 'clean', 0)).toBeCloseTo(1216);
  });

  it('loses the same for a miss, and nothing for a half point against an equal puzzle', () => {
    expect(nextRating(1200, 1200, 'failed', 0)).toBeCloseTo(1184);
    expect(nextRating(1200, 1200, 'helped', 0)).toBeCloseTo(1200);
  });

  it('rewards beating a harder puzzle more than an easier one', () => {
    const hard = nextRating(1000, 1400, 'clean', 0) - 1000;
    const easy = nextRating(1000, 600, 'clean', 0) - 1000;
    expect(hard).toBeGreaterThan(easy);
  });

  it('takes a miss on an easy puzzle harder than on a hard one', () => {
    const easy = 1000 - nextRating(1000, 600, 'failed', 0);
    const hard = 1000 - nextRating(1000, 1400, 'failed', 0);
    expect(easy).toBeGreaterThan(hard);
  });

  it('moves slower once the player has settled', () => {
    const fresh = nextRating(1200, 1200, 'clean', 0) - 1200;
    const settled = nextRating(1200, 1200, 'clean', 30) - 1200;
    expect(settled).toBeCloseTo(fresh / 2);
  });

  it('stays within the limits', () => {
    expect(nextRating(3000, 400, 'clean', 0)).toBe(3000);
    expect(nextRating(100, 3000, 'failed', 0)).toBe(100);
  });

  it('starts the rating where a beginner is', () => {
    expect(START_RATING).toBe(1000);
  });
});

describe('outcomeOf', () => {
  it('is clean without mistakes and hints', () => {
    expect(outcomeOf(0, 0)).toBe('clean');
  });

  it('is helped with a hint of level one or two and no mistakes', () => {
    expect(outcomeOf(0, 1)).toBe('helped');
    expect(outcomeOf(0, 2)).toBe('helped');
  });

  it('is failed after a mistake or the last hint', () => {
    expect(outcomeOf(1, 0)).toBe('failed');
    expect(outcomeOf(0, 3)).toBe('failed');
  });
});
