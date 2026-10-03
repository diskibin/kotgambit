import {
  BOARD_SIZE,
  displaySquares,
  isLightSquare,
  selectTargetSquares,
  squareAtPoint,
  type BoardAction,
  type BoardState,
} from '@kotgambit/board-controller';
import {
  checkedKingSquare,
  getPieces,
  legalMoves,
  turn,
  type PlacedPiece,
  type PromotionPiece,
  type Square,
} from '@kotgambit/chess-core';
import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Svg, { Defs, Line, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { boardHighlight, coordColors } from '../../theme/board';
import { useTheme, type Colors, type Scheme } from '../../theme/ThemeProvider';
import { radius, shashka, size as sizes } from '../../theme/theme';
import { Piece } from './Piece';

// A drag starts only after the finger travels this far, so that a tap stays a tap
const DRAG_THRESHOLD = 4;
const DRAG_PIECE_SCALE = 1.25;
const PIECE_SCALE = 0.9;
// The piece is lifted above the finger so that the finger does not hide it
const DRAG_LIFT_SQUARES = 1;
const PROMOTION_PIECES: PromotionPiece[] = ['q', 'r', 'b', 'n'];
const PROMOTION_BORDER = 3;
const PROMOTION_EDGE_DEPTH = 4;
// Embedded in android/app/src/main/assets/fonts
const COORD_FONT = 'Onest-ExtraBold';
const MIN_COORD_FONT = 9;
const COORD_FONT_RATIO = 0.2;
const SELECTION_INSET = 3;
const SELECTION_BORDER = 4;
const MOVE_DOT_RATIO = 0.28;
const CHECK_BADGE = 18;
// Where the dark corners of a capture square end, as in the design's radial gradient
const CAPTURE_RADIUS = 43.8;
const CHECK_GLOW_STOPS = [
  { offset: '0', opacity: 0.95 },
  { offset: '0.45', opacity: 0.5 },
  { offset: '0.72', opacity: 0 },
] as const;

interface BoardProps {
  state: BoardState;
  dispatch: (action: BoardAction) => void;
  /** Outer width including the frame; the shadow of the frame needs a few more dp to the right and below. */
  size?: number;
  hintSquares?: readonly Square[];
  coords?: boolean;
  disabled?: boolean;
  arrows?: readonly BoardArrow[];
  /** Squares marked by the learner, drawn like a selection. */
  marked?: readonly Square[];
  /**
   * The pieces to draw, when the position is not a legal one that the FEN could carry, as in the
   * position editor. Without it the pieces are read from the FEN.
   */
  pieces?: readonly PlacedPiece[];
  /**
   * When given, squares only report presses to it: no piece is selected, moved or dragged.
   * Used where the learner marks squares instead of moving.
   */
  onSquarePress?: (square: Square) => void;
  /** Overrides the last move of the state, for the positions of a demo. */
  lastMove?: { from: Square; to: Square } | null;
}

export interface BoardArrow {
  from: Square;
  to: Square;
  color: 'sky' | 'sun' | 'mint' | 'brand';
}

const ARROW_LINE_WIDTH = 0.2;
const ARROW_HEAD_LENGTH = 0.5;
const ARROW_HEAD_HALF_WIDTH = 0.3;
const ARROW_OPACITY = 0.9;

/** Arrows over the board in board units (8 by 8), so they scale with it. */
function Arrows({
  arrows,
  orientation,
  colors,
}: {
  arrows: readonly BoardArrow[];
  orientation: BoardState['orientation'];
  colors: Colors;
}) {
  if (arrows.length === 0) return null;
  const palette = {
    sky: colors.sky,
    sun: colors.sunDepth,
    mint: colors.mintDepth,
    brand: colors.brand,
  };
  const squares = displaySquares(orientation);
  const centre = (square: Square) => {
    const index = squares.indexOf(square);
    return { x: (index % BOARD_SIZE) + 0.5, y: Math.floor(index / BOARD_SIZE) + 0.5 };
  };
  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
    >
      {arrows.map((arrow) => {
        const from = centre(arrow.from);
        const to = centre(arrow.to);
        const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        const ux = (to.x - from.x) / length;
        const uy = (to.y - from.y) / length;
        const bx = to.x - ux * ARROW_HEAD_LENGTH;
        const by = to.y - uy * ARROW_HEAD_LENGTH;
        const head = [
          `${to.x},${to.y}`,
          `${bx - uy * ARROW_HEAD_HALF_WIDTH},${by + ux * ARROW_HEAD_HALF_WIDTH}`,
          `${bx + uy * ARROW_HEAD_HALF_WIDTH},${by - ux * ARROW_HEAD_HALF_WIDTH}`,
        ].join(' ');
        const color = palette[arrow.color];
        return (
          <React.Fragment key={`${arrow.from}${arrow.to}`}>
            <Line
              x1={from.x}
              y1={from.y}
              x2={bx}
              y2={by}
              stroke={color}
              strokeWidth={ARROW_LINE_WIDTH}
              strokeLinecap="round"
              opacity={ARROW_OPACITY}
            />
            <Polygon points={head} fill={color} opacity={ARROW_OPACITY} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

interface Drag {
  from: Square;
  piece: PlacedPiece;
  x: number;
  y: number;
}

interface PendingDrag {
  from: Square;
  /** Finger position at touch start, in board coordinates. */
  startX: number;
  startY: number;
}

interface CellProps {
  square: Square;
  left: number;
  top: number;
  cell: number;
  light: boolean;
  piece: PlacedPiece | undefined;
  label: string;
  selected: boolean;
  target: boolean;
  last: boolean;
  checked: boolean;
  hint: boolean;
  dimmed: boolean;
  fileLabel: string | null;
  rankLabel: string | null;
  disabled: boolean;
  colors: Colors;
  scheme: Scheme;
  onPress: (square: Square) => void;
  onTouchStart: (square: Square, x: number, y: number) => void;
}

const fill = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

const Cell = memo(function Cell({
  square,
  left,
  top,
  cell,
  light,
  piece,
  label,
  selected,
  target,
  last,
  checked,
  hint,
  dimmed,
  fileLabel,
  rankLabel,
  disabled,
  colors,
  scheme,
  onPress,
  onTouchStart,
}: CellProps) {
  const coords = coordColors(scheme);
  const coordColor = light ? coords.onLight : coords.onDark;
  const coordSize = Math.max(MIN_COORD_FONT, Math.round(cell * COORD_FONT_RATIO));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(square)}
      onPressIn={(event) =>
        onTouchStart(square, left + event.nativeEvent.locationX, top + event.nativeEvent.locationY)
      }
      style={{
        position: 'absolute',
        left,
        top,
        width: cell,
        height: cell,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: light ? colors.boardB : colors.boardA,
      }}
    >
      {last && <View style={[fill, { backgroundColor: boardHighlight.lastMove }]} />}
      {checked && (
        <Svg style={fill} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="check-glow" cx="50" cy="50" r="70.7" gradientUnits="userSpaceOnUse">
              {CHECK_GLOW_STOPS.map((stop) => (
                <Stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor={boardHighlight.checkGlow}
                  stopOpacity={stop.opacity}
                />
              ))}
            </RadialGradient>
          </Defs>
          <Rect width="100" height="100" fill="url(#check-glow)" />
        </Svg>
      )}
      {target && piece && (
        <Svg style={fill} viewBox="0 0 100 100">
          <Path
            fillRule="evenodd"
            fill={boardHighlight.captureCorners}
            d={`M0 0H100V100H0Z M${50 - CAPTURE_RADIUS} 50a${CAPTURE_RADIUS} ${CAPTURE_RADIUS} 0 1 0 ${CAPTURE_RADIUS * 2} 0a${CAPTURE_RADIUS} ${CAPTURE_RADIUS} 0 1 0 ${-CAPTURE_RADIUS * 2} 0Z`}
          />
        </Svg>
      )}
      {selected && (
        <View
          style={{
            position: 'absolute',
            left: SELECTION_INSET,
            top: SELECTION_INSET,
            right: SELECTION_INSET,
            bottom: SELECTION_INSET,
            borderRadius: cell,
            borderWidth: SELECTION_BORDER,
            borderColor: boardHighlight.selectedRing,
            backgroundColor: boardHighlight.selectedFill,
          }}
        />
      )}
      {piece && (
        <View style={{ opacity: dimmed ? 0.4 : 1 }}>
          <Piece color={piece.color} type={piece.type} size={cell * PIECE_SCALE} />
        </View>
      )}
      {target && !piece && (
        <View
          style={{
            position: 'absolute',
            width: cell * MOVE_DOT_RATIO,
            height: cell * MOVE_DOT_RATIO,
            borderRadius: cell,
            backgroundColor: boardHighlight.moveDot,
          }}
        />
      )}
      {hint && (
        <View
          style={{
            position: 'absolute',
            left: SELECTION_INSET,
            top: SELECTION_INSET,
            right: SELECTION_INSET,
            bottom: SELECTION_INSET,
            borderRadius: 10,
            borderWidth: SELECTION_BORDER,
            borderStyle: 'dashed',
            borderColor: boardHighlight.hintDashed,
          }}
        />
      )}
      {checked && (
        <View
          style={{
            position: 'absolute',
            right: 3,
            top: 3,
            width: CHECK_BADGE,
            height: CHECK_BADGE,
            borderRadius: CHECK_BADGE,
            borderWidth: 2,
            borderColor: colors.surface,
            backgroundColor: colors.coral,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ color: colors.onAccent, fontSize: 12, fontFamily: COORD_FONT, lineHeight: 14 }}
          >
            +
          </Text>
        </View>
      )}
      {fileLabel && (
        <Text
          style={{
            position: 'absolute',
            right: 4,
            bottom: 2,
            color: coordColor,
            fontSize: coordSize,
            fontFamily: COORD_FONT,
            lineHeight: coordSize + 1,
          }}
        >
          {fileLabel}
        </Text>
      )}
      {rankLabel && (
        <Text
          style={{
            position: 'absolute',
            left: 4,
            top: 3,
            color: coordColor,
            fontSize: coordSize,
            fontFamily: COORD_FONT,
            lineHeight: coordSize + 1,
          }}
        >
          {rankLabel}
        </Text>
      )}
    </Pressable>
  );
});

export function Board({
  state,
  dispatch,
  size = sizes.board,
  hintSquares = [],
  coords = true,
  disabled = false,
  arrows = [],
  marked = [],
  pieces: piecesOverride,
  onSquarePress,
  lastMove: lastMoveOverride,
}: BoardProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const [drag, setDrag] = useState<Drag | null>(null);
  const pending = useRef<PendingDrag | null>(null);

  const { fen, orientation, selected, pendingPromotion } = state;
  const lastMove = lastMoveOverride === undefined ? state.lastMove : lastMoveOverride;
  const markedSet = useMemo(() => new Set(marked), [marked]);
  const inner = size - shashka.border * 2;
  const cell = inner / BOARD_SIZE;
  const squares = useMemo(() => displaySquares(orientation), [orientation]);
  const pieces = useMemo(
    () => new Map((piecesOverride ?? getPieces(fen)).map((p) => [p.square, p])),
    [fen, piecesOverride],
  );
  const movable = useMemo(() => new Set(legalMoves(fen).map((m) => m.from)), [fen]);
  const targets = useMemo(() => new Set(selectTargetSquares(state)), [state]);
  const checked = useMemo(() => checkedKingSquare(fen), [fen]);
  const hints = useMemo(() => new Set(hintSquares), [hintSquares]);
  const sideToMove = turn(fen) ?? 'w';

  // The pan responder is created once, so it reads the current values from here
  const latest = useRef({
    pieces,
    movable,
    orientation,
    selected,
    pendingPromotion,
    dispatch,
    disabled,
    onSquarePress,
    inner,
    cell,
  });
  useLayoutEffect(() => {
    latest.current = {
      pieces,
      movable,
      orientation,
      selected,
      pendingPromotion,
      dispatch,
      disabled,
      onSquarePress,
      inner,
      cell,
    };
  });
  const dragRef = useRef<Drag | null>(null);

  const panHandlers = useMemo(() => {
    function finishDrag(drop: boolean) {
      const current = dragRef.current;
      pending.current = null;
      dragRef.current = null;
      setDrag(null);
      if (!current || !drop) return;
      const { orientation: side, inner: boardSize, cell: squareSize } = latest.current;
      const rect = { left: 0, top: 0, width: boardSize, height: boardSize };
      const target = squareAtPoint(
        side,
        rect,
        current.x,
        current.y - DRAG_LIFT_SQUARES * squareSize,
      );
      if (target && target !== current.from) {
        latest.current.dispatch({ type: 'move/attempt', from: current.from, to: target });
      }
    }

    // The callbacks touch the refs only when a gesture event fires, never while rendering
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        pending.current !== null && Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_event, gesture) => {
        const start = pending.current;
        const piece = start && latest.current.pieces.get(start.from);
        if (!start || !piece) return;
        // Selecting shows the target dots while the piece is in the air
        if (latest.current.selected !== start.from) {
          latest.current.dispatch({ type: 'square/select', square: start.from });
        }
        const next = {
          from: start.from,
          piece,
          x: start.startX + gesture.dx,
          y: start.startY + gesture.dy,
        };
        dragRef.current = next;
        setDrag(next);
      },
      onPanResponderMove: (_event, gesture) => {
        const start = pending.current;
        const current = dragRef.current;
        if (!start || !current) return;
        const next = { ...current, x: start.startX + gesture.dx, y: start.startY + gesture.dy };
        dragRef.current = next;
        setDrag(next);
      },
      onPanResponderRelease: () => finishDrag(true),
      onPanResponderTerminate: () => finishDrag(false),
    }).panHandlers;
  }, []);

  const handlePress = useCallback((square: Square) => {
    const press = latest.current.onSquarePress;
    if (press) press(square);
    else latest.current.dispatch({ type: 'square/select', square });
  }, []);

  const handleTouchStart = useCallback((square: Square, x: number, y: number) => {
    const { disabled: off, pendingPromotion: promoting, movable: canMove } = latest.current;
    pending.current =
      !off && !promoting && !latest.current.onSquarePress && canMove.has(square)
        ? { from: square, startX: x, startY: y }
        : null;
  }, []);

  function labelFor(square: Square, piece: PlacedPiece | undefined): string {
    if (!piece) {
      return t(targets.has(square) ? 'board.square.emptyTarget' : 'board.square.empty', { square });
    }
    const key =
      square === selected ? 'pieceSelected' : targets.has(square) ? 'pieceCapture' : 'piece';
    return t(`board.square.${key}`, {
      piece: t(`board.piece.${piece.color}${piece.type}`),
      square,
    });
  }

  const promotionIndex = pendingPromotion ? squares.indexOf(pendingPromotion.to) : 0;
  const promotionRow = Math.floor(promotionIndex / BOARD_SIZE);
  const promotionCol = promotionIndex % BOARD_SIZE;
  // The panel grows towards the middle of the board, with the queen next to the square
  const promotionFromTop = promotionRow < BOARD_SIZE / 2;
  const promotionTopRow = promotionFromTop
    ? promotionRow
    : promotionRow - (PROMOTION_PIECES.length - 1);
  const promotionOrder = promotionFromTop ? PROMOTION_PIECES : [...PROMOTION_PIECES].reverse();

  return (
    <View
      accessibilityLabel={t('board.label')}
      style={{ width: size + shashka.offsetLarge, height: size + shashka.offsetLarge }}
    >
      <View
        style={{
          position: 'absolute',
          left: shashka.offsetLarge,
          top: shashka.offsetLarge,
          width: size,
          height: size,
          borderRadius: radius.board,
          backgroundColor: colors.edge,
        }}
      />
      <View
        {...panHandlers}
        style={{
          width: size,
          height: size,
          borderRadius: radius.board,
          borderWidth: shashka.border,
          borderColor: colors.edge,
          overflow: 'hidden',
        }}
      >
        {squares.map((square, index) => {
          const col = index % BOARD_SIZE;
          const row = Math.floor(index / BOARD_SIZE);
          const piece = pieces.get(square);
          return (
            <Cell
              key={square}
              square={square}
              left={col * cell}
              top={row * cell}
              cell={cell}
              light={isLightSquare(square)}
              piece={piece}
              label={labelFor(square, piece)}
              selected={selected === square || markedSet.has(square)}
              target={targets.has(square)}
              last={lastMove?.from === square || lastMove?.to === square}
              checked={checked === square}
              hint={hints.has(square)}
              dimmed={drag?.from === square}
              fileLabel={coords && row === BOARD_SIZE - 1 ? square.charAt(0) : null}
              rankLabel={coords && col === 0 ? square.charAt(1) : null}
              disabled={disabled}
              colors={colors}
              scheme={scheme}
              onPress={handlePress}
              onTouchStart={handleTouchStart}
            />
          );
        })}

        <Arrows arrows={arrows} orientation={orientation} colors={colors} />

        {drag && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: drag.x - (cell * DRAG_PIECE_SCALE) / 2,
              top: drag.y - DRAG_LIFT_SQUARES * cell - (cell * DRAG_PIECE_SCALE) / 2,
            }}
          >
            <Piece
              color={drag.piece.color}
              type={drag.piece.type}
              size={cell * PIECE_SCALE * DRAG_PIECE_SCALE}
            />
          </View>
        )}

        {pendingPromotion && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('board.promotion.label')}
              onPress={() => dispatch({ type: 'promotion/cancel' })}
              style={[fill, { backgroundColor: colors.scrim }]}
            />
            <View
              accessibilityLabel={t('board.promotion.label')}
              style={{
                position: 'absolute',
                left: promotionCol * cell,
                top: promotionTopRow * cell,
                width: cell,
                borderWidth: PROMOTION_BORDER,
                borderBottomWidth: PROMOTION_BORDER + PROMOTION_EDGE_DEPTH,
                borderColor: colors.brand,
                borderBottomColor: colors.brandDepth,
                backgroundColor: colors.surface,
              }}
            >
              {promotionOrder.map((piece) => (
                <Pressable
                  key={piece}
                  accessibilityRole="button"
                  accessibilityLabel={t(`board.promotion.${piece}`)}
                  onPress={() => dispatch({ type: 'promotion/choose', piece })}
                  style={{
                    width: cell - PROMOTION_BORDER * 2,
                    height: cell - PROMOTION_BORDER * 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: piece === 'q' ? colors.brandTint : colors.surface,
                  }}
                >
                  <Piece
                    color={sideToMove}
                    type={piece}
                    size={cell * PIECE_SCALE - PROMOTION_BORDER}
                  />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
