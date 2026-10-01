import { displaySquares, isLightSquare } from '@kotgambit/board-controller';
import { getPieces, legalMoves, type Square } from '@kotgambit/chess-core';
import type { Piece } from '@kotgambit/content-schema';
import { useMemo } from 'react';
import '../board/board.css';
import { pieceUrl } from '../board/pieceAssets';

const COVER_SQUARE = 'd4';

/** A cover position for a chapter: its piece in the middle of an empty board, kings far in the corners. */
function coverFen(piece: Piece): string {
  const letter = piece.toUpperCase();
  return piece === 'k' ? '7k/8/8/8/3K4/8/8/8 w - - 0 1' : `7k/8/8/8/3${letter}4/8/8/4K3 w - - 0 1`;
}

interface MiniBoardProps {
  piece: Piece;
  /** Edge length in px. */
  size: number;
  /** Dots on the squares the piece can go to, as on the current chapter card. */
  moves?: boolean;
}

/** A small read-only board for chapter cards: no buttons, no labels, only the squares and pieces. */
export function MiniBoard({ piece, size, moves = false }: MiniBoardProps) {
  const fen = useMemo(() => coverFen(piece), [piece]);
  const pieces = useMemo(() => new Map(getPieces(fen).map((p) => [p.square, p])), [fen]);
  const dots = useMemo<Set<Square>>(
    () =>
      new Set(
        moves
          ? legalMoves(fen)
              .filter((m) => m.from === COVER_SQUARE)
              .map((m) => m.to)
          : [],
      ),
    [fen, moves],
  );

  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="grid shrink-0 grid-cols-8 grid-rows-8 overflow-hidden rounded-[10px] border-2 border-edge"
    >
      {displaySquares('w').map((square) => {
        const found = pieces.get(square);
        // The kings only make the position legal: a cover shows the chapter's piece alone
        const shown =
          found && (found.type === piece || piece === 'k') && found.color === 'w' ? found : null;
        return (
          <span
            key={square}
            className={`relative flex items-center justify-center ${isLightSquare(square) ? 'bg-board-b' : 'bg-board-a'}`}
          >
            {shown && <img src={pieceUrl(shown.color, shown.type)} alt="" className="w-[92%]" />}
            {dots.has(square) && <span className="board-dot absolute" />}
          </span>
        );
      })}
    </div>
  );
}
