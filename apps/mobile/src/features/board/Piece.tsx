import type { Color, PieceType } from '@kotgambit/chess-core';
import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { PIECE_XML } from './pieceXml';

interface PieceProps {
  color: Color;
  type: PieceType;
  size: number;
}

export const Piece = memo(function Piece({ color, type, size }: PieceProps) {
  const xml = PIECE_XML[`${color}${type.toUpperCase()}`];
  if (!xml) throw new Error(`Missing piece ${color}${type}`);
  return <SvgXml xml={xml} width={size} height={size} />;
});
