import { applyMove } from '@kotgambit/chess-core';
import type { Game, GameMoveResponse } from '@kotgambit/contracts';

/**
 * Where the learner is in a game against a bot. A plain reducer, so that web and mobile keep it in
 * their Redux stores and the rules of the game screen are written (and tested) once.
 *
 * The game itself comes from the server. It is kept here because the answer to a move is the only
 * copy of the position until the next read, and the board needs it at once.
 */
export interface GameSession {
  game: Game | null;
  /**
   * `playing`: the learner's turn. `waiting`: the learner moved and the bot is answering.
   * `busy`: the bot's answer did not come, the client asks again. `over`: the game has ended.
   */
  phase: 'idle' | 'playing' | 'waiting' | 'busy' | 'over';
  /** The learner's move that is on its way to the server, shown on the board at once. */
  pendingMove: string | null;
  /** The move a hint points at. */
  hint: string | null;
  resignOpen: boolean;
}

export const initialGameSession: GameSession = {
  game: null,
  phase: 'idle',
  pendingMove: null,
  hint: null,
  resignOpen: false,
};

export type GameSessionAction =
  | { type: 'game/loaded'; game: Game }
  | { type: 'game/moveSent'; move: string }
  | { type: 'game/moveAnswered'; response: GameMoveResponse }
  | { type: 'game/moveFailed' }
  | { type: 'game/botBusy' }
  | { type: 'game/hinted'; move: string; hintsLeft: number }
  | { type: 'game/hintCleared' }
  | { type: 'game/resignAsked' }
  | { type: 'game/resignCancelled' }
  | { type: 'game/exited' };

function phaseOf(game: Game): GameSession['phase'] {
  if (game.status === 'finished') return 'over';
  return game.turn === game.userColor ? 'playing' : 'waiting';
}

/**
 * A game that is on the bot's turn after the server answered (or when it is opened) means the bot's
 * answer is missing: the engine was busy, and the client asks for it again.
 */
function settle(game: Game): GameSession {
  const phase = phaseOf(game);
  return {
    game,
    phase: phase === 'waiting' ? 'busy' : phase,
    pendingMove: null,
    hint: null,
    resignOpen: false,
  };
}

/**
 * Takes any Redux action, so that it can sit in a store next to other reducers. Anything the
 * server sends replaces the game and clears what was only true for the old position, such as a hint.
 */
export function gameSessionReducer(
  state: GameSession = initialGameSession,
  incoming: { type: string },
): GameSession {
  const action = incoming as GameSessionAction;
  switch (action.type) {
    case 'game/loaded':
      return settle(action.game);

    case 'game/moveSent':
      if (state.game === null || state.phase !== 'playing') return state;
      return { ...state, phase: 'waiting', pendingMove: action.move, hint: null };

    case 'game/moveAnswered':
      // A refused move is not part of the game, the board goes back to the position it had
      if (action.response.result === 'illegal') {
        return state.game === null
          ? state
          : { ...state, phase: phaseOf(state.game), pendingMove: null };
      }
      return settle(action.response.game);

    case 'game/moveFailed':
      return state.game === null
        ? state
        : { ...state, phase: phaseOf(state.game), pendingMove: null };

    case 'game/botBusy':
      return state.game === null || state.game.status === 'finished'
        ? state
        : { ...state, phase: 'busy' };

    case 'game/hinted':
      if (state.game === null || state.phase !== 'playing') return state;
      return {
        ...state,
        hint: action.move,
        game: { ...state.game, hintsLeft: action.hintsLeft },
      };

    case 'game/hintCleared':
      return { ...state, hint: null };

    case 'game/resignAsked':
      return state.phase === 'over' || state.game === null ? state : { ...state, resignOpen: true };

    case 'game/resignCancelled':
      return { ...state, resignOpen: false };

    case 'game/exited':
      return initialGameSession;

    default:
      return state;
  }
}

/** The position to draw: the game's, with the learner's move on its way already played. */
export function boardFen(session: GameSession): string | null {
  const { game, pendingMove } = session;
  if (game === null) return null;
  if (pendingMove === null) return game.fen;
  const played = applyMove(game.fen, pendingMove);
  return played.ok ? played.fen : game.fen;
}

/** The last move of the game or the pending one, for the board to mark. */
export function lastMove(session: GameSession): { from: string; to: string } | null {
  const uci = session.pendingMove ?? session.game?.moves.at(-1)?.uci;
  return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null;
}

export interface MovePair {
  number: number;
  white: string | null;
  black: string | null;
}

/** The list of moves in two columns, one row per move number: `1. e4 e5`. */
export function movePairs(game: Game): MovePair[] {
  const pairs: MovePair[] = [];
  game.moves.forEach(({ san }, index) => {
    if (index % 2 === 0) pairs.push({ number: index / 2 + 1, white: san, black: null });
    else {
      const pair = pairs.at(-1);
      if (pair) pair.black = san;
    }
  });
  return pairs;
}

export type GameStatusChip = 'your-turn' | 'thinking' | 'check' | 'busy' | 'over';

/** Which chip the game shows for the learner: the bot's chip is the other side of it. */
export function statusChip(session: GameSession): GameStatusChip {
  const { game, phase } = session;
  if (game === null || phase === 'over') return 'over';
  if (phase === 'busy') return 'busy';
  if (phase === 'waiting') return 'thinking';
  return game.inCheck ? 'check' : 'your-turn';
}

/** Moves the learner may take back: the game is on, learning is on, and they have moved. */
export function canUndo(session: GameSession): boolean {
  const { game, phase } = session;
  if (game === null || !game.learning || (phase !== 'playing' && phase !== 'busy')) return false;
  const learnerPlies =
    game.userColor === 'w' ? Math.ceil(game.moves.length / 2) : Math.floor(game.moves.length / 2);
  return learnerPlies > 0;
}

export function canHint(session: GameSession): boolean {
  const { game, phase } = session;
  return game !== null && game.learning && phase === 'playing' && game.hintsLeft > 0;
}
