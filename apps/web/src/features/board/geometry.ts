import type { Color, Square } from '@kotgambit/chess-core';

export const FILES = 'abcdefgh';
export const BOARD_SIZE = 8;

/** Squares in the order they are drawn: left to right, top to bottom. */
export function displaySquares(orientation: Color): Square[] {
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8];
  const rows = orientation === 'w' ? ranks.toReversed() : ranks;
  const files = orientation === 'w' ? [...FILES] : [...FILES].reverse();
  return rows.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

/** a1 is dark and h1 is light, as on a real board. */
export function isLightSquare(square: Square): boolean {
  const file = FILES.indexOf(square.charAt(0));
  const rank = Number(square.charAt(1));
  return (file + rank) % 2 === 0;
}

export function squareAtPoint(
  orientation: Color,
  rect: { left: number; top: number; width: number; height: number },
  x: number,
  y: number,
): Square | null {
  const col = Math.floor(((x - rect.left) / rect.width) * BOARD_SIZE);
  const row = Math.floor(((y - rect.top) / rect.height) * BOARD_SIZE);
  if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return null;
  return displaySquares(orientation)[row * BOARD_SIZE + col] ?? null;
}

/** Neighbour in display space, so arrow keys follow what the player sees. */
export function neighbour(
  orientation: Color,
  square: Square,
  dCol: number,
  dRow: number,
): Square | null {
  const squares = displaySquares(orientation);
  const index = squares.indexOf(square);
  if (index < 0) return null;
  const col = (index % BOARD_SIZE) + dCol;
  const row = Math.floor(index / BOARD_SIZE) + dRow;
  if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return null;
  return squares[row * BOARD_SIZE + col] ?? null;
}
