import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEngineProcess, FINISHED_SEARCH, scriptedEngine } from './fake-engine-process.js';
import { EngineCrashedError, EngineTimeoutError, UciEngine } from './uci-engine.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const OPTIONS = { uciOptions: { Threads: 1, Hash: 16 }, startupTimeoutMs: 1000 };

function engineWith(...processes: FakeEngineProcess[]): UciEngine {
  const queue = [...processes];
  return new UciEngine(() => {
    const next = queue.shift();
    if (!next) throw new Error('No more fake processes');
    return next;
  }, OPTIONS);
}

describe('UciEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the engine, sets the options and searches', async () => {
    const proc = scriptedEngine(FINISHED_SEARCH);
    const result = await engineWith(proc).analyze({ fen: START, depth: 2, multipv: 1 }, 1000);

    expect(proc.sent).toEqual([
      'uci',
      'setoption name Threads value 1',
      'setoption name Hash value 16',
      'isready',
      'setoption name MultiPV value 1',
      `position fen ${START}`,
      'go depth 2',
    ]);
    expect(result.bestMove).toBe('e2e4');
    expect(result.timedOut).toBe(false);
    // Only the last report of the line counts
    expect(result.lines).toEqual([
      expect.objectContaining({ depth: 2, score: { kind: 'cp', value: 25 }, pv: ['e2e4', 'e7e5'] }),
    ]);
  });

  it('starts once and reuses the process', async () => {
    const proc = scriptedEngine(FINISHED_SEARCH);
    const engine = engineWith(proc);
    await engine.analyze({ fen: START, depth: 2 }, 1000);
    await engine.analyze({ fen: START, depth: 2 }, 1000);
    expect(proc.sent.filter((command) => command === 'uci')).toHaveLength(1);
    expect(proc.sent.filter((command) => command.startsWith('go'))).toHaveLength(2);
  });

  it('sends both limits when both are given', async () => {
    const proc = scriptedEngine(FINISHED_SEARCH);
    await engineWith(proc).analyze({ fen: START, depth: 12, movetimeMs: 300 }, 1000);
    expect(proc.sent).toContain('go depth 12 movetime 300');
  });

  it('returns the variations of a multi-line search best first', async () => {
    const proc = scriptedEngine((_command, say) => {
      say('info depth 3 multipv 2 score cp 10 pv d2d4');
      say('info depth 3 multipv 1 score cp 30 pv e2e4');
      say('bestmove e2e4');
    });
    const result = await engineWith(proc).analyze({ fen: START, depth: 3, multipv: 2 }, 1000);
    expect(result.lines.map((line) => line.pv[0])).toEqual(['e2e4', 'd2d4']);
    expect(proc.sent).toContain('setoption name MultiPV value 2');
  });

  it('limits the strength by Elo and restores full strength for the next plain search', async () => {
    const proc = scriptedEngine(FINISHED_SEARCH);
    const engine = engineWith(proc);
    await engine.analyze({ fen: START, depth: 3, strength: { elo: 1500 } }, 1000);
    expect(proc.sent).toContain('setoption name UCI_LimitStrength value true');
    expect(proc.sent).toContain('setoption name UCI_Elo value 1500');

    proc.sent.length = 0;
    await engine.analyze({ fen: START, depth: 3 }, 1000);
    expect(proc.sent).toContain('setoption name UCI_LimitStrength value false');
    expect(proc.sent).toContain('setoption name Skill Level value 20');
  });

  it('limits the strength by skill level below the Elo floor', async () => {
    const proc = scriptedEngine(FINISHED_SEARCH);
    await engineWith(proc).analyze({ fen: START, depth: 1, strength: { skillLevel: 0 } }, 1000);
    expect(proc.sent).toContain('setoption name Skill Level value 0');
    expect(proc.sent).not.toContain('setoption name UCI_Elo value 0');
  });

  it('does not repeat strength options that are already set', async () => {
    const proc = scriptedEngine(FINISHED_SEARCH);
    const engine = engineWith(proc);
    await engine.analyze({ fen: START, depth: 3, strength: { elo: 1500 } }, 1000);
    proc.sent.length = 0;
    await engine.analyze({ fen: START, depth: 3, strength: { elo: 1500 } }, 1000);
    expect(proc.sent.filter((line) => line.includes('UCI_Elo'))).toEqual([]);
  });

  it('reports no move for a finished game', async () => {
    const proc = scriptedEngine((_command, say) => say('bestmove (none)'));
    const result = await engineWith(proc).analyze({ fen: START, depth: 1 }, 1000);
    expect(result).toEqual({ bestMove: null, lines: [], timedOut: false });
  });

  it('refuses a search without a limit', async () => {
    await expect(engineWith(scriptedEngine()).analyze({ fen: START }, 1000)).rejects.toThrow(
      'depth or a movetime',
    );
  });

  it('refuses a second search while one is running', async () => {
    const engine = engineWith(scriptedEngine());
    const first = engine.analyze({ fen: START, depth: 5 }, 1000).catch(() => undefined);
    await expect(engine.analyze({ fen: START, depth: 5 }, 1000)).rejects.toThrow('already');
    // The first search runs out of time; its result is not the point here
    await vi.advanceTimersByTimeAsync(5000);
    await first;
  });

  it('stops the search when the budget runs out and returns what it has', async () => {
    const proc = scriptedEngine((_command, say) => {
      say('info depth 6 multipv 1 score cp 15 pv e2e4');
    });
    // The fake answers `stop` like a real engine does, with the move found so far
    const original = proc.write.bind(proc);
    proc.write = (line: string) => {
      original(line);
      if (line === 'stop') proc.emit('bestmove e2e4');
    };

    const pending = engineWith(proc).analyze({ fen: START, depth: 40 }, 500);
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;

    expect(proc.sent).toContain('stop');
    expect(result).toMatchObject({ bestMove: 'e2e4', timedOut: true });
    expect(result.lines[0]?.depth).toBe(6);
  });

  it('drops an engine that ignores stop and starts a new one next time', async () => {
    const stuck = scriptedEngine();
    const engine = engineWith(stuck, scriptedEngine(FINISHED_SEARCH));

    const pending = engine.analyze({ fen: START, depth: 40 }, 500);
    const failure = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(500 + 1000);
    expect(await failure).toBeInstanceOf(EngineTimeoutError);
    expect(stuck.killed).toBe(true);

    const result = await engine.analyze({ fen: START, depth: 2 }, 1000);
    expect(result.bestMove).toBe('e2e4');
  });

  it('reports a crash during a search and restarts afterwards', async () => {
    const dying = scriptedEngine();
    const engine = engineWith(dying, scriptedEngine(FINISHED_SEARCH));

    const pending = engine.analyze({ fen: START, depth: 40 }, 5000);
    const failure = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    dying.crash();
    expect(await failure).toBeInstanceOf(EngineCrashedError);

    expect((await engine.analyze({ fen: START, depth: 2 }, 1000)).bestMove).toBe('e2e4');
  });

  it('fails when the engine never finishes the handshake', async () => {
    const mute = new FakeEngineProcess(() => undefined);
    const engine = engineWith(mute);
    const failure = engine.analyze({ fen: START, depth: 2 }, 1000).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(OPTIONS.startupTimeoutMs);
    expect(await failure).toBeInstanceOf(EngineTimeoutError);
    expect(mute.killed).toBe(true);
  });

  it('refuses work after close and kills the process', async () => {
    const proc = scriptedEngine(FINISHED_SEARCH);
    const engine = engineWith(proc);
    await engine.analyze({ fen: START, depth: 2 }, 1000);
    engine.close();
    expect(proc.killed).toBe(true);
    await expect(engine.analyze({ fen: START, depth: 2 }, 1000)).rejects.toThrow('closed');
  });
});
