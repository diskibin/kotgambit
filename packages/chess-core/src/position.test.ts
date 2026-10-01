import { describe, expect, it } from 'vitest';
import {
  STARTING_FEN,
  applyMove,
  countMaterial,
  getStatus,
  isValidFen,
  legalMoves,
  turn,
} from './position.js';

const FOOLS_MATE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
const STALEMATE = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
const BARE_KINGS = '8/8/8/4k3/8/8/4K3/8 w - - 0 1';
const PROMOTION = '8/4P2k/8/8/8/8/8/K7 w - - 0 1';
const BISHOP_CHECK = 'rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3';
const EN_PASSANT_READY = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';

describe('isValidFen', () => {
  it('accepts the starting position', () => {
    expect(isValidFen(STARTING_FEN)).toBe(true);
  });

  it('rejects garbage', () => {
    expect(isValidFen('not a fen')).toBe(false);
  });

  it('rejects a position without kings', () => {
    expect(isValidFen('8/8/8/8/8/8/8/8 w - - 0 1')).toBe(false);
  });
});

describe('turn', () => {
  it('returns the side to move', () => {
    expect(turn(STARTING_FEN)).toBe('w');
    expect(turn(STALEMATE)).toBe('b');
  });

  it('returns null for an invalid FEN', () => {
    expect(turn('x')).toBeNull();
  });
});

describe('legalMoves', () => {
  it('lists the 20 opening moves', () => {
    expect(legalMoves(STARTING_FEN)).toHaveLength(20);
  });

  it('fills in uci and san', () => {
    const e4 = legalMoves(STARTING_FEN).find((m) => m.uci === 'e2e4');
    expect(e4).toMatchObject({ from: 'e2', to: 'e4', san: 'e4', isCapture: false });
  });

  it('is empty when there is no legal move', () => {
    expect(legalMoves(FOOLS_MATE)).toEqual([]);
    expect(legalMoves(STALEMATE)).toEqual([]);
  });

  it('offers all four promotion pieces', () => {
    const promotions = legalMoves(PROMOTION).filter((m) => m.from === 'e7');
    expect(promotions.map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
  });

  it('returns nothing for an invalid FEN', () => {
    expect(legalMoves('x')).toEqual([]);
  });
});

describe('applyMove', () => {
  it('plays a UCI move', () => {
    const result = applyMove(STARTING_FEN, 'e2e4');
    expect(result).toMatchObject({ ok: true, move: { san: 'e4' } });
    if (result.ok) expect(turn(result.fen)).toBe('b');
  });

  it('plays a SAN move', () => {
    expect(applyMove(STARTING_FEN, 'Nf3')).toMatchObject({ ok: true, move: { uci: 'g1f3' } });
  });

  it('plays a promotion given in UCI', () => {
    expect(applyMove(PROMOTION, 'e7e8q')).toMatchObject({
      ok: true,
      move: { promotion: 'q', san: expect.stringContaining('e8=Q') },
    });
  });

  it('rejects an illegal move', () => {
    expect(applyMove(STARTING_FEN, 'e2e5')).toEqual({ ok: false, reason: 'illegal-move' });
    expect(applyMove(STARTING_FEN, 'Qd4')).toEqual({ ok: false, reason: 'illegal-move' });
  });

  it('rejects a promotion without a piece', () => {
    expect(applyMove(PROMOTION, 'e7e8')).toEqual({ ok: false, reason: 'illegal-move' });
  });

  it('rejects an invalid FEN', () => {
    expect(applyMove('x', 'e2e4')).toEqual({ ok: false, reason: 'invalid-fen' });
  });

  it('marks captures', () => {
    expect(applyMove(EN_PASSANT_READY, 'exd5')).toMatchObject({
      ok: true,
      move: { isCapture: true },
    });
  });
});

describe('getStatus', () => {
  it('reports a normal position', () => {
    expect(getStatus(STARTING_FEN)).toEqual({ kind: 'playing', inCheck: false });
  });

  it('reports check', () => {
    expect(getStatus(BISHOP_CHECK)).toEqual({ kind: 'playing', inCheck: true });
  });

  it('reports checkmate with the winner', () => {
    expect(getStatus(FOOLS_MATE)).toEqual({ kind: 'checkmate', winner: 'b' });
  });

  it('reports stalemate', () => {
    expect(getStatus(STALEMATE)).toEqual({ kind: 'draw', reason: 'stalemate' });
  });

  it('reports insufficient material', () => {
    expect(getStatus(BARE_KINGS)).toEqual({ kind: 'draw', reason: 'insufficient-material' });
  });

  it('reports the fifty-move rule', () => {
    expect(getStatus('4k3/8/8/8/8/8/4R3/4K3 w - - 100 80')).toEqual({
      kind: 'draw',
      reason: 'fifty-moves',
    });
  });

  it('returns null for an invalid FEN', () => {
    expect(getStatus('x')).toBeNull();
  });
});

describe('countMaterial', () => {
  it('is balanced at the start', () => {
    expect(countMaterial(STARTING_FEN)).toEqual({ w: 39, b: 39 });
  });

  it('counts a missing queen', () => {
    expect(countMaterial('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toEqual({
      w: 39,
      b: 30,
    });
  });

  it('returns null for an invalid FEN', () => {
    expect(countMaterial('x')).toBeNull();
  });
});
