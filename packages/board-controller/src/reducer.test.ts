import { describe, expect, it } from 'vitest';
import { boardReducer, createBoardState, type BoardAction, type BoardState } from './reducer.js';
import { selectTargetSquares } from './selectors.js';

const PROMOTION_FEN = '8/4P2k/8/8/8/8/8/K7 w - - 0 1';

function run(state: BoardState, ...actions: BoardAction[]): BoardState {
  return actions.reduce(boardReducer, state);
}

const select = (square: string): BoardAction => ({ type: 'square/select', square });

describe('selection', () => {
  it('selects a piece that has legal moves', () => {
    const state = run(createBoardState(), select('e2'));
    expect(state.selected).toBe('e2');
    expect(selectTargetSquares(state).sort()).toEqual(['e3', 'e4']);
  });

  it('ignores empty squares and the opponent pieces', () => {
    expect(run(createBoardState(), select('e4')).selected).toBeNull();
    expect(run(createBoardState(), select('e7')).selected).toBeNull();
  });

  it('ignores a piece without moves', () => {
    expect(run(createBoardState(), select('a1')).selected).toBeNull();
  });

  it('deselects on a second tap', () => {
    expect(run(createBoardState(), select('e2'), select('e2')).selected).toBeNull();
  });

  it('switches selection to another own piece', () => {
    expect(run(createBoardState(), select('e2'), select('g1')).selected).toBe('g1');
  });

  it('clears the selection on request', () => {
    expect(run(createBoardState(), select('e2'), { type: 'selection/clear' }).selected).toBeNull();
  });
});

describe('moving', () => {
  it('plays a move by two taps', () => {
    const state = run(createBoardState(), select('e2'), select('e4'));
    expect(state.fen).toContain('4P3');
    expect(state.lastMove).toMatchObject({ uci: 'e2e4', san: 'e4' });
    expect(state.selected).toBeNull();
  });

  it('plays a move by drag', () => {
    const state = run(createBoardState(), { type: 'move/attempt', from: 'g1', to: 'f3' });
    expect(state.lastMove?.uci).toBe('g1f3');
  });

  it('drops an illegal drag without changing the position', () => {
    const before = createBoardState();
    const state = run(before, { type: 'move/attempt', from: 'e2', to: 'e5' });
    expect(state.fen).toBe(before.fen);
    expect(state.lastMove).toBeNull();
  });
});

describe('promotion', () => {
  const start = createBoardState({ fen: PROMOTION_FEN });

  it('waits for the piece choice', () => {
    const state = run(start, select('e7'), select('e8'));
    expect(state.pendingPromotion).toEqual({ from: 'e7', to: 'e8' });
    expect(state.fen).toBe(PROMOTION_FEN);
  });

  it('completes with the chosen piece', () => {
    const state = run(start, select('e7'), select('e8'), { type: 'promotion/choose', piece: 'n' });
    expect(state.lastMove?.uci).toBe('e7e8n');
    expect(state.pendingPromotion).toBeNull();
  });

  it('can be cancelled', () => {
    const state = run(start, select('e7'), select('e8'), { type: 'promotion/cancel' });
    expect(state.fen).toBe(PROMOTION_FEN);
    expect(state.pendingPromotion).toBeNull();
    expect(state.selected).toBeNull();
  });

  it('blocks other input while pending', () => {
    const pending = run(start, select('e7'), select('e8'));
    expect(boardReducer(pending, select('a1'))).toBe(pending);
    expect(boardReducer(pending, { type: 'orientation/flip' })).toBe(pending);
  });
});

describe('lesson mode', () => {
  const lesson = createBoardState({ allowedMoves: ['e2e4'] });

  it('accepts the expected move', () => {
    expect(run(lesson, select('e2'), select('e4')).lastMove?.uci).toBe('e2e4');
  });

  it('rejects another legal move and remembers it', () => {
    const state = run(lesson, select('d2'), select('d4'));
    expect(state.fen).toBe(lesson.fen);
    expect(state.rejected).toEqual({ from: 'd2', to: 'd4' });
  });

  it('shows only allowed target squares', () => {
    expect(selectTargetSquares(run(lesson, select('e2')))).toEqual(['e4']);
  });

  it('clears the rejection on the next input', () => {
    const state = run(lesson, select('d2'), select('d4'), select('e2'));
    expect(state.rejected).toBeNull();
  });

  it('refuses further moves once the step is done', () => {
    const done = run(lesson, select('e2'), select('e4'));
    const after = run(done, select('e7'), select('e5'));
    expect(after.fen).toBe(done.fen);
  });

  it('enforces the allowed promotion piece', () => {
    const state = createBoardState({ fen: PROMOTION_FEN, allowedMoves: ['e7e8q'] });
    const wrong = run(state, select('e7'), select('e8'), { type: 'promotion/choose', piece: 'r' });
    expect(wrong.rejected).toEqual({ from: 'e7', to: 'e8' });
    expect(wrong.fen).toBe(PROMOTION_FEN);
    const right = run(state, select('e7'), select('e8'), { type: 'promotion/choose', piece: 'q' });
    expect(right.lastMove?.uci).toBe('e7e8q');
  });
});

describe('orientation and position', () => {
  it('flips the board', () => {
    expect(run(createBoardState(), { type: 'orientation/flip' }).orientation).toBe('b');
  });

  it('replaces the position and resets transient state', () => {
    const played = run(createBoardState(), select('e2'), select('e4'));
    const state = run(played, {
      type: 'position/set',
      fen: PROMOTION_FEN,
      allowedMoves: ['e7e8q'],
    });
    expect(state).toMatchObject({
      fen: PROMOTION_FEN,
      lastMove: null,
      selected: null,
      allowedMoves: ['e7e8q'],
    });
  });

  it('ignores an invalid position', () => {
    const before = createBoardState();
    expect(boardReducer(before, { type: 'position/set', fen: 'nonsense' })).toBe(before);
  });
});
