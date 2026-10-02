import { describe, expect, it } from 'vitest';
import {
  EngineBusyError,
  EnginePool,
  Priority,
  type PoolOptions,
  type SearchEngine,
} from './engine-pool.js';
import type { Analysis, AnalyzeRequest } from './uci-engine.js';

const OPTIONS: PoolOptions = { maxQueue: 2, defaultTimeoutMs: 1000, retryAfterSeconds: 3 };
const fen = (label: string) => `${label} w - - 0 1`;
const request = (label: string): AnalyzeRequest => ({ fen: fen(label), depth: 5 });

interface Pending {
  request: AnalyzeRequest;
  timeoutMs: number;
  finish: (bestMove: string) => void;
  fail: (error: Error) => void;
}

/** An engine that answers when the test says so, and remembers what it was asked. */
class ManualEngine implements SearchEngine {
  readonly started: Pending[] = [];
  closed = false;

  analyze(req: AnalyzeRequest, timeoutMs: number): Promise<Analysis> {
    return new Promise((resolve, reject) => {
      this.started.push({
        request: req,
        timeoutMs,
        finish: (bestMove) => resolve({ bestMove, lines: [], timedOut: false }),
        fail: reject,
      });
    });
  }

  close(): void {
    this.closed = true;
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('EnginePool', () => {
  it('runs a request on an idle engine and returns its answer', async () => {
    const engine = new ManualEngine();
    const pool = new EnginePool([engine], OPTIONS);
    const answer = pool.analyze(request('a'), { priority: Priority.Analysis });
    engine.started[0]?.finish('e2e4');
    expect((await answer).bestMove).toBe('e2e4');
    expect(pool.metrics()).toMatchObject({ completed: 1, busy: 0, queued: 0 });
  });

  it('passes the default budget and an explicit one to the engine', async () => {
    const engine = new ManualEngine();
    const pool = new EnginePool([engine], OPTIONS);
    void pool.analyze(request('a'), { priority: Priority.Analysis });
    engine.started[0]?.finish('x');
    await tick();
    void pool.analyze(request('b'), { priority: Priority.Bot, timeoutMs: 250 });
    expect(engine.started.map((job) => job.timeoutMs)).toEqual([1000, 250]);
  });

  it('serves the most important request first, and in order within one priority', async () => {
    const engine = new ManualEngine();
    const pool = new EnginePool([engine], { ...OPTIONS, maxQueue: 10 });
    const first = pool.analyze(request('busy'), { priority: Priority.Review });
    void pool.analyze(request('review'), { priority: Priority.Review });
    void pool.analyze(request('analysis-1'), { priority: Priority.Analysis });
    void pool.analyze(request('bot'), { priority: Priority.Bot });
    void pool.analyze(request('analysis-2'), { priority: Priority.Analysis });

    for (let served = 0; served < 5; served += 1) {
      engine.started[served]?.finish('x');
      await tick();
    }
    await first;
    expect(engine.started.map((job) => job.request.fen.split(' ')[0])).toEqual([
      'busy',
      'bot',
      'analysis-1',
      'analysis-2',
      'review',
    ]);
  });

  it('runs requests in parallel up to the number of engines', () => {
    const engines = [new ManualEngine(), new ManualEngine()];
    const pool = new EnginePool(engines, OPTIONS);
    void pool.analyze(request('a'), { priority: Priority.Analysis });
    void pool.analyze(request('b'), { priority: Priority.Analysis });
    void pool.analyze(request('c'), { priority: Priority.Analysis });
    expect(pool.metrics()).toMatchObject({ workers: 2, busy: 2, queued: 1 });
  });

  it('turns a request away with a retry hint when the queue is full', async () => {
    const pool = new EnginePool([new ManualEngine()], OPTIONS);
    void pool.analyze(request('running'), { priority: Priority.Analysis });
    void pool.analyze(request('q1'), { priority: Priority.Analysis });
    void pool.analyze(request('q2'), { priority: Priority.Analysis });

    const refused = pool.analyze(request('q3'), { priority: Priority.Analysis });
    await expect(refused).rejects.toBeInstanceOf(EngineBusyError);
    await expect(refused).rejects.toMatchObject({ retryAfterSeconds: 3 });
    expect(pool.metrics()).toMatchObject({ queued: 2, rejected: 1 });
  });

  it('lets a bot move push the newest review out of a full queue', async () => {
    const engine = new ManualEngine();
    const pool = new EnginePool([engine], OPTIONS);
    void pool.analyze(request('running'), { priority: Priority.Review });
    void pool.analyze(request('review-1'), { priority: Priority.Review });
    const review2 = pool.analyze(request('review-2'), { priority: Priority.Review });
    const bot = pool.analyze(request('bot'), { priority: Priority.Bot });

    await expect(review2).rejects.toBeInstanceOf(EngineBusyError);
    engine.started[0]?.finish('x');
    await tick();
    expect(engine.started[1]?.request.fen).toContain('bot');
    engine.started[1]?.finish('e2e4');
    expect((await bot).bestMove).toBe('e2e4');
  });

  it('does not push out a request of the same priority', async () => {
    const pool = new EnginePool([new ManualEngine()], OPTIONS);
    void pool.analyze(request('running'), { priority: Priority.Bot });
    void pool.analyze(request('q1'), { priority: Priority.Bot });
    void pool.analyze(request('q2'), { priority: Priority.Bot });
    await expect(pool.analyze(request('q3'), { priority: Priority.Bot })).rejects.toBeInstanceOf(
      EngineBusyError,
    );
  });

  it('passes an engine failure to the caller and keeps serving', async () => {
    const engine = new ManualEngine();
    const pool = new EnginePool([engine], OPTIONS);
    const failing = pool.analyze(request('a'), { priority: Priority.Analysis });
    const next = pool.analyze(request('b'), { priority: Priority.Analysis });
    engine.started[0]?.fail(new Error('boom'));
    await expect(failing).rejects.toThrow('boom');
    await tick();
    engine.started[1]?.finish('d2d4');
    expect((await next).bestMove).toBe('d2d4');
    expect(pool.metrics()).toMatchObject({ failed: 1, completed: 1 });
  });

  it('reports how long requests waited', async () => {
    let clock = 0;
    const engine = new ManualEngine();
    const pool = new EnginePool([engine], { ...OPTIONS, maxQueue: 5 }, () => clock);
    void pool.analyze(request('a'), { priority: Priority.Analysis });
    void pool.analyze(request('b'), { priority: Priority.Analysis });
    clock = 400;
    engine.started[0]?.finish('x');
    await tick();
    // The first request waited 0 ms and the second 400 ms
    expect(pool.metrics().recentWaitMs).toBe(200);
  });

  it('refuses work after close, rejects the waiting and closes the engines', async () => {
    const engine = new ManualEngine();
    const pool = new EnginePool([engine], OPTIONS);
    void pool.analyze(request('running'), { priority: Priority.Analysis }).catch(() => undefined);
    const waiting = pool.analyze(request('waiting'), { priority: Priority.Analysis });
    pool.close();
    await expect(waiting).rejects.toThrow('closed');
    await expect(pool.analyze(request('late'), { priority: Priority.Bot })).rejects.toThrow(
      'closed',
    );
    expect(engine.closed).toBe(true);
  });
});
