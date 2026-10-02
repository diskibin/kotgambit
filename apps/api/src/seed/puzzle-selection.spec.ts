import { describe, expect, it } from 'vitest';
import type { PuzzleRow } from './puzzle-csv.js';
import { DEFAULT_SELECTION, PuzzleSelector, type SelectionOptions } from './puzzle-selection.js';

function puzzle(id: string, over: Partial<PuzzleRow> = {}): PuzzleRow {
  return {
    id,
    fen: 'x',
    moves: ['a', 'b'],
    rating: 1000,
    ratingDeviation: 80,
    popularity: 90,
    plays: 1000,
    themes: [],
    openingTags: [],
    ...over,
  };
}

const OPTIONS: SelectionOptions = { ...DEFAULT_SELECTION, perBucket: 2 };

function pick(options: SelectionOptions, ...rows: PuzzleRow[]): string[] {
  const selector = new PuzzleSelector(options);
  rows.forEach((row) => selector.add(row));
  return selector.result().map((row) => row.id);
}

describe('PuzzleSelector', () => {
  it('drops puzzles that are unpopular, little played, uncertain or outside the rating range', () => {
    expect(
      pick(
        OPTIONS,
        puzzle('ok'),
        puzzle('unpopular', { popularity: DEFAULT_SELECTION.minPopularity - 1 }),
        puzzle('rare', { plays: DEFAULT_SELECTION.minPlays - 1 }),
        puzzle('uncertain', { ratingDeviation: DEFAULT_SELECTION.maxRatingDeviation + 1 }),
        puzzle('too-easy', { rating: DEFAULT_SELECTION.minRating - 1 }),
        puzzle('too-hard', { rating: DEFAULT_SELECTION.maxRating + 1 }),
      ),
    ).toEqual(['ok']);
  });

  it('keeps the best of a rating bucket: most liked, then most played', () => {
    expect(
      pick(
        OPTIONS,
        puzzle('plain', { popularity: 85 }),
        puzzle('liked', { popularity: 99, plays: 400 }),
        puzzle('played', { popularity: 95, plays: 9000 }),
        puzzle('also-95', { popularity: 95, plays: 2000 }),
      ),
    ).toEqual(['liked', 'played']);
  });

  it('fills every rating bucket on its own', () => {
    expect(
      pick(
        OPTIONS,
        puzzle('low-1', { rating: 810 }),
        puzzle('low-2', { rating: 820 }),
        puzzle('low-3', { rating: 830, popularity: 85 }),
        puzzle('high', { rating: 1930 }),
      ),
    ).toEqual(['low-1', 'low-2', 'high']);
  });

  it('orders the result by rating', () => {
    expect(
      pick(
        OPTIONS,
        puzzle('hard', { rating: 1900 }),
        puzzle('easy', { rating: 700 }),
        puzzle('middle', { rating: 1200 }),
      ),
    ).toEqual(['easy', 'middle', 'hard']);
  });

  it('is the same whatever order the rows arrive in', () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      puzzle(`p${String(i).padStart(2, '0')}`, { popularity: 80 + (i % 5), plays: 300 + i }),
    );
    expect(pick(OPTIONS, ...rows)).toEqual(pick(OPTIONS, ...[...rows].reverse()));
  });

  it('cuts a bucket back while it streams, so that memory stays small', () => {
    const selector = new PuzzleSelector({ ...DEFAULT_SELECTION, perBucket: 3 });
    for (let i = 0; i < 100; i += 1) selector.add(puzzle(`p${i}`, { plays: 1000 + i }));
    expect(selector.result().map((row) => row.id)).toEqual(['p99', 'p98', 'p97']);
  });
});
