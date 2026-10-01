import { displaySquares, isLightSquare } from '@kotgambit/board-controller';
import { getPieces, legalMoves, type Square } from '@kotgambit/chess-core';
import type { Piece as PieceLetter } from '@kotgambit/content-schema';
import { useMemo } from 'react';
import { View } from 'react-native';
import { boardHighlight } from '../../theme/board';
import { useTheme } from '../../theme/ThemeProvider';
import { shashka } from '../../theme/theme';
import { Piece } from '../board/Piece';

const BOARD = 8;
const COVER_SQUARE = 'd4';
const PIECE_SCALE = 0.92;
const DOT_RATIO = 0.28;

/** A cover position for a chapter: its piece in the middle of an empty board, kings far in the corners. */
function coverFen(piece: PieceLetter): string {
  const letter = piece.toUpperCase();
  return piece === 'k' ? '7k/8/8/8/3K4/8/8/8 w - - 0 1' : `7k/8/8/8/3${letter}4/8/8/4K3 w - - 0 1`;
}

interface MiniBoardProps {
  piece: PieceLetter;
  /** Edge length in dp. */
  size: number;
  /** Dots on the squares the piece can go to, as on the current chapter card. */
  moves?: boolean;
}

/** A small read-only board for chapter cards: only the squares and the chapter's piece. */
export function MiniBoard({ piece, size, moves = false }: MiniBoardProps) {
  const { colors } = useTheme();
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
  const inner = size - shashka.border * 2;
  const cell = inner / BOARD;

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        flexWrap: 'wrap',
        overflow: 'hidden',
        borderRadius: 10,
        borderWidth: shashka.border,
        borderColor: colors.edge,
      }}
    >
      {displaySquares('w').map((square) => {
        const found = pieces.get(square);
        // The kings only make the position legal: a cover shows the chapter's piece alone
        const shown =
          found && (found.type === piece || piece === 'k') && found.color === 'w' ? found : null;
        return (
          <View
            key={square}
            style={{
              width: cell,
              height: cell,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isLightSquare(square) ? colors.boardB : colors.boardA,
            }}
          >
            {shown && <Piece color={shown.color} type={shown.type} size={cell * PIECE_SCALE} />}
            {dots.has(square) && (
              <View
                style={{
                  position: 'absolute',
                  width: cell * DOT_RATIO,
                  height: cell * DOT_RATIO,
                  borderRadius: cell,
                  backgroundColor: boardHighlight.moveDot,
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
