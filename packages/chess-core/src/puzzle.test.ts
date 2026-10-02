import { describe, expect, it } from 'vitest';
import {
  checkPuzzleMove,
  isPlayablePuzzle,
  nextSolutionMove,
  remainingSolution,
  startPuzzle,
} from './puzzle.js';

// Rows of the Lichess puzzle database (CC0), the moves are split as in the file
const LONG = {
  fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'],
};
const MATE_IN_TWO = {
  fen: '4rk2/p1q5/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 b - - 0 43',
  moves: ['c7f7', 'h4g6', 'f8g8', 'f6h8'],
};
const MATE_IN_ONE = {
  fen: '5rk1/1q3r1p/3p2RQ/3p4/3B4/2P2P2/P5PP/6K1 b - - 0 30',
  moves: ['h7g6', 'h6h8'],
};
const EN_PASSANT = {
  fen: '8/pp6/2p1k3/2P2p1p/1PK2PpP/P5P1/8/8 b - - 1 31',
  moves: ['b7b5', 'c5b6', 'a7b6', 'a3a4'],
};

describe('startPuzzle', () => {
  it('plays the opponent move first and says who solves', () => {
    expect(startPuzzle(LONG.fen, LONG.moves)).toEqual({
      fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2b1/PqP3PP/7K w - - 0 25',
      lastMove: 'f2g3',
      solver: 'w',
    });
    expect(startPuzzle(MATE_IN_TWO.fen, MATE_IN_TWO.moves)?.solver).toBe('w');
  });

  it('rejects a line that is too short, odd or illegal', () => {
    expect(startPuzzle(LONG.fen, ['f2g3'])).toBeNull();
    expect(startPuzzle(LONG.fen, ['f2g3', 'e6e7', 'b2b1'])).toBeNull();
    expect(startPuzzle(LONG.fen, ['a1a8', 'e6e7'])).toBeNull();
    expect(startPuzzle('nonsense', LONG.moves)).toBeNull();
  });
});

describe('checkPuzzleMove', () => {
  it('accepts the line move by move and gives the reply of the opponent', () => {
    expect(checkPuzzleMove(LONG.fen, LONG.moves, [], 'e6e7')).toEqual({
      kind: 'correct',
      solved: false,
      reply: 'b2b1',
    });
    expect(checkPuzzleMove(LONG.fen, LONG.moves, ['e6e7'], 'b3c1')).toEqual({
      kind: 'correct',
      solved: false,
      reply: 'b1c1',
    });
  });

  it('finishes the puzzle on the last move of the line', () => {
    expect(checkPuzzleMove(LONG.fen, LONG.moves, ['e6e7', 'b3c1'], 'h6c1')).toEqual({
      kind: 'correct',
      solved: true,
      reply: null,
    });
  });

  it('calls a legal move that is not in the line wrong', () => {
    expect(checkPuzzleMove(LONG.fen, LONG.moves, [], 'h6h7')).toEqual({ kind: 'wrong' });
  });

  it('calls an illegal move illegal, and so a history that does not follow the line', () => {
    expect(checkPuzzleMove(LONG.fen, LONG.moves, [], 'a1a8')).toEqual({ kind: 'illegal' });
    expect(checkPuzzleMove(LONG.fen, LONG.moves, ['h6h7'], 'b3c1')).toEqual({ kind: 'illegal' });
  });

  it('refuses a move after the puzzle is already solved', () => {
    expect(checkPuzzleMove(LONG.fen, LONG.moves, ['e6e7', 'b3c1', 'h6c1'], 'e7e8')).toEqual({
      kind: 'illegal',
    });
  });

  it('solves a mate in one with the mating move', () => {
    expect(checkPuzzleMove(MATE_IN_ONE.fen, MATE_IN_ONE.moves, [], 'h6h8')).toEqual({
      kind: 'correct',
      solved: true,
      reply: null,
    });
  });

  it('accepts a mate that is not the one in the line', () => {
    // Both Qa8 and Qh7 mate here, the position is made for the test and is not from the database
    const fen = '6k1/Q7/6K1/8/8/8/8/8 b - - 0 1';
    const moves = ['g8h8', 'a7a8'];
    expect(checkPuzzleMove(fen, moves, [], 'a7a8')).toEqual({
      kind: 'correct',
      solved: true,
      reply: null,
    });
    expect(checkPuzzleMove(fen, moves, [], 'a7h7')).toEqual({
      kind: 'correct',
      solved: true,
      reply: null,
    });
  });

  it('does not take a check that is no mate for the line move', () => {
    const fen = '6k1/Q7/6K1/8/8/8/8/8 b - - 0 1';
    expect(checkPuzzleMove(fen, ['g8h8', 'a7a8'], [], 'a7f7')).toEqual({ kind: 'wrong' });
  });

  it('keeps a mate puzzle going until the mate and accepts the mating move', () => {
    const first = checkPuzzleMove(MATE_IN_TWO.fen, MATE_IN_TWO.moves, [], 'h4g6');
    expect(first).toEqual({ kind: 'correct', solved: false, reply: 'f8g8' });
    expect(checkPuzzleMove(MATE_IN_TWO.fen, MATE_IN_TWO.moves, ['h4g6'], 'f6h8')).toEqual({
      kind: 'correct',
      solved: true,
      reply: null,
    });
  });

  it('plays an en passant capture from the line', () => {
    expect(checkPuzzleMove(EN_PASSANT.fen, EN_PASSANT.moves, [], 'c5b6')).toMatchObject({
      kind: 'correct',
      reply: 'a7b6',
    });
  });
});

