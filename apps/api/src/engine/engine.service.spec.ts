import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/config.module.js';
import { loadConfig } from '../config/config.js';
import { AnalysisCache, analysisCacheKey, type CachedAnalysis } from './analysis-cache.js';
import { EnginePool, Priority, type SearchEngine } from './engine-pool.js';
import { EngineService } from './engine.service.js';
import type { Analysis } from './uci-engine.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ENV = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  ENGINE_PATH: 'stockfish',
};

class MemoryCache {
  readonly entries = new Map<string, { value: CachedAnalysis; ttl: number }>();
  get(key: string): Promise<CachedAnalysis | null> {
    return Promise.resolve(this.entries.get(key)?.value ?? null);
  }
  set(key: string, value: CachedAnalysis, ttl: number): Promise<void> {
    this.entries.set(key, { value, ttl });
    return Promise.resolve();
  }
}

function setup(analysis: Partial<Analysis> = {}) {
  const searches: unknown[] = [];
  const engine: SearchEngine = {
    analyze: (request) => {
      searches.push(request);
      return Promise.resolve({
        bestMove: 'e2e4',
        lines: [
          {
            depth: 8,
            multipv: 1,
            score: { kind: 'cp', value: 31 },
            nodes: 5,
            timeMs: 3,
            pv: ['e2e4'],
          },
        ],
        timedOut: false,
        ...analysis,
      });
    },
    close: () => undefined,
  };
  const pool = new EnginePool([engine], {
    maxQueue: 5,
    defaultTimeoutMs: 1000,
    retryAfterSeconds: 3,
  });
  const cache = new MemoryCache();
  const config: AppConfig = loadConfig(ENV);
  const service = new EngineService(pool, config, cache as unknown as AnalysisCache);
  return { service, cache, searches };
}

const query = { fen: START, depth: 8, multipv: 1, priority: Priority.Analysis };

describe('analysisCacheKey', () => {
  it('ignores the move counters so that the same position shares an entry', () => {
    expect(analysisCacheKey(`${START}`, 10, 1)).toBe(
      analysisCacheKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 12 40', 10, 1),
    );
  });

  it('tells depth, number of lines and side to move apart', () => {
    const base = analysisCacheKey(START, 10, 1);
    expect(analysisCacheKey(START, 11, 1)).not.toBe(base);
    expect(analysisCacheKey(START, 10, 2)).not.toBe(base);
    expect(analysisCacheKey(START.replace(' w ', ' b '), 10, 1)).not.toBe(base);
  });
});

describe('EngineService', () => {
  it('searches, answers and keeps the result with the configured lifetime', async () => {
    const { service, cache } = setup();
    const result = await service.analyze(query);

    expect(result).toEqual({
      bestMove: 'e2e4',
      lines: [{ multipv: 1, depth: 8, score: { kind: 'cp', value: 31 }, pv: ['e2e4'] }],
      timedOut: false,
      cached: false,
    });
    const [entry] = cache.entries.values();
    expect(entry?.ttl).toBe(loadConfig(ENV).engine?.cacheTtlSeconds);
  });

  it('answers a repeated question from the cache without a second search', async () => {
    const { service, searches } = setup();
    await service.analyze(query);
    const again = await service.analyze(query);
    expect(again.cached).toBe(true);
    expect(searches).toHaveLength(1);
  });

  it('does not keep a search that was cut short', async () => {
    const { service, cache } = setup({ timedOut: true });
    const result = await service.analyze(query);
    expect(result.timedOut).toBe(true);
    expect(cache.entries.size).toBe(0);
  });

  it('rejects a position that is not a legal one before using the engine', async () => {
    const { service, searches } = setup();
    await expect(service.analyze({ ...query, fen: 'not a fen' })).rejects.toMatchObject({
      code: 'validation.failed',
      status: 400,
    });
    expect(searches).toHaveLength(0);
  });

  it('answers 503 when no engine is configured', async () => {
    const config: AppConfig = loadConfig({ ...ENV, ENGINE_PATH: undefined });
    const service = new EngineService(null, config, new MemoryCache() as unknown as AnalysisCache);
    await expect(service.analyze(query)).rejects.toMatchObject({
      code: 'server.unavailable',
      status: 503,
    });
    expect(service.metrics()).toBeNull();
  });

  it('exposes the queue metrics of the pool', async () => {
    const { service } = setup();
    await service.analyze(query);
    expect(service.metrics()).toMatchObject({ workers: 1, completed: 1, queued: 0 });
  });
});
