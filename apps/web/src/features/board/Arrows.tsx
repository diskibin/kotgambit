import type { Color, Square } from '@kotgambit/chess-core';
import { displaySquares } from '@kotgambit/board-controller';

export interface BoardArrow {
  from: Square;
  to: Square;
  color: 'sky' | 'sun' | 'mint' | 'brand';
}

const COLORS: Record<BoardArrow['color'], string> = {
  sky: 'var(--color-sky)',
  sun: 'var(--color-sun-depth)',
  mint: 'var(--color-mint-depth)',
  brand: 'var(--color-brand)',
};

const BOARD_SIZE = 8;
const LINE_WIDTH = 0.2;
const HEAD_LENGTH = 0.5;
const HEAD_HALF_WIDTH = 0.3;
const OPACITY = 0.9;

function centre(square: Square, orientation: Color): { x: number; y: number } {
  const index = displaySquares(orientation).indexOf(square);
  return { x: (index % BOARD_SIZE) + 0.5, y: Math.floor(index / BOARD_SIZE) + 0.5 };
}

/** Arrows drawn over the board in board units, so they scale with it. At most two at a time by design. */
export function Arrows({
  arrows,
  orientation,
}: {
  arrows: readonly BoardArrow[];
  orientation: Color;
}) {
  if (arrows.length === 0) return null;
  return (
    <svg
      viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
    >
      {arrows.map((arrow) => {
        const from = centre(arrow.from, orientation);
        const to = centre(arrow.to, orientation);
        const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        const ux = (to.x - from.x) / length;
        const uy = (to.y - from.y) / length;
        // The line stops where the head starts
        const bx = to.x - ux * HEAD_LENGTH;
        const by = to.y - uy * HEAD_LENGTH;
        const head = [
          `${to.x},${to.y}`,
          `${bx - uy * HEAD_HALF_WIDTH},${by + ux * HEAD_HALF_WIDTH}`,
          `${bx + uy * HEAD_HALF_WIDTH},${by - ux * HEAD_HALF_WIDTH}`,
        ].join(' ');
        const color = COLORS[arrow.color];
        return (
          <g
            key={`${arrow.from}${arrow.to}`}
            opacity={OPACITY}
            data-arrow={`${arrow.from}${arrow.to}`}
          >
            <line
              x1={from.x}
              y1={from.y}
              x2={bx}
              y2={by}
              stroke={color}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
            />
            <polygon points={head} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
