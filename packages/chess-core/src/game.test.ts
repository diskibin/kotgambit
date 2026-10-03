import { describe, expect, it } from 'vitest';
import { STARTING_FEN, playGame } from './index.js';

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
const KNIGHTS_OUT_AND_BACK = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];

describe('playGame', () => {
  it('starts from the initial position', () => {
    expect(playGame([])).toEqual({
      fen: STARTING_FEN,
      moves: [],
      status: { kind: 'playing', inCheck: false },
    });
  });

  it('gives the moves in SAN and UCI', () => {
    const game = playGame(['e2e4', 'e7e5', 'g1f3']);
    expect(game?.moves.map((move) => move.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(game?.moves.map((move) => move.uci)).toEqual(['e2e4', 'e7e5', 'g1f3']);
  });

  it('recognises a checkmate and the winner', () => {
    expect(playGame(FOOLS_MATE)?.status).toEqual({ kind: 'checkmate', winner: 'b' });
  });

  it('reports a check', () => {
    expect(playGame(['e2e4', 'f7f6', 'd1h5'])?.status).toEqual({ kind: 'playing', inCheck: true });
  });

  it('reports a threefold repetition, which a bare position cannot show', () => {
    const moves = [...KNIGHTS_OUT_AND_BACK, ...KNIGHTS_OUT_AND_BACK];
    expect(playGame(moves)?.status).toEqual({ kind: 'draw', reason: 'threefold-repetition' });
    expect(playGame(KNIGHTS_OUT_AND_BACK)?.status.kind).toBe('playing');
  });

  it('reports a stalemate', () => {
    // The shortest known stalemate, found by Sam Loyd
    const moves = [
      'e2e3',
      'a7a5',
      'd1h5',
      'a8a6',
      'h5a5',
      'h7h5',
      'h2h4',
      'a6h6',
      'a5c7',
      'f7f6',
      'c7d7',
      'e8f7',
      'd7b7',
      'd8d3',
      'b7b8',
      'd3h7',
      'b8c8',
      'f7g6',
      'c8e6',
    ];
    expect(playGame(moves)?.status).toEqual({ kind: 'draw', reason: 'stalemate' });
  });

  it('returns null for an illegal or malformed move', () => {
    expect(playGame(['e2e5'])).toBeNull();
    expect(playGame(['e2e4', 'e2e4'])).toBeNull();
    expect(playGame(['nonsense'])).toBeNull();
  });
});
