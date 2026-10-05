import type { Color, PieceType } from '@kotgambit/chess-core';
import type { PieceSet } from '@kotgambit/preferences';
import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { PIECE_SET_XML } from './pieceXml';

interface PieceProps {
  color: Color;
  type: PieceType;
  size: number;
  /** The set to draw from: the cat's own unless the board asks for the one the learner chose. */
  set?: PieceSet;
}

export const Piece = memo(function Piece({ color, type, size, set = 'gambit' }: PieceProps) {
  const xml = PIECE_SET_XML[set]?.[`${color}${type.toUpperCase()}`];
  if (!xml) throw new Error(`Missing piece ${set}/${color}${type}`);
  return <SvgXml xml={xml} width={size} height={size} />;
});
