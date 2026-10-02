import { isPlayablePuzzle } from '@kotgambit/chess-core';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parsePuzzleRows, type ParseStats, type PuzzleRow } from './puzzle-csv.js';
import { DEFAULT_SELECTION, PuzzleSelector, type SelectionOptions } from './puzzle-selection.js';
import { readLines } from './zstd-frames.js';

export interface Selection {
  rows: PuzzleRow[];
  stats: ParseStats & {
    /** Chosen rows whose line is not playable, such as a move that is illegal in the position. */
    invalid: number;
  };
}

/**
 * Reads the file once and returns the puzzles to import. Only the chosen rows are checked move by move
 * with chess.js: checking all six million would cost minutes and most of them are dropped anyway.
 */
export async function selectPuzzles(
  path: string,
  options: SelectionOptions = DEFAULT_SELECTION,
): Promise<Selection> {
  const parse: ParseStats = { read: 0, malformed: 0 };
  const selector = new PuzzleSelector(options);
  for await (const row of parsePuzzleRows(readLines(path), parse)) selector.add(row);

  const chosen = selector.result();
  const rows = chosen.filter((row) => isPlayablePuzzle(row.fen, row.moves));
  return { rows, stats: { ...parse, invalid: chosen.length - rows.length } };
}

const BATCH_SIZE = 1000;

/**
 * Writes the puzzles in batches. A puzzle that is already there is left alone, so the import can be
 * repeated, and a puzzle is never deleted, which keeps the attempts of players that point at it.
 */
export async function writePuzzles(
  prisma: PrismaClient,
  rows: readonly PuzzleRow[],
): Promise<number> {
  let inserted = 0;
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const result = await prisma.puzzle.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }
  return inserted;
}
