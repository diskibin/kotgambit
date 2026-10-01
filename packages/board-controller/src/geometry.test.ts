import { describe, expect, it } from 'vitest';
import { displaySquares, isLightSquare, neighbour, squareAtPoint } from './geometry.js';

const RECT = { left: 10, top: 20, width: 800, height: 800 };

describe('displaySquares', () => {
  it('draws white at the bottom', () => {
    const squares = displaySquares('w');
    expect(squares).toHaveLength(64);
    expect(squares[0]).toBe('a8');
    expect(squares[7]).toBe('h8');
    expect(squares[63]).toBe('h1');
  });

  it('turns the board around for black', () => {
    const squares = displaySquares('b');
    expect(squares[0]).toBe('h1');
    expect(squares[63]).toBe('a8');
  });
});

describe('isLightSquare', () => {
  it('has a dark a1 and a light h1', () => {
    expect(isLightSquare('a1')).toBe(false);
    expect(isLightSquare('h1')).toBe(true);
    expect(isLightSquare('a8')).toBe(true);
    expect(isLightSquare('h8')).toBe(false);
  });
});

describe('squareAtPoint', () => {
  it('finds the square under a point', () => {
    expect(squareAtPoint('w', RECT, 10 + 450, 20 + 450)).toBe('e4');
    expect(squareAtPoint('w', RECT, 11, 21)).toBe('a8');
    expect(squareAtPoint('b', RECT, 11, 21)).toBe('h1');
  });

  it('returns null outside of the board', () => {
    expect(squareAtPoint('w', RECT, 5, 100)).toBeNull();
    expect(squareAtPoint('w', RECT, 100, 900)).toBeNull();
  });
});

describe('neighbour', () => {
  it('moves in display space', () => {
    expect(neighbour('w', 'a8', 1, 0)).toBe('b8');
    expect(neighbour('w', 'a8', 0, 1)).toBe('a7');
    expect(neighbour('b', 'h1', 1, 0)).toBe('g1');
  });

  it('stops at the edge', () => {
    expect(neighbour('w', 'a8', -1, 0)).toBeNull();
    expect(neighbour('w', 'h1', 0, 1)).toBeNull();
  });
});
