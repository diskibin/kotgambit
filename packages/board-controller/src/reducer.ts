import {
  STARTING_FEN,
  applyMove,
  isValidFen,
  legalMoves,
  type Color,
  type Move,
  type PromotionPiece,
  type Square,
} from '@kotgambit/chess-core';

export interface SquarePair {
  from: Square;
  to: Square;
}

export interface BoardState {
  fen: string;
  orientation: Color;
  selected: Square | null;
  lastMove: Move | null;
  pendingPromotion: SquarePair | null;
  /** The last attempt that lesson mode refused, so the UI can react with a gentle hint. */
  rejected: SquarePair | null;
  /** UCI moves the player may make, or null when every legal move is allowed. */
  allowedMoves: readonly string[] | null;
}

export type BoardAction =
  | { type: 'square/select'; square: Square }
  | { type: 'move/attempt'; from: Square; to: Square }
  | { type: 'promotion/choose'; piece: PromotionPiece }
  | { type: 'promotion/cancel' }
  | { type: 'orientation/flip' }
  | { type: 'position/set'; fen: string; allowedMoves?: readonly string[] | null }
  | { type: 'selection/clear' };

export interface BoardOptions {
  fen?: string;
  orientation?: Color;
  allowedMoves?: readonly string[] | null;
}

export function createBoardState({
  fen = STARTING_FEN,
  orientation = 'w',
  allowedMoves = null,
}: BoardOptions = {}): BoardState {
  return {
    fen,
    orientation,
    selected: null,
    lastMove: null,
    pendingPromotion: null,
    rejected: null,
    allowedMoves,
  };
}

function movesBetween(state: BoardState, from: Square, to: Square): Move[] {
  return legalMoves(state.fen).filter((m) => m.from === from && m.to === to);
}

function hasMovesFrom(state: BoardState, square: Square): boolean {
  return legalMoves(state.fen).some((m) => m.from === square);
}

function isAllowed(state: BoardState, candidates: Move[]): boolean {
  const allowed = state.allowedMoves;
  return allowed === null || candidates.some((m) => allowed.includes(m.uci));
}

function play(state: BoardState, uci: string): BoardState {
  const result = applyMove(state.fen, uci);
  if (!result.ok) return state;
  return {
    ...state,
    fen: result.fen,
    lastMove: result.move,
    selected: null,
    pendingPromotion: null,
    rejected: null,
  };
}

function attemptMove(state: BoardState, from: Square, to: Square): BoardState {
  const candidates = movesBetween(state, from, to);
  if (candidates.length === 0) return { ...state, selected: null, rejected: null };
  if (!isAllowed(state, candidates)) {
    return { ...state, selected: null, rejected: { from, to } };
  }
  const [first] = candidates;
  if (first?.promotion) {
    return { ...state, selected: from, pendingPromotion: { from, to }, rejected: null };
  }
  return play(state, `${from}${to}`);
}

function selectSquare(state: BoardState, square: Square): BoardState {
  if (state.selected === square) return { ...state, selected: null, rejected: null };
  if (state.selected && movesBetween(state, state.selected, square).length > 0) {
    return attemptMove(state, state.selected, square);
  }
  return {
    ...state,
    selected: hasMovesFrom(state, square) ? square : null,
    rejected: null,
  };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  // A pending promotion must be resolved or cancelled before anything else happens
  if (state.pendingPromotion) {
    switch (action.type) {
      case 'promotion/choose': {
        const { from, to } = state.pendingPromotion;
        const uci = `${from}${to}${action.piece}`;
        const candidates = movesBetween(state, from, to).filter((m) => m.uci === uci);
        if (!isAllowed(state, candidates)) {
          return { ...state, selected: null, pendingPromotion: null, rejected: { from, to } };
        }
        return play(state, uci);
      }
      case 'promotion/cancel':
        return { ...state, selected: null, pendingPromotion: null };
      case 'position/set':
        break;
      default:
        return state;
    }
  }

  switch (action.type) {
    case 'square/select':
      return selectSquare(state, action.square);
    case 'move/attempt':
      return attemptMove(state, action.from, action.to);
    case 'selection/clear':
      return { ...state, selected: null, rejected: null };
    case 'orientation/flip':
      return { ...state, orientation: state.orientation === 'w' ? 'b' : 'w' };
    case 'position/set':
      if (!isValidFen(action.fen)) return state;
      return {
        ...state,
        fen: action.fen,
        selected: null,
        lastMove: null,
        pendingPromotion: null,
        rejected: null,
        allowedMoves: action.allowedMoves ?? null,
      };
    case 'promotion/choose':
    case 'promotion/cancel':
      return state;
  }
}
