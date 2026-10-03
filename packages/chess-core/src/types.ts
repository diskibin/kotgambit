export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionPiece = 'n' | 'b' | 'r' | 'q';

/** Algebraic square such as `e4`. */
export type Square = string;

export interface PlacedPiece {
  square: Square;
  color: Color;
  type: PieceType;
}

export interface Move {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
  san: string;
  /** Long algebraic notation as used by UCI engines, e.g. `e7e8q`. */
  uci: string;
  isCapture: boolean;
}

export type DrawReason =
  'stalemate' | 'insufficient-material' | 'fifty-moves' | 'threefold-repetition';

export type GameStatus =
  | { kind: 'playing'; inCheck: boolean }
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'draw'; reason: DrawReason };

export type ApplyMoveResult =
  { ok: true; fen: string; move: Move } | { ok: false; reason: 'invalid-fen' | 'illegal-move' };
