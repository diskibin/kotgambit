import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePuzzleRows, type ParseStats, type PuzzleRow } from './puzzle-csv.js';
import { readLines } from './zstd-frames.js';

// Real rows of the Lichess puzzle database (CC0)
const SAMPLE = fileURLToPath(
  new URL('../../test/fixtures/lichess-puzzles-sample.csv', import.meta.url),
);
const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate';
const FEN = '4rk2/p1q5/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 b - - 0 43';

async function* from(...lines: string[]): AsyncGenerator<string> {
  for (const line of lines) yield line;
}

async function parse(...lines: string[]): Promise<{ rows: PuzzleRow[]; stats: ParseStats }> {
  const stats: ParseStats = { read: 0, malformed: 0 };
  const rows: PuzzleRow[] = [];
  for await (const row of parsePuzzleRows(from(...lines), stats)) rows.push(row);
  return { rows, stats };
}

describe('parsePuzzleRows', () => {
  it('reads real rows of the database', async () => {
    const stats: ParseStats = { read: 0, malformed: 0 };
    const rows: PuzzleRow[] = [];
    for await (const row of parsePuzzleRows(readLines(SAMPLE), stats)) rows.push(row);

    expect(stats).toEqual({ read: 6, malformed: 0 });
    expect(rows.find((row) => row.id === '005Bm')).toEqual({
      id: '005Bm',
      fen: FEN,
      moves: ['c7f7', 'h4g6', 'f8g8', 'f6h8'],
      rating: 1434,
      ratingDeviation: 76,
      popularity: 96,
      plays: 6584,
      themes: ['endgame', 'mate', 'mateIn2', 'pin', 'short'],
      openingTags: [],
    });
  });

  it('reads the opening tags and ignores the daily date and the game address', async () => {
    const { rows } = await parse(
      HEADER,
      `Ab123,${FEN},c7f7 h4g6,1500,75,90,500,fork,https://lichess.org/x,Sicilian_Defense Sicilian_Defense_Alapin,1650613793268`,
    );
    expect(rows[0]?.openingTags).toEqual(['Sicilian_Defense', 'Sicilian_Defense_Alapin']);
  });

  it('finds the columns by name, wherever they are', async () => {
    const { rows } = await parse(
      'Themes,Moves,FEN,PuzzleId,NbPlays,Popularity,RatingDeviation,Rating,OpeningTags,Extra',
      `fork,c7f7 h4g6,${FEN},Ab123,500,90,75,1500,,whatever`,
    );
    expect(rows[0]).toMatchObject({ id: 'Ab123', moves: ['c7f7', 'h4g6'], rating: 1500 });
  });

  it('counts a row that is not a puzzle and goes on', async () => {
    const good = `Ab123,${FEN},c7f7 h4g6,1500,75,90,500,fork,url,,`;
    const { rows, stats } = await parse(
      HEADER,
      good,
      `Ab124,${FEN},c7f7,1500,75,90,500,fork,url,,`, // one move is no puzzle
      `Ab125,${FEN},c7f7 zz,1500,75,90,500,fork,url,,`, // not a UCI move
      `Ab126,${FEN},c7f7 h4g6,abc,75,90,500,fork,url,,`, // a rating that is no number
      `toolong1,${FEN},c7f7 h4g6,1500,75,90,500,fork,url,,`, // an id of the wrong shape
      'broken',
      '',
      good.replace('Ab123', 'Ab127'),
    );
    expect(rows.map((row) => row.id)).toEqual(['Ab123', 'Ab127']);
    expect(stats).toEqual({ read: 7, malformed: 5 });
  });

  it('fails on a file without a needed column or without anything in it', async () => {
    await expect(parse('PuzzleId,FEN,Moves')).rejects.toThrow('no column Rating');
    await expect(parse()).rejects.toThrow('empty');
  });
});
