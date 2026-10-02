import { displaySquares, isLightSquare } from '@kotgambit/board-controller';
import { getPieces, type Color } from '@kotgambit/chess-core';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { shashka } from '../../theme/theme';
import { Piece } from '../board/Piece';

const BOARD = 8;
const PIECE_SCALE = 0.92;
const CORNER = 10;

interface PositionPreviewProps {
  fen: string;
  /** The side at the bottom: the one that has to find the move. */
  orientation: Color;
  /** Edge length in dp. */
  size: number;
  label: string;
}

/** A small read-only board for a position, as on the card of the puzzle of the day. */
export function PositionPreview({ fen, orientation, size, label }: PositionPreviewProps) {
  const { colors } = useTheme();
  const pieces = useMemo(() => new Map(getPieces(fen).map((p) => [p.square, p])), [fen]);
  const cell = (size - shashka.border * 2) / BOARD;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        flexWrap: 'wrap',
        overflow: 'hidden',
        borderRadius: CORNER,
        borderWidth: shashka.border,
        borderColor: colors.edge,
      }}
    >
      {displaySquares(orientation).map((square) => {
        const piece = pieces.get(square);
        return (
          <View
            key={square}
            importantForAccessibility="no-hide-descendants"
            style={{
              width: cell,
              height: cell,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isLightSquare(square) ? colors.boardB : colors.boardA,
            }}
          >
            {piece && <Piece color={piece.color} type={piece.type} size={cell * PIECE_SCALE} />}
          </View>
        );
      })}
    </View>
  );
}