describe('nextSolutionMove', () => {
  it('gives the move the line asks for after the moves already made', () => {
    expect(nextSolutionMove(LONG.fen, LONG.moves, [])).toBe('e6e7');
    expect(nextSolutionMove(LONG.fen, LONG.moves, ['e6e7'])).toBe('b3c1');
  });

  it('has nothing to give once the puzzle is solved or the history is wrong', () => {
    expect(nextSolutionMove(LONG.fen, LONG.moves, ['e6e7', 'b3c1', 'h6c1'])).toBeNull();
    expect(nextSolutionMove(LONG.fen, LONG.moves, ['h6h7'])).toBeNull();
  });
});

describe('isPlayablePuzzle', () => {
  it('accepts the lines of the database', () => {
    expect(isPlayablePuzzle(LONG.fen, LONG.moves)).toBe(true);
    expect(isPlayablePuzzle(EN_PASSANT.fen, EN_PASSANT.moves)).toBe(true);
  });

  it('rejects a line with an illegal move in the middle', () => {
    expect(isPlayablePuzzle(LONG.fen, ['f2g3', 'e6e7', 'b2b1', 'a1a8', 'b1c1', 'h6c1'])).toBe(
      false,
    );
  });

  it('rejects a line that is too short or leaves nothing to solve', () => {
    expect(isPlayablePuzzle(LONG.fen, ['f2g3'])).toBe(false);
    expect(isPlayablePuzzle('nonsense', LONG.moves)).toBe(false);
  });
});

describe('remainingSolution', () => {
  it('gives the rest of the line after the moves already made', () => {
    expect(remainingSolution(LONG.fen, LONG.moves, [])).toEqual([
      'e6e7',
      'b2b1',
      'b3c1',
      'b1c1',
      'h6c1',
    ]);
    expect(remainingSolution(LONG.fen, LONG.moves, ['e6e7'])).toEqual(['b3c1', 'b1c1', 'h6c1']);
  });

  it('is empty when solved and null for a history that does not follow the line', () => {
    expect(remainingSolution(LONG.fen, LONG.moves, ['e6e7', 'b3c1', 'h6c1'])).toEqual([]);
    expect(remainingSolution(LONG.fen, LONG.moves, ['h6h7'])).toBeNull();
  });
});
