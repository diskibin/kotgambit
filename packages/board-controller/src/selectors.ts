import { legalMoves, type Square } from '@kotgambit/chess-core';
import type { BoardState } from './reducer.js';

/** Squares the selected piece can move to, narrowed to the allowed moves in lesson mode. */
export function selectTargetSquares(state: BoardState): Square[] {
  const { selected, allowedMoves } = state;
  if (!selected) return [];
  const targets = legalMoves(state.fen)
    .filter((m) => m.from === selected && (allowedMoves === null || allowedMoves.includes(m.uci)))
    .map((m) => m.to);
  return [...new Set(targets)];
}
