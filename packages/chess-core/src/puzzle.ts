import { applyMove, getStatus } from './position.js';
import type { Color } from './types.js';

/**
 * A puzzle line as the Lichess database stores it: `fen` is the position before the opponent's move,
 * `moves[0]` is that move, then the solver's move and the opponent's reply alternate and the line ends with
 * a solver move. So the solver's moves sit at the odd indexes.
 */
export interface PuzzleStart {
  /** The position the solver sees, after the opponent's first move. */
  fen: string;
  /** The opponent's first move, for the interface to show what just happened. */
  lastMove: string;
  solver: Color;
}

export function startPuzzle(fen: string, moves: readonly string[]): PuzzleStart | null {
  const first = moves[0];
  if (first === undefined || moves.length < 2 || moves.length % 2 !== 0) return null;
  const played = applyMove(fen, first);
  if (!played.ok) return null;
  const status = getStatus(played.fen);
  if (!status || status.kind !== 'playing') return null;
  return {
    fen: played.fen,
    lastMove: first,
    solver: played.fen.split(' ')[1] === 'w' ? 'w' : 'b',
  };
}

export type PuzzleMoveResult =
  /** The move is not legal, or the moves played so far do not follow the line. */
  | { kind: 'illegal' }
  | { kind: 'wrong' }
  /** `reply` is the opponent's answer to play next, `null` once the puzzle is solved. */
  | { kind: 'correct'; solved: boolean; reply: string | null };

function deliversMate(fen: string, uci: string): boolean {
  const result = applyMove(fen, uci);
  if (!result.ok) return false;
  const status = getStatus(result.fen);
  return status?.kind === 'checkmate';
}

/**
 * Replays the moves already accepted from `start` and returns the position and the index in `moves` of the
 * solver's next move, which is past the end once the puzzle is solved. `null` when the history does not
 * follow the line.
 */
function replay(
  start: PuzzleStart,
  moves: readonly string[],
  played: readonly string[],
): { fen: string; index: number } | null {
  let fen = start.fen;
  let index = 1;
  for (const uci of played) {
    const expected = moves[index];
    const result = applyMove(fen, uci);
    if (expected === undefined || !result.ok) return null;
    const mate = uci !== expected && deliversMate(fen, uci);
    // Only a mating move may differ from the line
    if (uci !== expected && !mate) return null;
    fen = result.fen;
    if (mate) return index === played.length * 2 - 1 ? { fen, index: moves.length } : null;
    const reply = moves[index + 1];
    // The last move of the line has no reply, and the puzzle ends there
    if (reply === undefined)
      return index === played.length * 2 - 1 ? { fen, index: moves.length } : null;
    const answered = applyMove(fen, reply);
    if (!answered.ok) return null;
    fen = answered.fen;
    index += 2;
  }
  return { fen, index };
}

/**
 * Checks the solver's next move. Any move that gives checkmate solves the puzzle, not only the one in the
 * line: for a mate puzzle a different mate is as good, and calling it wrong would be unfair. Other
 * alternatives are judged wrong, because telling a good move from a bad one needs an engine.
 */
export function checkPuzzleMove(
  fen: string,
  moves: readonly string[],
  played: readonly string[],
  move: string,
): PuzzleMoveResult {
  const start = startPuzzle(fen, moves);
  if (!start) return { kind: 'illegal' };
  const position = replay(start, moves, played);
  if (!position) return { kind: 'illegal' };
  const expected = moves[position.index];
  if (expected === undefined) return { kind: 'illegal' };
  if (!applyMove(position.fen, move).ok) return { kind: 'illegal' };

  if (deliversMate(position.fen, move)) return { kind: 'correct', solved: true, reply: null };
  if (move !== expected) return { kind: 'wrong' };

  const reply = moves[position.index + 1];
  return reply === undefined
    ? { kind: 'correct', solved: true, reply: null }
    : { kind: 'correct', solved: false, reply };
}

/** The move the line asks for next, for the last level of hints. */
export function nextSolutionMove(
  fen: string,
  moves: readonly string[],
  played: readonly string[],
): string | null {
  const start = startPuzzle(fen, moves);
  if (!start) return null;
  const position = replay(start, moves, played);
  return position ? (moves[position.index] ?? null) : null;
}

/** What is left of the line from here: the solver's move, the reply, and so on to the end. */
export function remainingSolution(
  fen: string,
  moves: readonly string[],
  played: readonly string[],
): string[] | null {
  const start = startPuzzle(fen, moves);
  if (!start) return null;
  const position = replay(start, moves, played);
  return position ? moves.slice(position.index) : null;
}

/** Every move of the line is legal in turn and the solver has a position to solve, not a finished game. */
export function isPlayablePuzzle(fen: string, moves: readonly string[]): boolean {
  if (!startPuzzle(fen, moves)) return false;
  let position = fen;
  for (const uci of moves) {
    const result = applyMove(position, uci);
    if (!result.ok) return false;
    position = result.fen;
  }
  return true;
}
