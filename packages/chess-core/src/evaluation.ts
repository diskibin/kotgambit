import type { Color } from './types.js';

/** An engine score, from the point of view of the side whose turn it is, as UCI reports it. */
export type EngineScore = { kind: 'cp'; value: number } | { kind: 'mate'; value: number };

// The logistic fit that Lichess uses to turn centipawns into a chance of winning (PLAN.md 5.2),
// to be tuned on real games
const WIN_PERCENT_SLOPE = 0.00368208;
const PERCENT = 100;
// A forced mate is the end of the scale, whatever the number of moves
const MATE_CENTIPAWNS = 10_000;

/** The chance of the side that has the score to win, in percent (0 to 100). */
export function winPercent(score: EngineScore): number {
  const cp =
    score.kind === 'mate'
      ? Math.sign(score.value || 1) * MATE_CENTIPAWNS
      : Math.max(-MATE_CENTIPAWNS, Math.min(MATE_CENTIPAWNS, score.value));
  return PERCENT / 2 + (PERCENT / 2) * (2 / (1 + Math.exp(-WIN_PERCENT_SLOPE * cp)) - 1);
}

/** The score as seen by White: the engine reports it for the side to move. */
export function whiteScore(score: EngineScore, sideToMove: Color): EngineScore {
  return sideToMove === 'w' ? score : { kind: score.kind, value: -score.value };
}

export interface Outlook {
  white: number;
  draw: number;
  black: number;
}

// How much of an even position ends in a draw, shrinking as one side gets ahead. A plain guess
// from the shape of the curve: the engine gives no draw chance, and the plan says to describe facts.
const MAX_DRAW_SHARE = 0.34;
const DRAW_FALLOFF_PERCENT = 40;

/**
 * Splits the chance of White into white, draw and black shares that add up to 100. This is an
 * estimate from the evaluation alone, not a statistic of games.
 */
export function outlook(white: EngineScore): Outlook {
  const whiteWin = winPercent(white);
  const lead = Math.abs(whiteWin - PERCENT / 2);
  const draw = Math.round(PERCENT * MAX_DRAW_SHARE * Math.max(0, 1 - lead / DRAW_FALLOFF_PERCENT));
  const whiteShare = Math.round(Math.max(0, whiteWin - draw / 2));
  return { white: whiteShare, draw, black: Math.max(0, PERCENT - whiteShare - draw) };
}

export type MoveQuality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

// Drops of the chance of winning, in percentage points (PLAN.md 5.2), to be tuned on real games
export const INACCURACY_DROP = 5;
export const MISTAKE_DROP = 10;
export const BLUNDER_DROP = 20;
// A move this close to the best one is called best even if it is another one
const BEST_DROP = 1;

/**
 * Judges a move by how much the mover's chance of winning fell: `before` is the chance with the
 * best play, `after` the chance after the move that was played, both for the mover.
 */
export function classifyMove(before: number, after: number, playedBest: boolean): MoveQuality {
  const drop = before - after;
  if (playedBest || drop <= BEST_DROP) return 'best';
  if (drop < INACCURACY_DROP) return 'good';
  if (drop < MISTAKE_DROP) return 'inaccuracy';
  if (drop < BLUNDER_DROP) return 'mistake';
  return 'blunder';
}

// The Lichess fit of the accuracy of one move to the drop of the chance of winning
const ACCURACY_SCALE = 103.1668;
const ACCURACY_DECAY = 0.04354;
const ACCURACY_OFFSET = 3.1669;

/** How accurate one move was, from 0 to 100, given how much the chance of winning fell. */
export function moveAccuracy(drop: number): number {
  const value = ACCURACY_SCALE * Math.exp(-ACCURACY_DECAY * Math.max(0, drop)) - ACCURACY_OFFSET;
  return Math.max(0, Math.min(PERCENT, value));
}

/** The accuracy of a player over a game: the mean of their moves, `null` when they made none. */
export function gameAccuracy(drops: readonly number[]): number | null {
  if (drops.length === 0) return null;
  const total = drops.reduce((sum, drop) => sum + moveAccuracy(drop), 0);
  return Math.round(total / drops.length);
}
