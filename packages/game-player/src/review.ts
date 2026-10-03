import { winPercent, type EngineScore } from '@kotgambit/chess-core';
import type { GameReview } from '@kotgambit/contracts';

const PAWN_CENTIPAWNS = 100;
const SCALE_FULL = 100;

/** The score the way a chess player reads it: `+0.3`, `-1.2`, `M3` for a mate in three, `-M2` against. */
export function formatScore(score: EngineScore): string {
  if (score.kind === 'mate') return `${score.value < 0 ? '-' : ''}M${Math.abs(score.value)}`;
  const pawns = score.value / PAWN_CENTIPAWNS;
  const text = Math.abs(pawns).toFixed(1);
  if (pawns === 0 || text === '0.0') return '0.0';
  return `${pawns > 0 ? '+' : '-'}${text}`;
}

/** How much of the scale bar is White's, from 0 to 100. The bar is read from White's side. */
export function whiteShare(score: EngineScore): number {
  return Math.round(winPercent(score));
}

export type Quality = GameReview['qualities'][number];

/** The marks of the design: ★ best, ✓ good, ?! inaccuracy, ? mistake, ?? blunder. */
export const QUALITY_MARKS: Record<Quality, string> = {
  best: '★',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

export interface GraphPoint {
  x: number;
  y: number;
}

/**
 * The points of the line of chances in a box of `width` by `height`: the first position on the left, the last
 * on the right, 100% for White at the top. A game with no moves is one point in the middle.
 */
export function chancesGraph(
  chances: readonly number[],
  width: number,
  height: number,
): GraphPoint[] {
  const last = Math.max(1, chances.length - 1);
  return chances.map((chance, index) => ({
    x: (index / last) * width,
    y: height - (chance / SCALE_FULL) * height,
  }));
}

/** The SVG path of the line through the points, `M x y L x y …`. */
export function graphPath(points: readonly GraphPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

/** "0 : 1 · мат на 4-м ходу" needs the number of the last move: the full moves played. */
export function lastMoveNumber(plies: number): number {
  return Math.ceil(plies / 2);
}

/**
 * A line the way a book writes it: `4…d5 5.exd5 Na5` when Black starts it, `5.exd5 Na5` for White.
 * The move number and the side come from the position the line starts from.
 */
export function formatLine(fen: string, san: readonly string[]): string {
  const fields = fen.trim().split(/\s+/);
  let side = fields[1] === 'b' ? 'b' : 'w';
  let number = Number(fields[5]) || 1;
  const parts: string[] = [];
  san.forEach((move, index) => {
    if (side === 'w') parts.push(`${number}.${move}`);
    else {
      parts.push(index === 0 ? `${number}…${move}` : move);
      number += 1;
    }
    side = side === 'w' ? 'b' : 'w';
  });
  return parts.join(' ');
}
