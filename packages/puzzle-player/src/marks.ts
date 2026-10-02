import type { PuzzleSession } from './session.js';

export type MarkColor = 'sky' | 'sun' | 'mint' | 'brand';

export interface PuzzleArrow {
  from: string;
  to: string;
  color: MarkColor;
}

export interface PuzzleMarks {
  /** Squares framed on the board, like a hint. */
  squares: string[];
  arrows: PuzzleArrow[];
}

// The design allows at most two arrows on the board at once
const MAX_ARROWS = 2;
const FROM_END = 2;

const move = (uci: string, color: MarkColor): PuzzleArrow => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, FROM_END + 2),
  color,
});

/**
 * What the board shows because of the hints and the solution. Level one frames the piece, level two keeps
 * the frame (the card then tells the idea), level three adds the arrow of the move. After giving up the
 * line is drawn: the learner's moves in `sun`, the replies of the opponent in `sky`.
 */
export function puzzleMarks(session: PuzzleSession): PuzzleMarks {
  if (session.phase === 'solution') {
    return {
      squares: [],
      arrows: session.solution
        .slice(0, MAX_ARROWS)
        .map((uci, index) => move(uci, index % 2 === 0 ? 'sun' : 'sky')),
    };
  }
  const squares = session.hintSquare ? [session.hintSquare] : [];
  if (session.hint?.level === 3) {
    const arrow = move(session.hint.move, 'sun');
    return { squares: [arrow.from, arrow.to], arrows: [arrow] };
  }
  return { squares, arrows: [] };
}
