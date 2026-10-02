import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfo } from './uci-parser.js';

// Lines as Stockfish prints them, kept verbatim so that a format change shows up here
const INFO_CP =
  'info depth 12 seldepth 17 multipv 1 score cp 34 nodes 20517 nps 1025850 hashfull 7 tbhits 0 time 20 pv e2e4 e7e5 g1f3 b8c6';
const INFO_MATE =
  'info depth 8 seldepth 3 multipv 2 score mate -2 nodes 1304 nps 652000 tbhits 0 time 2 pv f7f6 d1h5';
const INFO_NO_MULTIPV = 'info depth 1 seldepth 1 score cp -12 nodes 20 time 1 pv d2d4';

describe('parseInfo', () => {
  it('reads depth, score, nodes, time and the variation', () => {
    expect(parseInfo(INFO_CP)).toEqual({
      depth: 12,
      multipv: 1,
      score: { kind: 'cp', value: 34 },
      nodes: 20517,
      timeMs: 20,
      pv: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
    });
  });

  it('reads a mate score as moves to mate, negative when the side to move gets mated', () => {
    expect(parseInfo(INFO_MATE)).toMatchObject({
      multipv: 2,
      score: { kind: 'mate', value: -2 },
      pv: ['f7f6', 'd1h5'],
    });
  });

  it('treats a missing multipv as the first line', () => {
    expect(parseInfo(INFO_NO_MULTIPV)).toMatchObject({ multipv: 1, score: { value: -12 } });
  });

  it('skips lines without a result', () => {
    expect(parseInfo('info string NNUE evaluation using nn-1111cefa1111.nnue')).toBeNull();
    expect(parseInfo('info depth 5 currmove e2e4 currmovenumber 1')).toBeNull();
    expect(parseInfo('readyok')).toBeNull();
    expect(parseInfo('')).toBeNull();
  });

  it('skips bounded scores, they are not the value of the depth', () => {
    expect(parseInfo(`${INFO_CP.replace('nodes', 'lowerbound nodes')}`)).toBeNull();
    expect(parseInfo(`${INFO_CP.replace('nodes', 'upperbound nodes')}`)).toBeNull();
  });

  it('skips a line cut off before the variation', () => {
    expect(parseInfo('info depth 12 score cp 34 nodes 1')).toBeNull();
  });
});

describe('parseBestMove', () => {
  it('reads the move and the ponder move', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ move: 'e2e4', ponder: 'e7e5' });
  });

  it('allows a missing ponder move', () => {
    expect(parseBestMove('bestmove g1f3')).toEqual({ move: 'g1f3', ponder: null });
  });

  it('reads a promotion', () => {
    expect(parseBestMove('bestmove a7a8q')).toMatchObject({ move: 'a7a8q' });
  });

  it('maps (none) to null for a finished game', () => {
    expect(parseBestMove('bestmove (none)')).toEqual({ move: null, ponder: null });
  });

  it('ignores other lines', () => {
    expect(parseBestMove('info depth 3 score cp 1 pv e2e4')).toBeNull();
    expect(parseBestMove('bestmove')).toBeNull();
  });
});
