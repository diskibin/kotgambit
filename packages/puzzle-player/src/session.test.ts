import type { PuzzleSummary } from '@kotgambit/contracts';
import { describe, expect, it } from 'vitest';
import {
  initialPuzzleSession,
  puzzleMarks,
  puzzleSessionReducer,
  ratingChange,
  type PuzzleSession,
  type PuzzleSessionAction,
} from './index.js';

const FAILED: PuzzleSummary = {
  status: 'failed',
  rated: true,
  ratingBefore: 1000,
  ratingAfter: 984,
  themes: [],
  streak: 0,
};
const SOLVED: PuzzleSummary = { ...FAILED, status: 'solved', ratingAfter: 1016, streak: 1 };

function run(...actions: PuzzleSessionAction[]): PuzzleSession {
  return actions.reduce<PuzzleSession>(puzzleSessionReducer, initialPuzzleSession);
}

const started = { type: 'puzzle/started', attemptId: 'a1' } as const;

// The reducer takes any action so that it fits next to others in a store, the tests keep the types strict
const step = (state: PuzzleSession, action: PuzzleSessionAction) =>
  puzzleSessionReducer(state, action);

describe('puzzleSessionReducer', () => {
  it('starts in the solving phase with nothing used', () => {
    expect(run(started)).toEqual({
      ...initialPuzzleSession,
      attemptId: 'a1',
      phase: 'solving',
    });
  });

  it('ignores moves and hints before a puzzle has started', () => {
    expect(run({ type: 'puzzle/moveWrong', mistakes: 1, summary: null })).toEqual(
      initialPuzzleSession,
    );
    expect(run({ type: 'puzzle/hinted', hint: { level: 1, square: 'h4' } })).toEqual(
      initialPuzzleSession,
    );
  });

  it('keeps the summary of the first mistake, and the retry goes back to solving', () => {
    const wrong = run(started, { type: 'puzzle/moveWrong', mistakes: 1, summary: FAILED });
    expect(wrong).toMatchObject({ phase: 'wrong', mistakes: 1, summary: FAILED });

    const again = step(wrong, {
      type: 'puzzle/moveWrong',
      mistakes: 2,
      summary: null,
    });
    expect(again).toMatchObject({ mistakes: 2, summary: FAILED });
    expect(step(again, { type: 'puzzle/retried' }).phase).toBe('solving');
  });

  it('only retries from the wrong phase', () => {
    expect(step(run(started), { type: 'puzzle/retried' })).toEqual(run(started));
  });

  it('goes on after a correct move that is not the last, and finishes on the last', () => {
    const middle = run(started, { type: 'puzzle/moveCorrect', solved: false, summary: null });
    expect(middle.phase).toBe('solving');
    const done = step(middle, {
      type: 'puzzle/moveCorrect',
      solved: true,
      summary: SOLVED,
    });
    expect(done).toMatchObject({ phase: 'correct', summary: SOLVED });
  });

  it('keeps an earlier failure when the puzzle is solved after it', () => {
    const state = run(
      started,
      { type: 'puzzle/moveWrong', mistakes: 1, summary: FAILED },
      { type: 'puzzle/retried' },
      { type: 'puzzle/moveCorrect', solved: true, summary: null },
    );
    expect(state).toMatchObject({ phase: 'correct', summary: FAILED });
  });

  it('opens a hint card and remembers the square of the first level', () => {
    const first = run(started, { type: 'puzzle/hinted', hint: { level: 1, square: 'h4' } });
    expect(first).toMatchObject({ hintLevel: 1, hintOpen: true, hintSquare: 'h4' });
    const second = step(first, {
      type: 'puzzle/hinted',
      hint: { level: 2, themes: [{ key: 'pin', title: 'Связка' }] },
    });
    expect(second).toMatchObject({ hintLevel: 2, hintSquare: 'h4', hintOpen: true });
    expect(step(second, { type: 'puzzle/hintClosed' })).toMatchObject({
      hintOpen: false,
      hintLevel: 2,
    });
  });

  it('settles the rating with the last hint', () => {
    const state = run(started, {
      type: 'puzzle/hinted',
      hint: { level: 3, move: 'h4g6', summary: FAILED },
    });
    expect(state).toMatchObject({ hintLevel: 3, summary: FAILED });
  });

  it('puts the learner back to solving when a hint is asked for after a mistake', () => {
    const state = run(
      started,
      { type: 'puzzle/moveWrong', mistakes: 1, summary: FAILED },
      { type: 'puzzle/hinted', hint: { level: 1, square: 'h4' } },
    );
    expect(state.phase).toBe('solving');
  });

  it('starts the hints over after a correct move that leaves more to do', () => {
    const state = run(
      started,
      { type: 'puzzle/hinted', hint: { level: 2, themes: [] } },
      { type: 'puzzle/moveCorrect', solved: false, summary: null },
    );
    expect(state).toMatchObject({ hintLevel: 0, hint: null, hintSquare: null, hintOpen: false });
  });

  it('shows the solution after giving up, and stops taking moves', () => {
    const gaveUp = run(started, {
      type: 'puzzle/gaveUp',
      solution: ['h4g6', 'f8g8', 'f6h8'],
      summary: FAILED,
    });
    expect(gaveUp).toMatchObject({ phase: 'solution', solution: ['h4g6', 'f8g8', 'f6h8'] });
    expect(step(gaveUp, { type: 'puzzle/moveCorrect', solved: true, summary: SOLVED })).toEqual(
      gaveUp,
    );
  });

  it('forgets everything on exit and leaves foreign actions alone', () => {
    const state = run(started, { type: 'puzzle/moveWrong', mistakes: 1, summary: FAILED });
    expect(step(state, { type: 'puzzle/exited' })).toEqual(initialPuzzleSession);
    expect(puzzleSessionReducer(state, { type: 'something/else' })).toBe(state);
  });
});

describe('ratingChange', () => {
  it('is the difference of the ratings, and zero without a summary', () => {
    expect(ratingChange(SOLVED)).toBe(16);
    expect(ratingChange(FAILED)).toBe(-16);
    expect(ratingChange(null)).toBe(0);
  });
});

describe('puzzleMarks', () => {
  it('marks nothing without hints', () => {
    expect(puzzleMarks(run(started))).toEqual({ squares: [], arrows: [] });
  });

  it('frames the piece of the first hint and keeps the frame on the second', () => {
    const first = run(started, { type: 'puzzle/hinted', hint: { level: 1, square: 'h4' } });
    expect(puzzleMarks(first)).toEqual({ squares: ['h4'], arrows: [] });
    const second = step(first, {
      type: 'puzzle/hinted',
      hint: { level: 2, themes: [] },
    });
    expect(puzzleMarks(second)).toEqual({ squares: ['h4'], arrows: [] });
  });

  it('draws the arrow of the move on the last hint', () => {
    const state = run(started, {
      type: 'puzzle/hinted',
      hint: { level: 3, move: 'h4g6', summary: null },
    });
    expect(puzzleMarks(state)).toEqual({
      squares: ['h4', 'g6'],
      arrows: [{ from: 'h4', to: 'g6', color: 'sun' }],
    });
  });

  it('draws at most two arrows of the solution, the learner in sun and the opponent in sky', () => {
    const state = run(started, {
      type: 'puzzle/gaveUp',
      solution: ['h4g6', 'f8g8', 'f6h8'],
      summary: null,
    });
    expect(puzzleMarks(state)).toEqual({
      squares: [],
      arrows: [
        { from: 'h4', to: 'g6', color: 'sun' },
        { from: 'f8', to: 'g8', color: 'sky' },
      ],
    });
  });
});
