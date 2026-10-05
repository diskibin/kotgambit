import { PIECE_SETS } from '@kotgambit/preferences';
import { describe, expect, it } from 'vitest';
import { pieceUrl } from './pieceAssets';

const TYPES = ['k', 'q', 'r', 'b', 'n', 'p'] as const;

describe('pieceUrl', () => {
  it('has all twelve pieces in every set', () => {
    for (const set of PIECE_SETS) {
      for (const color of ['w', 'b'] as const) {
        for (const type of TYPES) expect(pieceUrl(color, type, set)).toMatch(/svg/);
      }
    }
  });

  it('gives the pieces of the cat unless another set is asked for', () => {
    expect(pieceUrl('w', 'k')).toBe(pieceUrl('w', 'k', 'gambit'));
  });

  it('gives different pictures for different sets', () => {
    const urls = PIECE_SETS.map((set) => pieceUrl('w', 'n', set));
    expect(new Set(urls).size).toBe(PIECE_SETS.length);
  });
});
