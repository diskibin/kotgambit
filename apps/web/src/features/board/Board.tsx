import {
  BOARD_SIZE,
  displaySquares,
  isLightSquare,
  neighbour,
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
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Arrows, type BoardArrow } from './Arrows';
import './board.css';
import { pieceUrl } from './pieceAssets';

// Dragging starts only after the pointer travels this far, so that a plain tap stays a tap
const DRAG_THRESHOLD_PX = 4;
const DRAG_PIECE_SCALE = 1.18;
const PIECE_SCALE = 0.9;
// A finger hides the piece, so on touch screens it is lifted above the fingertip
const TOUCH_LIFT_SQUARES = 0.9;
const SQUARE_PERCENT = 100 / BOARD_SIZE;
const PROMOTION_PIECES: PromotionPiece[] = ['q', 'r', 'b', 'n'];

const ARROW_STEPS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

interface BoardProps {
  state: BoardState;
  dispatch: (action: BoardAction) => void;
  hintSquares?: readonly Square[];
  coords?: boolean;
  disabled?: boolean;
  arrows?: readonly BoardArrow[];
  /** Squares marked by the learner, drawn like a selection. */
  marked?: readonly Square[];
  /**
   * When given, squares only report presses to it: no piece is selected, moved or dragged.
   * Used where the learner marks squares instead of moving.
   */
  onSquarePress?: (square: Square) => void;
  /** Overrides the last move of the state, for the positions of a demo. */
  lastMove?: { from: Square; to: Square } | null;
}

interface Drag {
  from: Square;
  piece: PlacedPiece;
  x: number;
  y: number;
  squarePx: number;
  touch: boolean;
}

interface PendingDrag {
  from: Square;
  startX: number;
  startY: number;
  pointerId: number;
}

function squareOf(target: EventTarget): Square | undefined {
  return (target as HTMLElement).closest<HTMLElement>('[data-square]')?.dataset['square'];
}

