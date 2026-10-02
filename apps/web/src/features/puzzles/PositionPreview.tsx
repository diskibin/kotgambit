import { displaySquares, isLightSquare } from '@kotgambit/board-controller';
import { getPieces, type Color } from '@kotgambit/chess-core';
import { useMemo } from 'react';
import '../board/board.css';
import { pieceUrl } from '../board/pieceAssets';

interface PositionPreviewProps {
  fen: string;
  /** The side at the bottom: the one that has to find the move. */
  orientation: Color;
  /** Edge length in px. */
  size: number;
  label: string;
}

/** A small read-only board for a position, as on the card of the puzzle of the day. */
export function PositionPreview({ fen, orientation, size, label }: PositionPreviewProps) {
  const pieces = useMemo(() => new Map(getPieces(fen).map((p) => [p.square, p])), [fen]);
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="grid shrink-0 grid-cols-8 grid-rows-8 overflow-hidden rounded-[10px] border-2 border-edge"
    >
      {displaySquares(orientation).map((square) => {
        const piece = pieces.get(square);
        return (
          <span
            key={square}
            aria-hidden="true"
            className={`flex items-center justify-center ${isLightSquare(square) ? 'bg-board-b' : 'bg-board-a'}`}
          >
            {piece && <img src={pieceUrl(piece.color, piece.type)} alt="" className="w-[92%]" />}
          </span>
        );
      })}
    </div>
  );
}
