import {
  STARTING_FEN,
  parsePlacement,
  type Color,
  type PieceType,
  type Square,
} from '@kotgambit/chess-core';

export interface EditorPiece {
  color: Color;
  type: PieceType;
}

/** What a press on a square does: puts the chosen piece, or wipes the square with the eraser. */
export type EditorTool = { kind: 'piece'; piece: EditorPiece } | { kind: 'eraser' };

export type CastlingRight = 'wK' | 'wQ' | 'bK' | 'bQ';

export interface EditorState {
  pieces: Record<Square, EditorPiece>;
  turn: Color;
  /** What the learner ticked. The FEN only carries the rights that the pieces allow. */
  castling: Record<CastlingRight, boolean>;
  tool: EditorTool | null;
  orientation: Color;
}

export type EditorAction =
  | { type: 'tool/chosen'; tool: EditorTool | null }
  | { type: 'square/pressed'; square: Square }
  | { type: 'piece/moved'; from: Square; to: Square }
  | { type: 'board/cleared' }
  | { type: 'board/reset' }
  | { type: 'orientation/flipped' }
  | { type: 'turn/set'; turn: Color }
  | { type: 'castling/toggled'; right: CastlingRight }
  | { type: 'fen/loaded'; fen: string };

// The king and the rook must stand on these squares for a castling right to mean anything
const CASTLING_SQUARES: Record<CastlingRight, { king: Square; rook: Square; color: Color }> = {
  wK: { king: 'e1', rook: 'h1', color: 'w' },
  wQ: { king: 'e1', rook: 'a1', color: 'w' },
  bK: { king: 'e8', rook: 'h8', color: 'b' },
  bQ: { king: 'e8', rook: 'a8', color: 'b' },
};
const RIGHTS: readonly CastlingRight[] = ['wK', 'wQ', 'bK', 'bQ'];
const FEN_LETTERS: Record<CastlingRight, string> = { wK: 'K', wQ: 'Q', bK: 'k', bQ: 'q' };
const FILES = 'abcdefgh';
const BOARD_SIZE = 8;

const NO_CASTLING: EditorState['castling'] = { wK: false, wQ: false, bK: false, bQ: false };

function stateFromPieces(
  pieces: EditorState['pieces'],
  turn: Color,
  castling: EditorState['castling'],
  orientation: Color,
): EditorState {
  return { pieces, turn, castling, tool: null, orientation };
}

/** The rights of a FEN's castling field, `-` or missing for none. */
function castlingFromField(field: string | undefined): EditorState['castling'] {
  const rights = { ...NO_CASTLING };
  for (const right of RIGHTS) rights[right] = (field ?? '').includes(FEN_LETTERS[right]);
  return rights;
}

/** Reads a FEN into the editor, also one that is not a legal position. `null` if it cannot be read. */
export function fromFen(fen: string, orientation: Color = 'w'): EditorState | null {
  const fields = fen.trim().split(/\s+/);
  const placed = fields[0] ? parsePlacement(fields[0]) : null;
  if (!placed) return null;
  const turn = fields[1] ?? 'w';
  if (turn !== 'w' && turn !== 'b') return null;
  const pieces: EditorState['pieces'] = {};
  for (const { square, color, type } of placed) pieces[square] = { color, type };
  return stateFromPieces(pieces, turn, castlingFromField(fields[2]), orientation);
}

export function initialEditorState(): EditorState {
  return fromFen(STARTING_FEN) as EditorState;
}

export function emptyEditorState(orientation: Color = 'w'): EditorState {
  return stateFromPieces({}, 'w', { ...NO_CASTLING }, orientation);
}

/** Whether the pieces stand so that the castling could still be played. */
export function canCastle(state: EditorState, right: CastlingRight): boolean {
  const { king, rook, color } = CASTLING_SQUARES[right];
  const at = (square: Square) => state.pieces[square];
  return (
    at(king)?.type === 'k' &&
    at(king)?.color === color &&
    at(rook)?.type === 'r' &&
    at(rook)?.color === color
  );
}

/** The position as a FEN, without move counters worth anything: they are `0 1`. */
export function toFen(state: EditorState): string {
  const rows: string[] = [];
  for (let rank = BOARD_SIZE; rank >= 1; rank -= 1) {
    let row = '';
    let empty = 0;
    for (const file of FILES) {
      const piece = state.pieces[`${file}${rank}`];
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) row += String(empty);
      empty = 0;
      row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
    }
    rows.push(empty > 0 ? `${row}${empty}` : row);
  }
  const castling = RIGHTS.filter((right) => state.castling[right] && canCastle(state, right))
    .map((right) => FEN_LETTERS[right])
    .join('');
  return `${rows.join('/')} ${state.turn} ${castling || '-'} - 0 1`;
}

const samePiece = (a: EditorPiece | undefined, b: EditorPiece) =>
  a !== undefined && a.color === b.color && a.type === b.type;

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'tool/chosen':
      return { ...state, tool: action.tool };

    case 'square/pressed': {
      const { tool } = state;
      if (tool === null) return state;
      const pieces = { ...state.pieces };
      if (tool.kind === 'eraser' || samePiece(pieces[action.square], tool.piece)) {
        // Pressing a piece of the same kind again takes it off, which is how a mistake is undone
        delete pieces[action.square];
      } else {
        pieces[action.square] = tool.piece;
      }
      return { ...state, pieces };
    }

    case 'piece/moved': {
      const piece = state.pieces[action.from];
      if (!piece || action.from === action.to) return state;
      // Any square is allowed and a piece there is replaced: the editor sets up positions, it does not play chess
      const pieces = { ...state.pieces };
      delete pieces[action.from];
      pieces[action.to] = piece;
      return { ...state, pieces };
    }

    case 'board/cleared':
      return { ...state, pieces: {}, castling: { ...NO_CASTLING } };

    case 'board/reset':
      return { ...initialEditorState(), orientation: state.orientation, tool: state.tool };

    case 'orientation/flipped':
      return { ...state, orientation: state.orientation === 'w' ? 'b' : 'w' };

    case 'turn/set':
      return { ...state, turn: action.turn };

    case 'castling/toggled':
      return {
        ...state,
        castling: { ...state.castling, [action.right]: !state.castling[action.right] },
      };

    case 'fen/loaded': {
      const loaded = fromFen(action.fen, state.orientation);
      return loaded ? { ...loaded, tool: state.tool } : state;
    }
  }
}
