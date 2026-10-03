import type { PlacedPiece } from '@kotgambit/chess-core';

const FILES = 'abcdefgh';

/**
 * The pieces of a placement field of a FEN. The decorative boards show positions that are not legal games, such as a
 * lone knight, which the chess library refuses to read, so the pieces are placed here and handed to the board.
 */
export function placementPieces(placement: string): PlacedPiece[] {
  return placement.split('/').flatMap((row, rowIndex) => {
    let file = 0;
    const found: PlacedPiece[] = [];
    for (const char of row) {
      if (/\d/.test(char)) {
        file += Number(char);
        continue;
      }
      found.push({
        square: `${FILES[file]}${8 - rowIndex}`,
        color: char === char.toUpperCase() ? 'w' : 'b',
        type: char.toLowerCase() as PlacedPiece['type'],
      });
      file += 1;
    }
    return found;
  });
}
