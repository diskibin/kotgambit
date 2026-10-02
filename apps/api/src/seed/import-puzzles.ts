import { PrismaPg } from '@prisma/adapter-pg';
import { parseArgs } from 'node:util';
import { PrismaClient } from '../generated/prisma/client.js';
import { selectPuzzles, writePuzzles } from './puzzle-import.js';
import { DEFAULT_SELECTION, type SelectionOptions } from './puzzle-selection.js';

// Usage: pnpm --filter @kotgambit/api import:puzzles <lichess_db_puzzle.csv.zst> [--dry-run] [options]
// The file is the CC0 database from https://database.lichess.org/#puzzles, a .csv or a .csv.zst.
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    'min-popularity': { type: 'string' },
    'min-plays': { type: 'string' },
    'max-rating-deviation': { type: 'string' },
    'min-rating': { type: 'string' },
    'max-rating': { type: 'string' },
    'per-bucket': { type: 'string' },
  },
});

const file = positionals[0];
if (!file) throw new Error('Pass the path of the puzzle file');

function option(name: keyof typeof values, fallback: number): number {
  const raw = values[name];
  if (typeof raw !== 'string') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`--${name} needs a number, got "${raw}"`);
  return value;
}

const options: SelectionOptions = {
  ...DEFAULT_SELECTION,
  minPopularity: option('min-popularity', DEFAULT_SELECTION.minPopularity),
  minPlays: option('min-plays', DEFAULT_SELECTION.minPlays),
  maxRatingDeviation: option('max-rating-deviation', DEFAULT_SELECTION.maxRatingDeviation),
  minRating: option('min-rating', DEFAULT_SELECTION.minRating),
  maxRating: option('max-rating', DEFAULT_SELECTION.maxRating),
  perBucket: option('per-bucket', DEFAULT_SELECTION.perBucket),
};

const { rows, stats } = await selectPuzzles(file, options);
console.log(
  `Read ${stats.read} puzzles, ${stats.malformed} malformed, chose ${rows.length + stats.invalid}, ` +
    `${stats.invalid} not playable, ${rows.length} to import`,
);

if (values['dry-run']) {
  const buckets = new Map<number, number>();
  for (const row of rows) {
    const key = Math.floor(row.rating / options.bucketSize) * options.bucketSize;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  for (const [start, count] of [...buckets].sort(([a], [b]) => a - b)) {
    console.log(`${start}-${start + options.bucketSize - 1}: ${count}`);
  }
} else {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  try {
    console.log(`Inserted ${await writePuzzles(prisma, rows)} new puzzle(s)`);
  } finally {
    await prisma.$disconnect();
  }
}
