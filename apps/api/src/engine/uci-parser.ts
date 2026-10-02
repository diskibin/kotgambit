export type Score = { kind: 'cp'; value: number } | { kind: 'mate'; value: number };

export interface InfoLine {
  depth: number;
  /** 1-based index of the line, 1 is the best. A single-line search reports no multipv at all. */
  multipv: number;
  score: Score;
  nodes: number | undefined;
  timeMs: number | undefined;
  /** The principal variation in UCI notation. */
  pv: string[];
}

export interface BestMove {
  /** `null` when the side to move has no legal move, the engine says `bestmove (none)`. */
  move: string | null;
  ponder: string | null;
}

const NO_MOVE = '(none)';

function nextNumber(tokens: string[], key: string): number | undefined {
  const index = tokens.indexOf(key);
  if (index === -1) return undefined;
  const value = Number(tokens[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

function parseScore(tokens: string[]): Score | null {
  const index = tokens.indexOf('score');
  const kind = tokens[index + 1];
  const value = Number(tokens[index + 2]);
  if (index === -1 || !Number.isFinite(value)) return null;
  if (kind === 'cp') return { kind: 'cp', value };
  if (kind === 'mate') return { kind: 'mate', value };
  return null;
}

/**
 * Reads one `info` line. Returns `null` for lines that carry no usable result: `info string`,
 * `info currmove` and so on. Scores marked `lowerbound` or `upperbound` are dropped too, they appear
 * while the engine is still re-searching after a fail high or low and are not the value of the depth.
 */
export function parseInfo(line: string): InfoLine | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info' || tokens[1] === 'string') return null;
  if (tokens.includes('lowerbound') || tokens.includes('upperbound')) return null;

  const depth = nextNumber(tokens, 'depth');
  const score = parseScore(tokens);
  const pvIndex = tokens.indexOf('pv');
  if (depth === undefined || score === null || pvIndex === -1) return null;

  return {
    depth,
    multipv: nextNumber(tokens, 'multipv') ?? 1,
    score,
    nodes: nextNumber(tokens, 'nodes'),
    timeMs: nextNumber(tokens, 'time'),
    pv: tokens.slice(pvIndex + 1),
  };
}

export function parseBestMove(line: string): BestMove | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove' || tokens[1] === undefined) return null;
  const ponderIndex = tokens.indexOf('ponder');
  return {
    move: tokens[1] === NO_MOVE ? null : tokens[1],
    ponder: ponderIndex === -1 ? null : (tokens[ponderIndex + 1] ?? null),
  };
}
