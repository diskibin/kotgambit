import { describe, expect, it } from 'vitest';
import {
  QUALITY_MARKS,
  chancesGraph,
  formatScore,
  graphPath,
  lastMoveNumber,
  whiteShare,
} from './index.js';

describe('formatScore', () => {
  it('writes pawns with a sign and one decimal', () => {
    expect(formatScore({ kind: 'cp', value: 30 })).toBe('+0.3');
    expect(formatScore({ kind: 'cp', value: -120 })).toBe('-1.2');
    expect(formatScore({ kind: 'cp', value: 1050 })).toBe('+10.5');
  });

  it('writes an even position without a sign', () => {
    expect(formatScore({ kind: 'cp', value: 0 })).toBe('0.0');
    expect(formatScore({ kind: 'cp', value: 4 })).toBe('0.0');
  });

  it('writes a mate with the number of moves', () => {
    expect(formatScore({ kind: 'mate', value: 3 })).toBe('M3');
    expect(formatScore({ kind: 'mate', value: -2 })).toBe('-M2');
  });
});

describe('whiteShare', () => {
  it('splits the scale at half for an even position and leans to the better side', () => {
    expect(whiteShare({ kind: 'cp', value: 0 })).toBe(50);
    expect(whiteShare({ kind: 'cp', value: 300 })).toBeGreaterThan(70);
    expect(whiteShare({ kind: 'cp', value: -300 })).toBeLessThan(30);
    expect(whiteShare({ kind: 'mate', value: 2 })).toBe(100);
  });
});

describe('the graph', () => {
  it('puts the first position on the left and the last on the right, a won game at the top', () => {
    const points = chancesGraph([50, 100, 0], 200, 80);
    expect(points).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 0 },
      { x: 200, y: 80 },
    ]);
  });

  it('makes a game without moves one point on the left, without dividing by zero', () => {
    expect(chancesGraph([50], 200, 80)).toEqual([{ x: 0, y: 40 }]);
  });

  it('writes the path through the points', () => {
    expect(
      graphPath([
        { x: 0, y: 40 },
        { x: 100, y: 0 },
      ]),
    ).toBe('M0.0 40.0 L100.0 0.0');
    expect(graphPath([])).toBe('');
  });
});

describe('marks and move numbers', () => {
  it('has the marks of the design', () => {
    expect(QUALITY_MARKS).toEqual({
      best: '★',
      good: '✓',
      inaccuracy: '?!',
      mistake: '?',
      blunder: '??',
    });
  });

  it('numbers the last move of a game by full moves', () => {
    expect([1, 2, 3, 13, 14].map(lastMoveNumber)).toEqual([1, 1, 2, 7, 7]);
  });
});
