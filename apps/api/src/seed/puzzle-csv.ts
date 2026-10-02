export interface PuzzleRow {
  id: string;
  /** The position before the opponent's first move. */
  fen: string;
  moves: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  plays: number;
  themes: string[];
  openingTags: string[];
}

export interface ParseStats {
  /** Data rows seen, without the header. */
  read: number;
  /** Rows that did not look like a puzzle and were left out. */
  malformed: number;
}

// Columns are looked up by name: the file has grown a column before (DailyDate) and may do it again
const REQUIRED_COLUMNS = [
  'PuzzleId',
  'FEN',
  'Moves',
  'Rating',
  'RatingDeviation',
  'Popularity',
  'NbPlays',
  'Themes',
  'OpeningTags',
] as const;

const ID_PATTERN = /^[A-Za-z0-9]{5}$/;
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][nbrq]?$/;

function words(cell: string): string[] {
  return cell.split(' ').filter(Boolean);
}

function integer(cell: string | undefined): number | null {
  if (cell === undefined || cell === '') return null;
  const value = Number(cell);
  return Number.isInteger(value) ? value : null;
}

/**
 * Reads the Lichess puzzle CSV. The fields never hold commas or quotes (the themes and the moves are
 * separated by spaces), so a plain split is enough.
 */
export async function* parsePuzzleRows(
  lines: AsyncIterable<string>,
  stats: ParseStats,
): AsyncGenerator<PuzzleRow> {
  let columns: Map<string, number> | null = null;

  for await (const line of lines) {
    if (line === '') continue;
    const cells = line.split(',');

    if (!columns) {
      columns = new Map(cells.map((name, index) => [name.trim(), index]));
      const missing = REQUIRED_COLUMNS.filter((name) => !columns?.has(name));
      if (missing.length > 0)
        throw new Error(`The puzzle file has no column ${missing.join(', ')}`);
      continue;
    }

    stats.read += 1;
    const cell = (name: (typeof REQUIRED_COLUMNS)[number]) => cells[columns?.get(name) ?? -1];
    const id = cell('PuzzleId');
    const fen = cell('FEN');
    const moves = words(cell('Moves') ?? '');
    const rating = integer(cell('Rating'));
    const ratingDeviation = integer(cell('RatingDeviation'));
    const popularity = integer(cell('Popularity'));
    const plays = integer(cell('NbPlays'));

    if (
      !id ||
      !ID_PATTERN.test(id) ||
      !fen ||
      moves.length < 2 ||
      !moves.every((move) => UCI_PATTERN.test(move)) ||
      rating === null ||
      ratingDeviation === null ||
      popularity === null ||
      plays === null
    ) {
      stats.malformed += 1;
      continue;
    }

    yield {
      id,
      fen,
      moves,
      rating,
      ratingDeviation,
      popularity,
      plays,
      themes: words(cell('Themes') ?? ''),
      openingTags: words(cell('OpeningTags') ?? ''),
    };
  }
  if (!columns) throw new Error('The puzzle file is empty');
}
