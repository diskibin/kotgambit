import type { Color, PieceType } from '@kotgambit/chess-core';

const urls = import.meta.glob<string>('../../../../../assets/pieces/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byKey = new Map(
  Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

export function pieceKey(color: Color, type: PieceType): string {
  return `${color}${type.toUpperCase()}`;
}

export function pieceUrl(color: Color, type: PieceType): string {
  const url = byKey.get(pieceKey(color, type));
  if (!url) throw new Error(`Missing piece asset ${pieceKey(color, type)}`);
  return url;
}
