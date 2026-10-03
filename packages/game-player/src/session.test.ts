import { STARTING_FEN } from '@kotgambit/chess-core';
import type { Game } from '@kotgambit/contracts';
import { describe, expect, it } from 'vitest';
import {
  boardFen,
  canHint,
  canUndo,
  gameSessionReducer,
  initialGameSession,
  lastMove,
  movePairs,
  statusChip,
  type GameSession,
  type GameSessionAction,
} from './index.js';

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

const move = (uci: string, san: string) => ({ uci, san });

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
    botId: 'alisa',
    userColor: 'w',
    learning: true,
    status: 'active',
    fen: STARTING_FEN,
    turn: 'w',
    moves: [],
    inCheck: false,
    hintsLeft: 3,
    result: null,
    ...overrides,
  };
}

const run = (actions: GameSessionAction[], from: GameSession = initialGameSession) =>
  actions.reduce(gameSessionReducer, from);

const AFTER_ANSWER = game({
  fen: AFTER_E4_E5,
  moves: [move('e2e4', 'e4'), move('e7e5', 'e5')],
});

describe('gameSessionReducer', () => {
  it('starts idle', () => {
    expect(gameSessionReducer(undefined, { type: 'anything' })).toEqual(initialGameSession);
  });

  it('plays when the game is on the learner’s turn', () => {
    expect(run([{ type: 'game/loaded', game: game() }]).phase).toBe('playing');
  });

  it('treats a game that waits for the bot as busy, so that the answer is asked for again', () => {
    const waiting = game({ fen: AFTER_E4, turn: 'b', moves: [move('e2e4', 'e4')] });
    expect(run([{ type: 'game/loaded', game: waiting }]).phase).toBe('busy');
  });

  it('opens a finished game as over', () => {
    const over = game({
      status: 'finished',
      result: { outcome: 'win', reason: 'checkmate', xp: 30 },
    });
    expect(run([{ type: 'game/loaded', game: over }]).phase).toBe('over');
  });

  it('waits for the answer after a move and then plays on', () => {
    const sent = run([
      { type: 'game/loaded', game: game() },
      { type: 'game/moveSent', move: 'e2e4' },
    ]);
    expect(sent).toMatchObject({ phase: 'waiting', pendingMove: 'e2e4' });

    const answered = run(
      [
        {
          type: 'game/moveAnswered',
          response: { result: 'ok', game: AFTER_ANSWER, botMove: move('e7e5', 'e5') },
        },
      ],
      sent,
    );
    expect(answered).toMatchObject({ phase: 'playing', pendingMove: null, game: AFTER_ANSWER });
  });

  it('does not accept a second move while the first one is on its way', () => {
    const sent = run([
      { type: 'game/loaded', game: game() },
      { type: 'game/moveSent', move: 'e2e4' },
    ]);
    expect(run([{ type: 'game/moveSent', move: 'd2d4' }], sent).pendingMove).toBe('e2e4');
  });

  it('goes back to the position when a move is refused or fails', () => {
    const sent = run([
      { type: 'game/loaded', game: game() },
      { type: 'game/moveSent', move: 'e2e5' },
    ]);
    for (const action of [
      { type: 'game/moveAnswered', response: { result: 'illegal' } },
      { type: 'game/moveFailed' },
    ] as GameSessionAction[]) {
      expect(run([action], sent)).toMatchObject({ phase: 'playing', pendingMove: null });
    }
  });

  it('is busy when the bot did not answer, and plays on once it has', () => {
    const afterMove = game({ fen: AFTER_E4, turn: 'b', moves: [move('e2e4', 'e4')] });
    const busy = run([
      { type: 'game/loaded', game: game() },
      { type: 'game/moveSent', move: 'e2e4' },
      { type: 'game/moveAnswered', response: { result: 'ok', game: afterMove, botMove: null } },
    ]);
    expect(busy).toMatchObject({ phase: 'busy', pendingMove: null });

    const resumed = run(
      [
        {
          type: 'game/moveAnswered',
          response: { result: 'ok', game: AFTER_ANSWER, botMove: move('e7e5', 'e5') },
        },
      ],
      busy,
    );
    expect(resumed.phase).toBe('playing');
  });

  it('marks the end of the game', () => {
    const over = game({
      status: 'finished',
      moves: [move('e2e4', 'e4')],
      result: { outcome: 'win', reason: 'checkmate', xp: 30 },
    });
    const state = run([
      { type: 'game/loaded', game: game() },
      { type: 'game/moveSent', move: 'e2e4' },
      { type: 'game/moveAnswered', response: { result: 'ok', game: over, botMove: null } },
    ]);
    expect(state.phase).toBe('over');
  });

  it('keeps a hint until the position changes, and counts it', () => {
    const hinted = run([
      { type: 'game/loaded', game: game() },
      { type: 'game/hinted', move: 'e2e4', hintsLeft: 2 },
    ]);
    expect(hinted).toMatchObject({ hint: 'e2e4', game: { hintsLeft: 2 } });
    expect(run([{ type: 'game/hintCleared' }], hinted).hint).toBeNull();
    expect(run([{ type: 'game/moveSent', move: 'e2e4' }], hinted).hint).toBeNull();
  });

  it('opens and closes the resign question, but not after the game is over', () => {
    const playing = run([{ type: 'game/loaded', game: game() }]);
    const asked = run([{ type: 'game/resignAsked' }], playing);
    expect(asked.resignOpen).toBe(true);
    expect(run([{ type: 'game/resignCancelled' }], asked).resignOpen).toBe(false);

    const over = run([
      {
        type: 'game/loaded',
        game: game({
          status: 'finished',
          result: { outcome: 'loss', reason: 'resignation', xp: 10 },
        }),
      },
      { type: 'game/resignAsked' },
    ]);
    expect(over.resignOpen).toBe(false);
  });

  it('forgets everything on exit', () => {
    expect(run([{ type: 'game/loaded', game: game() }, { type: 'game/exited' }])).toEqual(
      initialGameSession,
    );
  });
});

