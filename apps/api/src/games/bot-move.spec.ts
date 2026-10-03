import { describe, expect, it } from 'vitest';
import type { Analysis } from '../engine/uci-engine.js';
import { pickBotMove } from './bot-move.js';

const line = (multipv: number, move: string) => ({
  multipv,
  depth: 8,
  score: { kind: 'cp' as const, value: 0 },
  nodes: 1000,
  timeMs: 10,
  pv: [move],
});
const THREE_LINES: Analysis = {
  bestMove: 'e2e4',
  lines: [line(1, 'e2e4'), line(2, 'd2d4'), line(3, 'g1f3')],
  timedOut: false,
};

/** A random source that gives the listed numbers one after another. */
const sequence = (...values: number[]) => {
  const rest = [...values];
  return () => rest.shift() ?? 0;
};

describe('pickBotMove', () => {
  it('plays the best move when the bot does not make mistakes', () => {
    expect(pickBotMove(THREE_LINES, { mistakeChance: 0 }, sequence(0))).toBe('e2e4');
  });

  it('plays the best move when the dice say so', () => {
    expect(pickBotMove(THREE_LINES, { mistakeChance: 0.3 }, sequence(0.5))).toBe('e2e4');
  });

  it('takes another line when the dice say so', () => {
    expect(pickBotMove(THREE_LINES, { mistakeChance: 0.3 }, sequence(0.1, 0))).toBe('d2d4');
    expect(pickBotMove(THREE_LINES, { mistakeChance: 0.3 }, sequence(0.1, 0.99))).toBe('g1f3');
  });

  it('plays the best move when there is nothing else to choose from', () => {
    const lonely = { ...THREE_LINES, lines: [line(1, 'e2e4')] };
    expect(pickBotMove(lonely, { mistakeChance: 1 }, sequence(0))).toBe('e2e4');
  });

  it('returns no move for a finished game', () => {
    const over: Analysis = { bestMove: null, lines: [], timedOut: false };
    expect(pickBotMove(over, { mistakeChance: 1 }, sequence(0))).toBeNull();
  });
});
