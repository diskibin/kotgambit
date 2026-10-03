import { displaySquares, isLightSquare } from '@kotgambit/board-controller';
import { getPieces } from '@kotgambit/chess-core';
import { useMemo } from 'react';
import { pieceUrl } from '../board/pieceAssets';

/** A small read-only look at a position, as on the card of the puzzle of the day. */
export function PositionBoard({ fen, size }: { fen: string; size: number }) {
  const pieces = useMemo(() => new Map(getPieces(fen).map((p) => [p.square, p])), [fen]);
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="grid shrink-0 grid-cols-8 grid-rows-8 overflow-hidden rounded-[8px] border-2 border-edge"
    >
      {displaySquares('w').map((square) => {
        const piece = pieces.get(square);
        return (
          <span
            key={square}
            className={`flex items-center justify-center ${isLightSquare(square) ? 'bg-board-b' : 'bg-board-a'}`}
          >
            {piece && <img src={pieceUrl(piece.color, piece.type)} alt="" className="w-[92%]" />}
          </span>
        );
      })}
    </div>
  );
}
