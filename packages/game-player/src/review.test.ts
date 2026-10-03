import { describe, expect, it } from 'vitest';
import {
  QUALITY_MARKS,
  chancesGraph,
  formatDay,
  formatLine,
  formatScore,
  graphPath,
  lastMoveNumber,
  levelPercent,
  monthGenitive,
  weekdayShort,
  whiteShare,
  yearOf,
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

describe('formatLine', () => {
  const white = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const black = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

  it('numbers the moves of a line that White starts', () => {
    expect(formatLine(white, ['Nf3', 'Nc6', 'Bb5'])).toBe('2.Nf3 Nc6 3.Bb5');
  });

  it('starts a line of Black with dots and goes on to the next number', () => {
    expect(formatLine(black, ['e5', 'Nf3', 'Nc6'])).toBe('1…e5 2.Nf3 Nc6');
  });

  it('is empty for no moves and reads a bare FEN', () => {
    expect(formatLine(white, [])).toBe('');
    expect(formatLine('4k3/8/8/8/8/8/8/4K3 b', ['Kd7'])).toBe('1…Kd7');
  });
});

describe('profile helpers', () => {
  it('writes the month in the genitive and the year of a day', () => {
    expect(monthGenitive('2026-09-01')).toBe('сентября');
    expect(monthGenitive('2026-12-31')).toBe('декабря');
    expect(yearOf('2026-09-01')).toBe(2026);
  });

  it('writes the short weekday', () => {
    // 2026-10-03 is a Saturday
    expect(weekdayShort('2026-10-03')).toBe('сб');
    expect(weekdayShort('2026-10-05')).toBe('пн');
    expect(weekdayShort('2026-10-04')).toBe('вс');
  });

  it('fills the level bar and keeps it within bounds', () => {
    expect(levelPercent(240, 400)).toBe(60);
    expect(levelPercent(0, 100)).toBe(0);
    expect(levelPercent(500, 400)).toBe(100);
    expect(levelPercent(5, 0)).toBe(0);
  });
});

describe('formatDay', () => {
  it('writes a day or an ISO time as day, month in the genitive and year', () => {
    expect(formatDay('2026-10-03')).toBe('3 октября 2026');
    expect(formatDay('2027-10-03T12:00:00.000Z')).toBe('3 октября 2027');
    expect(formatDay('2026-01-31')).toBe('31 января 2026');
  });
});