export function Board({
  state,
  dispatch,
  hintSquares = [],
  coords = true,
  disabled = false,
  arrows = [],
  marked = [],
  onSquarePress,
  lastMove: lastMoveOverride,
}: BoardProps) {
  const { t } = useTranslation();
  const boardRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<Square, HTMLButtonElement>());
  const pending = useRef<PendingDrag | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [focused, setFocused] = useState<Square | null>(null);

  const { fen, orientation, selected, pendingPromotion } = state;
  const lastMove = lastMoveOverride === undefined ? state.lastMove : lastMoveOverride;
  const markedSet = useMemo(() => new Set(marked), [marked]);
  const squares = useMemo(() => displaySquares(orientation), [orientation]);
  const pieces = useMemo(() => new Map(getPieces(fen).map((p) => [p.square, p])), [fen]);
  const movable = useMemo(() => new Set(legalMoves(fen).map((m) => m.from)), [fen]);
  const targets = useMemo(() => new Set(selectTargetSquares(state)), [state]);
  const checked = useMemo(() => checkedKingSquare(fen), [fen]);
  const hints = useMemo(() => new Set(hintSquares), [hintSquares]);
  const sideToMove = turn(fen) ?? 'w';
  const tabStop = focused ?? selected ?? squares[0];

  function labelFor(square: Square, piece: PlacedPiece | undefined): string {
    if (!piece) {
      return t(targets.has(square) ? 'board.square.emptyTarget' : 'board.square.empty', {
        square,
      });
    }
    const key =
      square === selected ? 'pieceSelected' : targets.has(square) ? 'pieceCapture' : 'piece';
    return t(`board.square.${key}`, {
      piece: t(`board.piece.${piece.color}${piece.type}`),
      square,
    });
  }

  function focusSquare(square: Square | null) {
    if (!square) return;
    setFocused(square);
    buttons.current.get(square)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      dispatch(pendingPromotion ? { type: 'promotion/cancel' } : { type: 'selection/clear' });
      return;
    }
    const current = squareOf(event.target);
    const step = ARROW_STEPS[event.key];
    if (!current || !step || pendingPromotion) return;
    event.preventDefault();
    focusSquare(neighbour(orientation, current, step[0], step[1]));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || onSquarePress || pendingPromotion || event.button !== 0) return;
    const square = squareOf(event.target);
    if (!square || !movable.has(square)) return;
    pending.current = {
      from: square,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const start = pending.current;
    if (drag) {
      setDrag({ ...drag, x: event.clientX - rect.left, y: event.clientY - rect.top });
      return;
    }
    if (!start) return;
    const distance = Math.hypot(event.clientX - start.startX, event.clientY - start.startY);
    const piece = pieces.get(start.from);
    if (distance < DRAG_THRESHOLD_PX || !piece) return;
    boardRef.current?.setPointerCapture?.(start.pointerId);
    // Selecting here shows the target dots while the piece is in the air
    if (selected !== start.from) dispatch({ type: 'square/select', square: start.from });
    setDrag({
      from: start.from,
      piece,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      squarePx: rect.width / BOARD_SIZE,
      touch: event.pointerType === 'touch',
    });
  }

  function endDrag(event: PointerEvent<HTMLDivElement>, drop: boolean) {
    pending.current = null;
    if (!drag) return;
    const rect = boardRef.current?.getBoundingClientRect();
    const lift = drag.touch ? TOUCH_LIFT_SQUARES * drag.squarePx : 0;
    const target =
      rect && drop ? squareAtPoint(orientation, rect, event.clientX, event.clientY - lift) : null;
    if (target && target !== drag.from) {
      dispatch({ type: 'move/attempt', from: drag.from, to: target });
    }
    setDrag(null);
    // The click that follows pointerup must not toggle the selection made by the drag
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  function handleClickCapture(event: { stopPropagation: () => void }) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.stopPropagation();
  }

  const promotionIndex = pendingPromotion ? squares.indexOf(pendingPromotion.to) : 0;
  const promotionRow = Math.floor(promotionIndex / BOARD_SIZE);
  const promotionCol = promotionIndex % BOARD_SIZE;
  // The panel grows towards the middle of the board, with the queen next to the square
  const promotionFromTop = promotionRow < BOARD_SIZE / 2;
  const promotionTopRow = promotionFromTop
    ? promotionRow
    : promotionRow - (PROMOTION_PIECES.length - 1);

  return (
    <div
      ref={boardRef}
      role="group"
      aria-label={t('board.label')}
      className="board-container relative aspect-square w-full max-w-board touch-none select-none rounded-card border-2 border-edge shadow-shashka-lg"
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => endDrag(e, true)}
      onPointerCancel={(e) => endDrag(e, false)}
      onClickCapture={handleClickCapture}
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[inherit]">
        {squares.map((square, index) => {
          const piece = pieces.get(square);
          const light = isLightSquare(square);
          const isTarget = targets.has(square);
          const coordColor = light ? 'var(--board-coord-on-light)' : 'var(--board-coord-on-dark)';
          return (
            <button
              key={square}
              ref={(el) => {
                if (el) buttons.current.set(square, el);
                else buttons.current.delete(square);
              }}
              type="button"
              data-square={square}
              tabIndex={square === tabStop ? 0 : -1}
              aria-label={labelFor(square, piece)}
              aria-pressed={onSquarePress ? markedSet.has(square) : undefined}
              disabled={disabled}
              onFocus={() => setFocused(square)}
              onClick={() =>
                onSquarePress ? onSquarePress(square) : dispatch({ type: 'square/select', square })
              }
              className={`relative flex items-center justify-center p-0 ${light ? 'bg-board-b' : 'bg-board-a'}`}
            >
              {lastMove && (lastMove.from === square || lastMove.to === square) && (
                <span className="board-last absolute inset-0" aria-hidden="true" />
              )}
              {checked === square && (
                <span className="board-check absolute inset-0" aria-hidden="true" />
              )}
              {isTarget && piece && (
                <span className="board-capture absolute inset-0" aria-hidden="true" />
              )}
              {(selected === square || markedSet.has(square)) && (
                <span className="board-selected absolute" aria-hidden="true" />
              )}
              {piece && (
                <img
                  src={pieceUrl(piece.color, piece.type)}
                  alt=""
                  draggable={false}
                  style={{ width: `${PIECE_SCALE * 100}%` }}
                  className={`relative ${drag?.from === square ? 'opacity-40' : ''}`}
                />
              )}
              {isTarget && !piece && <span className="board-dot absolute" aria-hidden="true" />}
              {hints.has(square) && <span className="board-hint absolute" aria-hidden="true" />}
              {checked === square && (
                <span
                  className="absolute right-[3px] top-[3px] h-[18px] w-[18px] rounded-full border-2 border-surface bg-coral text-center text-[12px] font-extrabold leading-[14px] text-on-accent"
                  aria-hidden="true"
                >
                  +
                </span>
              )}
              {coords && index >= BOARD_SIZE * (BOARD_SIZE - 1) && (
                <span
                  className="board-coord absolute bottom-[2px] right-1 font-extrabold leading-none"
                  style={{ color: coordColor }}
                  aria-hidden="true"
                >
                  {square.charAt(0)}
                </span>
              )}
              {coords && index % BOARD_SIZE === 0 && (
                <span
                  className="board-coord absolute left-1 top-[3px] font-extrabold leading-none"
                  style={{ color: coordColor }}
                  aria-hidden="true"
                >
                  {square.charAt(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Arrows arrows={arrows} orientation={orientation} />

      {drag && (
        <img
          src={pieceUrl(drag.piece.color, drag.piece.type)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute"
          style={{
            width: drag.squarePx * PIECE_SCALE * DRAG_PIECE_SCALE,
            left: drag.x,
            top: drag.y - (drag.touch ? TOUCH_LIFT_SQUARES * drag.squarePx : 0),
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}

      {pendingPromotion && (
        <>
          <div
            className="absolute inset-0 rounded-[inherit] bg-scrim"
            onClick={() => dispatch({ type: 'promotion/cancel' })}
          />
          <div
            role="group"
            aria-label={t('board.promotion.label')}
            className={`absolute flex w-[12.5%] border-3 border-brand bg-surface shadow-[0_4px_0_var(--color-brand-depth)] ${promotionFromTop ? 'flex-col' : 'flex-col-reverse'}`}
            style={{
              left: `${promotionCol * SQUARE_PERCENT}%`,
              top: `${promotionTopRow * SQUARE_PERCENT}%`,
            }}
          >
            {PROMOTION_PIECES.map((piece) => (
              <button
                key={piece}
                type="button"
                aria-label={t(`board.promotion.${piece}`)}
                // The queen is the default choice, so it gets the focus
                ref={(el) => {
                  if (el && piece === 'q') el.focus();
                }}
                onClick={() => dispatch({ type: 'promotion/choose', piece })}
                className={`flex aspect-square items-center justify-center p-0 ${piece === 'q' ? 'bg-brand-tint' : 'bg-surface'}`}
              >
                <img
                  src={pieceUrl(sideToMove, piece)}
                  alt=""
                  draggable={false}
                  className="w-[90%]"
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
