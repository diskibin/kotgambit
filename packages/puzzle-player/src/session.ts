import type { PuzzleHintResponse, PuzzleSummary } from '@kotgambit/contracts';

/**
 * Where the learner is in a puzzle. A plain reducer, so that web and mobile keep it in their Redux
 * stores and the rules of a puzzle screen are written (and tested) once. The position itself lives
 * in the board state, and the line of the solution never leaves the server.
 */
export interface PuzzleSession {
  attemptId: string | null;
  /**
   * `solving`: looking for the move. `wrong`: a move was refused, waiting for a retry. `correct`: solved.
   * `solution`: the learner gave up and the line is shown.
   */
  phase: 'idle' | 'solving' | 'wrong' | 'correct' | 'solution';
  mistakes: number;
  /** The highest hint level asked for, 0 to 3. */
  hintLevel: 0 | 1 | 2 | 3;
  /** The last hint the server gave, shown in the card while `hintOpen`. */
  hint: PuzzleHintResponse | null;
  /** The square of the first-level hint, kept so that the next levels still point at it. */
  hintSquare: string | null;
  /** "Понятно" closes the card, the marks stay on the board. */
  hintOpen: boolean;
  /** Set once the rating was settled, which happens at the first mistake, the last hint, or the solve. */
  summary: PuzzleSummary | null;
  /** The rest of the line, for the board to show after giving up. */
  solution: string[];
}

export const initialPuzzleSession: PuzzleSession = {
  attemptId: null,
  phase: 'idle',
  mistakes: 0,
  hintLevel: 0,
  hint: null,
  hintSquare: null,
  hintOpen: false,
  summary: null,
  solution: [],
};

export type PuzzleSessionAction =
  | { type: 'puzzle/started'; attemptId: string }
  | { type: 'puzzle/moveWrong'; mistakes: number; summary: PuzzleSummary | null }
  | { type: 'puzzle/retried' }
  | { type: 'puzzle/moveCorrect'; solved: boolean; summary: PuzzleSummary | null }
  | { type: 'puzzle/hinted'; hint: PuzzleHintResponse }
  | { type: 'puzzle/hintClosed' }
  | { type: 'puzzle/gaveUp'; solution: string[]; summary: PuzzleSummary | null }
  | { type: 'puzzle/exited' };

/**
 * Takes any Redux action, so that it can sit in a store next to other reducers. The summary arrives once
 * and is kept: a later answer without one must not wipe it.
 */
export function puzzleSessionReducer(
  state: PuzzleSession = initialPuzzleSession,
  incoming: { type: string },
): PuzzleSession {
  const action = incoming as PuzzleSessionAction;
  switch (action.type) {
    case 'puzzle/started':
      return { ...initialPuzzleSession, attemptId: action.attemptId, phase: 'solving' };

    case 'puzzle/moveWrong':
      if (state.attemptId === null || state.phase === 'correct' || state.phase === 'solution') {
        return state;
      }
      return {
        ...state,
        phase: 'wrong',
        mistakes: action.mistakes,
        summary: action.summary ?? state.summary,
      };

    case 'puzzle/retried':
      return state.phase === 'wrong' ? { ...state, phase: 'solving' } : state;

    case 'puzzle/moveCorrect':
      if (state.attemptId === null || state.phase === 'correct' || state.phase === 'solution') {
        return state;
      }
      return {
        ...state,
        phase: action.solved ? 'correct' : 'solving',
        summary: action.summary ?? state.summary,
        // A hint belongs to the move it was asked for, the chain starts again at the next one
        ...(action.solved ? {} : { hint: null, hintLevel: 0 as const, hintSquare: null }),
        hintOpen: false,
      };

    case 'puzzle/hinted': {
      if (state.attemptId === null || state.phase === 'correct' || state.phase === 'solution') {
        return state;
      }
      const { hint } = action;
      return {
        ...state,
        // A hint asked for after a mistake puts the learner back to looking for the move
        phase: state.phase === 'wrong' ? 'solving' : state.phase,
        hintLevel: hint.level,
        hint,
        hintSquare: hint.level === 1 ? hint.square : state.hintSquare,
        hintOpen: true,
        summary: (hint.level === 3 ? hint.summary : null) ?? state.summary,
      };
    }

    case 'puzzle/hintClosed':
      return { ...state, hintOpen: false };

    case 'puzzle/gaveUp':
      if (state.attemptId === null || state.phase === 'correct') return state;
      return {
        ...state,
        phase: 'solution',
        solution: action.solution,
        summary: action.summary ?? state.summary,
        hintOpen: false,
      };

    case 'puzzle/exited':
      return initialPuzzleSession;

    default:
      return state;
  }
}

/** How much the rating changed, 0 for an unrated repeat. */
export function ratingChange(summary: PuzzleSummary | null): number {
  return summary ? summary.ratingAfter - summary.ratingBefore : 0;
}
