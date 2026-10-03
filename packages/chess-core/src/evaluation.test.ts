import { describe, expect, it } from 'vitest';
import {
  classifyMove,
  gameAccuracy,
  moveAccuracy,
  outlook,
  parsePlacement,
  positionProblem,
  whiteScore,
  winPercent,
} from './index.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('winPercent', () => {
  it('is even at zero and grows with the advantage', () => {
    expect(winPercent({ kind: 'cp', value: 0 })).toBeCloseTo(50, 5);
    expect(winPercent({ kind: 'cp', value: 100 })).toBeGreaterThan(55);
    expect(winPercent({ kind: 'cp', value: 100 })).toBeLessThan(65);
    expect(winPercent({ kind: 'cp', value: 900 })).toBeGreaterThan(95);
  });

  it('is symmetric', () => {
    const up = winPercent({ kind: 'cp', value: 250 });
    const down = winPercent({ kind: 'cp', value: -250 });
    expect(up + down).toBeCloseTo(100, 5);
  });

  it('puts a forced mate at the end of the scale, whichever side gives it', () => {
    expect(winPercent({ kind: 'mate', value: 3 })).toBeGreaterThan(99.9);
    expect(winPercent({ kind: 'mate', value: -1 })).toBeLessThan(0.1);
  });
});

describe('whiteScore', () => {
  it('turns the score of the side to move into the score of White', () => {
    expect(whiteScore({ kind: 'cp', value: 40 }, 'w')).toEqual({ kind: 'cp', value: 40 });
    expect(whiteScore({ kind: 'cp', value: 40 }, 'b')).toEqual({ kind: 'cp', value: -40 });
    expect(whiteScore({ kind: 'mate', value: 2 }, 'b')).toEqual({ kind: 'mate', value: -2 });
  });
});

describe('outlook', () => {
  it('adds up to 100 and leaves room for a draw in an even position', () => {
    const even = outlook({ kind: 'cp', value: 0 });
    expect(even.white + even.draw + even.black).toBe(100);
    expect(even.draw).toBeGreaterThan(20);
    expect(Math.abs(even.white - even.black)).toBeLessThanOrEqual(1);
  });

  it('leans towards the side that is ahead and leaves no draw in a won position', () => {
    const ahead = outlook({ kind: 'cp', value: 800 });
    expect(ahead.white).toBeGreaterThan(90);
    expect(ahead.draw).toBe(0);
    expect(ahead.white + ahead.draw + ahead.black).toBe(100);
    const behind = outlook({ kind: 'cp', value: -800 });
    expect(behind.black).toBeGreaterThan(90);
  });
});

describe('classifyMove', () => {
  it('calls the best move best, and one that loses almost nothing too', () => {
    expect(classifyMove(60, 40, true)).toBe('best');
    expect(classifyMove(60, 59.5, false)).toBe('best');
  });

  it('follows the thresholds of the plan', () => {
    expect(classifyMove(60, 56, false)).toBe('good');
    expect(classifyMove(60, 53, false)).toBe('inaccuracy');
    expect(classifyMove(60, 45, false)).toBe('mistake');
    expect(classifyMove(60, 35, false)).toBe('blunder');
  });

  it('does not punish a move that improved the position', () => {
    expect(classifyMove(50, 70, false)).toBe('best');
  });
});

describe('accuracy', () => {
  it('is full for no drop and falls with the drop', () => {
    expect(moveAccuracy(0)).toBeGreaterThan(99);
    expect(moveAccuracy(10)).toBeLessThan(moveAccuracy(5));
    expect(moveAccuracy(80)).toBeLessThan(5);
    expect(moveAccuracy(-5)).toBe(moveAccuracy(0));
  });

  it('averages the moves of a game and is empty for a game without moves', () => {
    expect(gameAccuracy([])).toBeNull();
    const clean = gameAccuracy([0, 0, 1]);
    const rough = gameAccuracy([0, 25, 40]);
    expect(clean).toBeGreaterThan(95);
    expect(rough).toBeLessThan(60);
  });
});

describe('positionProblem', () => {
  const fen = (placement: string, side = 'w') => `${placement} ${side} - - 0 1`;

  it('accepts the initial position and a bare FEN without counters', () => {
    expect(positionProblem(START)).toBeNull();
    expect(positionProblem('4k3/8/8/8/8/8/8/4K3 w')).toBeNull();
  });

  it('names a missing king of either color', () => {
    expect(positionProblem(fen('8/8/8/8/8/8/8/4K3'))).toEqual({ kind: 'no-king', color: 'b' });
    expect(positionProblem(fen('4k3/8/8/8/8/8/8/8'))).toEqual({ kind: 'no-king', color: 'w' });
  });

  it('refuses a second king', () => {
    expect(positionProblem(fen('4k3/8/8/8/8/8/8/3KK3'))).toEqual({
      kind: 'many-kings',
      color: 'w',
    });
  });

  it('refuses a pawn on the first or last rank and says where', () => {
    expect(positionProblem(fen('P3k3/8/8/8/8/8/8/4K3'))).toEqual({
      kind: 'pawn-on-edge',
      square: 'a8',
    });
    expect(positionProblem(fen('4k3/8/8/8/8/8/8/p3K3'))).toEqual({
      kind: 'pawn-on-edge',
      square: 'a1',
    });
  });

  it('refuses kings that touch', () => {
    expect(positionProblem(fen('8/8/8/8/8/3k4/4K3/8'))).toEqual({ kind: 'kings-touch' });
  });

  it('refuses nine pawns of one color', () => {
    expect(positionProblem(fen('4k3/pppppppp/p7/8/8/8/8/4K3'))).toEqual({
      kind: 'too-many-pieces',
      color: 'b',
    });
  });

  it('refuses a check on the side that is not to move', () => {
    // Black king on e8 attacked by the rook on e1 while it is White's turn
    expect(positionProblem(fen('4k3/8/8/8/8/8/8/K3R3'))).toEqual({
      kind: 'side-not-to-move-in-check',
    });
    expect(positionProblem(fen('4k3/8/8/8/8/8/8/K3R3', 'b'))).toBeNull();
  });

  it('calls a string that is not a position malformed', () => {
    expect(positionProblem('hello')).toEqual({ kind: 'malformed' });
    expect(positionProblem('8/8/8 w')).toEqual({ kind: 'malformed' });
    expect(positionProblem('4k3/8/8/8/8/8/8/4K3 x')).toEqual({ kind: 'malformed' });
    expect(positionProblem('4k4/8/8/8/8/8/8/4K3 w')).toEqual({ kind: 'malformed' });
  });
});

describe('parsePlacement', () => {
  it('lists the pieces with their squares, also of a position that cannot happen', () => {
    expect(parsePlacement('4k3/8/8/8/8/8/8/R3K3')).toEqual([
      { square: 'e8', color: 'b', type: 'k' },
      { square: 'a1', color: 'w', type: 'r' },
      { square: 'e1', color: 'w', type: 'k' },
    ]);
    expect(parsePlacement('8/8/8/8/8/8/8/8')).toEqual([]);
  });

  it('is null for a string that is not a placement', () => {
    expect(parsePlacement('nonsense')).toBeNull();
    expect(parsePlacement('9/8/8/8/8/8/8/8')).toBeNull();
  });
});
