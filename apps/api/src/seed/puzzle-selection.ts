import type { PuzzleRow } from './puzzle-csv.js';

export interface SelectionOptions {
  /** Popularity is the share of players who liked a puzzle, from -100 to 100. */
  minPopularity: number;
  minPlays: number;
  /** A large deviation means the rating of the puzzle is still a guess. */
  maxRatingDeviation: number;
  minRating: number;
  maxRating: number;
  bucketSize: number;
  /** How many puzzles to keep from each rating bucket, so that every level has enough. */
  perBucket: number;
}

// Chosen on the real file (6.1 million puzzles, October 2026): this gives about 48 thousand puzzles with every
// rating level from 400 to 2800 well filled, which matters most at the easy end where beginners start
export const DEFAULT_SELECTION: SelectionOptions = {
  minPopularity: 80,
  minPlays: 300,
  maxRatingDeviation: 110,
  minRating: 400,
  maxRating: 2800,
  bucketSize: 100,
  perBucket: 2000,
};

/** Better first: more liked, then more played, then by id so that two runs pick the same puzzles. */
function byQuality(a: PuzzleRow, b: PuzzleRow): number {
  return b.popularity - a.popularity || b.plays - a.plays || a.id.localeCompare(b.id);
}

/**
 * Picks the best puzzles of every rating bucket while the file streams by. A bucket is cut back only
 * when it holds twice what is needed, so memory stays small and the sorting cost is spread out.
 */
export class PuzzleSelector {
  private readonly buckets = new Map<number, PuzzleRow[]>();

  constructor(private readonly options: SelectionOptions = DEFAULT_SELECTION) {}

  add(row: PuzzleRow): void {
    const o = this.options;
    if (
      row.popularity < o.minPopularity ||
      row.plays < o.minPlays ||
      row.ratingDeviation > o.maxRatingDeviation ||
      row.rating < o.minRating ||
      row.rating > o.maxRating
    ) {
      return;
    }
    const key = Math.floor(row.rating / o.bucketSize);
    const bucket = this.buckets.get(key) ?? [];
    bucket.push(row);
    this.buckets.set(key, bucket);
    if (bucket.length >= o.perBucket * 2) this.trim(key);
  }

  /** The chosen puzzles, ordered by rating. */
  result(): PuzzleRow[] {
    for (const key of this.buckets.keys()) this.trim(key);
    return [...this.buckets.entries()].sort(([a], [b]) => a - b).flatMap(([, rows]) => rows);
  }

  private trim(key: number): void {
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    bucket.sort(byQuality);
    bucket.length = Math.min(bucket.length, this.options.perBucket);
  }
}
