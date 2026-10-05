import type { Color, PieceType } from '@kotgambit/chess-core';
import type { PieceSet } from '@kotgambit/preferences';

const urls = import.meta.glob<string>('../../../../../assets/pieces/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

// The other sets live in a folder each: assets/piece-sets/<set>/wK.svg
const otherUrls = import.meta.glob<string>('../../../../../assets/piece-sets/*/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byKey = new Map(
  Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);
const bySet = new Map(
  Object.entries(otherUrls).map(([path, url]) => {
    const parts = path.split('/');
    return [`${parts[parts.length - 2]}/${parts[parts.length - 1]?.slice(0, -4)}`, url];
  }),
);

export function pieceKey(color: Color, type: PieceType): string {
  return `${color}${type.toUpperCase()}`;
}

/** The picture of a piece in a set, the cat's own set unless another is asked for. */
export function pieceUrl(color: Color, type: PieceType, set: PieceSet = 'gambit'): string {
  const key = pieceKey(color, type);
  const url = set === 'gambit' ? byKey.get(key) : bySet.get(`${set}/${key}`);
  if (!url) throw new Error(`Missing piece asset ${set}/${key}`);
  return url;
}