describe('what the board shows', () => {
  it('plays the move on its way at once', () => {
    const state = run([
      { type: 'game/loaded', game: game() },
      { type: 'game/moveSent', move: 'e2e4' },
    ]);
    expect(boardFen(state)).toBe(AFTER_E4.replace(' 0 1', ' 0 1'));
    expect(lastMove(state)).toEqual({ from: 'e2', to: 'e4' });
  });

  it('shows the position of the game otherwise', () => {
    const state = run([{ type: 'game/loaded', game: AFTER_ANSWER }]);
    expect(boardFen(state)).toBe(AFTER_E4_E5);
    expect(lastMove(state)).toEqual({ from: 'e7', to: 'e5' });
    expect(boardFen(initialGameSession)).toBeNull();
    expect(lastMove(initialGameSession)).toBeNull();
  });
});

describe('movePairs', () => {
  it('lists the moves by their number, leaving the black half empty for a move in progress', () => {
    const moves = [move('e2e4', 'e4'), move('e7e5', 'e5'), move('g1f3', 'Nf3')];
    expect(movePairs(game({ moves }))).toEqual([
      { number: 1, white: 'e4', black: 'e5' },
      { number: 2, white: 'Nf3', black: null },
    ]);
    expect(movePairs(game())).toEqual([]);
  });
});

describe('statusChip', () => {
  const chip = (g: Game, extra: Partial<GameSession> = {}) =>
    statusChip({ ...run([{ type: 'game/loaded', game: g }]), ...extra });

  it('tells whose turn it is and when the learner is in check', () => {
    expect(chip(game())).toBe('your-turn');
    expect(chip(game({ inCheck: true }))).toBe('check');
    expect(chip(game(), { phase: 'waiting' })).toBe('thinking');
    expect(chip(game(), { phase: 'busy' })).toBe('busy');
    expect(statusChip(initialGameSession)).toBe('over');
  });
});

describe('what learning mode allows', () => {
  const state = (g: Game) => run([{ type: 'game/loaded', game: g }]);

  it('takes back a move only after the learner has moved', () => {
    expect(canUndo(state(game()))).toBe(false);
    expect(canUndo(state(AFTER_ANSWER))).toBe(true);
    // The learner is black and only the bot's opening is on the board
    const opening = game({ userColor: 'b', fen: AFTER_E4, turn: 'b', moves: [move('e2e4', 'e4')] });
    expect(canUndo(state(opening))).toBe(false);
  });

  it('gives no undo and no hints in a plain game', () => {
    const plain = state(game({ learning: false, hintsLeft: 0, moves: AFTER_ANSWER.moves }));
    expect(canUndo(plain)).toBe(false);
    expect(canHint(plain)).toBe(false);
  });

  it('stops hints when none are left or the bot is thinking', () => {
    expect(canHint(state(game()))).toBe(true);
    expect(canHint(state(game({ hintsLeft: 0 })))).toBe(false);
    expect(canHint({ ...state(game()), phase: 'waiting' })).toBe(false);
  });
});
