import { afterEach, describe, expect, it } from 'vitest';
import { spawnEngineProcess } from './engine-process.js';
import { EnginePool, Priority } from './engine-pool.js';
import { UciEngine } from './uci-engine.js';

// Needs a real Stockfish: ENGINE_PATH=/path/to/stockfish pnpm --filter @kotgambit/api test
const ENGINE_PATH = process.env.ENGINE_PATH;

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MATE_IN_ONE = '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1';
const CHECKMATED = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
const TIMEOUT_MS = 10_000;

describe.skipIf(!ENGINE_PATH)('UciEngine with a real Stockfish', () => {
  const engines: UciEngine[] = [];
  const newEngine = () => {
    const engine = new UciEngine(() => spawnEngineProcess(ENGINE_PATH as string), {
      uciOptions: { Threads: 1, Hash: 16 },
      startupTimeoutMs: TIMEOUT_MS,
    });
    engines.push(engine);
    return engine;
  };

  afterEach(() => {
    engines.splice(0).forEach((engine) => engine.close());
  });

  it('finds a move from the starting position', async () => {
    const result = await newEngine().analyze({ fen: START, depth: 8 }, TIMEOUT_MS);
    expect(result.bestMove).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    expect(result.timedOut).toBe(false);
    expect(result.lines[0]).toMatchObject({ multipv: 1, score: { kind: 'cp' } });
    expect(result.lines[0]?.depth).toBeGreaterThanOrEqual(8);
  });

  it('reports a forced mate as moves to mate', async () => {
    const result = await newEngine().analyze({ fen: MATE_IN_ONE, depth: 6 }, TIMEOUT_MS);
    expect(result.lines[0]?.score).toEqual({ kind: 'mate', value: 1 });
    expect(result.bestMove).toBe('b1b8');
  });

  it('returns no move for a position that is already mate', async () => {
    const result = await newEngine().analyze({ fen: CHECKMATED, depth: 4 }, TIMEOUT_MS);
    expect(result.bestMove).toBeNull();
  });

  it('returns the requested number of variations, best first', async () => {
    const result = await newEngine().analyze({ fen: START, depth: 8, multipv: 3 }, TIMEOUT_MS);
    expect(result.lines.map((line) => line.multipv)).toEqual([1, 2, 3]);
    const first = result.lines[0]?.score;
    const third = result.lines[2]?.score;
    expect(first?.kind === 'cp' && third?.kind === 'cp' && first.value >= third.value).toBe(true);
  });

  it('stops a search that is too deep for the budget and still gives a move', async () => {
    const result = await newEngine().analyze({ fen: START, depth: 60 }, 300);
    expect(result.timedOut).toBe(true);
    expect(result.bestMove).not.toBeNull();
  });

  it('serves several requests at once through a pool', async () => {
    const pool = new EnginePool([newEngine(), newEngine()], {
      maxQueue: 10,
      defaultTimeoutMs: TIMEOUT_MS,
      retryAfterSeconds: 1,
    });
    const answers = await Promise.all(
      [START, MATE_IN_ONE, START, MATE_IN_ONE].map((fen) =>
        pool.analyze({ fen, depth: 6 }, { priority: Priority.Analysis }),
      ),
    );
    expect(answers.every((answer) => answer.bestMove !== null)).toBe(true);
    expect(pool.metrics()).toMatchObject({ completed: 4, queued: 0, busy: 0 });
  });
});
