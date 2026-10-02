import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { selectPuzzles, writePuzzles } from './puzzle-import.js';
import { DEFAULT_SELECTION } from './puzzle-selection.js';

const SAMPLE = fileURLToPath(
  new URL('../../test/fixtures/lichess-puzzles-sample.csv', import.meta.url),
);
// Real rows of the database are all good puzzles, so the filters only get in the way here
const EVERYTHING = {
  ...DEFAULT_SELECTION,
  minPopularity: -100,
  minPlays: 0,
  maxRatingDeviation: 1000,
  perBucket: 1000,
};

describe('puzzle import', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(() => app.close());
  beforeEach(() => prisma.puzzle.deleteMany());

  it('selects and checks the puzzles of a file', async () => {
    const { rows, stats } = await selectPuzzles(SAMPLE, EVERYTHING);
    expect(stats).toEqual({ read: 6, malformed: 0, invalid: 0 });
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.rating)).toEqual(
      [...rows.map((row) => row.rating)].sort((a, b) => a - b),
    );
  });

  it('applies the default filters to the sample', async () => {
    const { rows } = await selectPuzzles(SAMPLE);
    // Every sample row is liked and played enough, only the very easy and the very hard are cut by rating
    expect(rows).toHaveLength(6);
  });

  it('stores a puzzle with its line and themes, and can be run again without duplicates', async () => {
    const { rows } = await selectPuzzles(SAMPLE, EVERYTHING);

    expect(await writePuzzles(prisma, rows)).toBe(6);
    expect(await writePuzzles(prisma, rows)).toBe(0);
    expect(await prisma.puzzle.count()).toBe(6);

    expect(await prisma.puzzle.findUnique({ where: { id: '005Bm' } })).toEqual({
      id: '005Bm',
      fen: '4rk2/p1q5/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 b - - 0 43',
      moves: ['c7f7', 'h4g6', 'f8g8', 'f6h8'],
      rating: 1434,
      ratingDeviation: 76,
      popularity: 96,
      plays: 6584,
      themes: ['endgame', 'mate', 'mateIn2', 'pin', 'short'],
      openingTags: [],
    });
  });

  it('keeps a puzzle that is already stored as it is', async () => {
    const { rows } = await selectPuzzles(SAMPLE, EVERYTHING);
    await writePuzzles(prisma, rows);
    const changed = rows.map((row) => ({ ...row, plays: 1 }));
    await writePuzzles(prisma, changed);
    expect((await prisma.puzzle.findUnique({ where: { id: '005Bm' } }))?.plays).toBe(6584);
  });
});
