import { Chess } from 'chess.js';
import type { Color, Square } from './types.js';

/**
 * Why a position cannot be on a board, in the order the editor tells it. `where` is a square the
 * learner can fix or look at, when one makes sense.
 */
export type PositionProblem =
  | { kind: 'malformed' }
  | { kind: 'no-king'; color: Color }
  | { kind: 'many-kings'; color: Color }
  | { kind: 'pawn-on-edge'; square: Square }
  | { kind: 'kings-touch' }
  | { kind: 'too-many-pieces'; color: Color }
  | { kind: 'side-not-to-move-in-check' }
  | { kind: 'illegal' };

const FILES = 'abcdefgh';
const BOARD_SIZE = 8;
const MAX_PIECES = 16;
const MAX_PAWNS = 8;

interface Placed {
  color: Color;
  type: string;
  square: Square;
}

function parsePlacement(placement: string): Placed[] | null {
  const rows = placement.split('/');
  if (rows.length !== BOARD_SIZE) return null;
  const pieces: Placed[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    let file = 0;
    for (const char of row) {
      if (/[1-8]/.test(char)) {
        file += Number(char);
      } else if (/[pnbrqkPNBRQK]/.test(char)) {
        if (file >= BOARD_SIZE) return null;
        pieces.push({
          color: char === char.toUpperCase() ? 'w' : 'b',
          type: char.toLowerCase(),
          square: `${FILES[file]}${BOARD_SIZE - rowIndex}`,
        });
        file += 1;
      } else {
        return null;
      }
    }
    if (file !== BOARD_SIZE) return null;
  }
  return pieces;
}

const chebyshev = (a: Square, b: Square) =>
  Math.max(
    Math.abs(FILES.indexOf(a[0] as string) - FILES.indexOf(b[0] as string)),
    Math.abs(Number(a[1]) - Number(b[1])),
  );

/**
 * Checks a position the way a person building it on a board needs: the first thing that cannot be,
 * or `null` when the position is fine for an engine. A bare FEN is enough, the move counters may be
 * missing as the editor does not know them.
 */
export function positionProblem(fen: string): PositionProblem | null {
  const fields = fen.trim().split(/\s+/);
  const pieces = fields[0] ? parsePlacement(fields[0]) : null;
  if (!pieces || fields[1] === undefined || !/^[wb]$/.test(fields[1])) {
    return { kind: 'malformed' };
  }

  for (const color of ['w', 'b'] as const) {
    const mine = pieces.filter((piece) => piece.color === color);
    const kings = mine.filter((piece) => piece.type === 'k');
    if (kings.length === 0) return { kind: 'no-king', color };
    if (kings.length > 1) return { kind: 'many-kings', color };
    if (mine.length > MAX_PIECES || mine.filter((p) => p.type === 'p').length > MAX_PAWNS) {
      return { kind: 'too-many-pieces', color };
    }
  }
  const edgePawn = pieces.find(
    (piece) => piece.type === 'p' && (piece.square.endsWith('1') || piece.square.endsWith('8')),
  );
  if (edgePawn) return { kind: 'pawn-on-edge', square: edgePawn.square };

  const [whiteKing, blackKing] = ['w', 'b'].map(
    (color) => pieces.find((p) => p.type === 'k' && p.color === color)?.square as Square,
  ) as [Square, Square];
  if (chebyshev(whiteKing, blackKing) <= 1) return { kind: 'kings-touch' };

  // chess.js wants all six fields and sensible castling and en passant parts
  const full = [
    fields[0],
    fields[1],
    fields[2] ?? '-',
    fields[3] ?? '-',
    fields[4] ?? '0',
    fields[5] ?? '1',
  ];
  let game: Chess;
  try {
    game = new Chess(full.join(' '));
  } catch {
    return { kind: 'illegal' };
  }
  // The side that is not to move cannot be in check, the last move would have left its king under attack
  const mover = game.turn();
  const waiting = mover === 'w' ? blackKing : whiteKing;
  if (game.isAttacked(waiting as Parameters<Chess['isAttacked']>[0], mover)) {
    return { kind: 'side-not-to-move-in-check' };
  }
  return null;
}
