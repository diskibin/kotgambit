import {
  AuthResponseSchema,
  EngineAnalysisResponseSchema,
  ReadyResponseSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { scriptedEngine } from './fake-engine-process.js';
import { EnginePool } from './engine-pool.js';
import { ENGINE_POOL } from './engine.service.js';
import { ENGINE_LIMITS } from './engine.limits.js';
import { UciEngine } from './uci-engine.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_D4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

/** Searches wait here until the test lets them finish, which is how a busy server is staged. */
const heldSearches: (() => void)[] = [];
let holdSearches = false;

function fakeEngine(): UciEngine {
  return new UciEngine(
    () =>
      scriptedEngine((_command, say) => {
        const finish = () => {
          say('info depth 2 multipv 1 score cp 25 nodes 90 time 2 pv e2e4 e7e5');
          say('bestmove e2e4 ponder e7e5');
        };
        if (holdSearches) heldSearches.push(finish);
        else finish();
      }),
    { uciOptions: {}, startupTimeoutMs: 1000 },
  );
}

describe('engine endpoint', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let token: string;
  const previousPath = process.env.ENGINE_PATH;

  beforeAll(async () => {
    // The pool is replaced below, the path only has to be set so that the engine counts as configured
    process.env.ENGINE_PATH = 'fake-engine';
    ({ app, prisma, redis, mail } = await createTestApp((builder) =>
      builder.overrideProvider(ENGINE_POOL).useValue(
        new EnginePool([fakeEngine()], {
          maxQueue: 1,
          defaultTimeoutMs: 1000,
          retryAfterSeconds: 4,
        }),
      ),
    ));
  });

  afterAll(async () => {
    await app.close();
    if (previousPath === undefined) delete process.env.ENGINE_PATH;
    else process.env.ENGINE_PATH = previousPath;
  });

  beforeEach(async () => {
    holdSearches = false;
    heldSearches.length = 0;
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'cat@example.com', password: 'long-enough-password' },
    });
    token = AuthResponseSchema.parse(res.json()).accessToken;
    // The verification email goes out after the answer, let it finish before the next test cleans up
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(0));
  });

  const analyze = (payload: unknown, auth = true) =>
    app.inject({
      method: 'POST',
      url: '/engine/analysis',
      headers: auth ? { authorization: `Bearer ${token}` } : {},
      payload: payload as Record<string, unknown>,
    });

  it('requires a signed-in user', async () => {
    const res = await analyze({ fen: START, depth: 5 }, false);
    expect(res.statusCode).toBe(401);
  });

  it('analyses a position and answers the repeat from the cache', async () => {
    const first = await analyze({ fen: START, depth: 5 });
    expect(first.statusCode).toBe(200);
    expect(EngineAnalysisResponseSchema.parse(first.json())).toMatchObject({
      bestMove: 'e2e4',
      timedOut: false,
      cached: false,
    });

    const second = await analyze({ fen: START, depth: 5 });
    expect(EngineAnalysisResponseSchema.parse(second.json())).toMatchObject({ cached: true });
  });

  it('rejects a bad position and a search deeper than the cap', async () => {
    expect((await analyze({ fen: 'nonsense', depth: 5 })).statusCode).toBe(400);
    expect((await analyze({ fen: START, depth: 99 })).statusCode).toBe(400);
    expect((await analyze({ fen: START, depth: 5, multipv: 9 })).statusCode).toBe(400);
  });

  it('answers 503 with Retry-After when the queue is full', async () => {
    holdSearches = true;
    const running = analyze({ fen: START, depth: 5 });
    // Wait until the engine has taken the first search, so that the next one really queues
    await vi.waitFor(() => expect(heldSearches).toHaveLength(1));
    const queued = analyze({ fen: AFTER_E4, depth: 5 });
    await vi.waitFor(async () => {
      const ready = ReadyResponseSchema.parse((await app.inject({ url: '/ready' })).json());
      expect(ready.engine?.queued).toBe(1);
    });

    const refused = await analyze({ fen: AFTER_D4, depth: 5 });
    expect(refused.statusCode).toBe(503);
    expect(refused.headers['retry-after']).toBe('4');
    expect(refused.json()).toMatchObject({ code: 'server.unavailable' });

    // Searches that start from now on finish by themselves, the held one is let go by hand
    holdSearches = false;
    heldSearches.shift()?.();
    expect((await running).statusCode).toBe(200);
    expect((await queued).statusCode).toBe(200);
  });

  it('limits how often one user may ask', async () => {
    const { limit } = ENGINE_LIMITS.analysisPerUser;
    // The first answer is searched, the rest come from the cache and cost no engine time
    for (let call = 0; call < limit; call += 1) {
      expect((await analyze({ fen: START, depth: 5 })).statusCode).toBe(200);
    }
    const over = await analyze({ fen: START, depth: 5 });
    expect(over.statusCode).toBe(429);
    expect(Number(over.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('reports the queue on /ready', async () => {
    await analyze({ fen: START, depth: 5 });
    const res = await app.inject({ url: '/ready' });
    expect(res.statusCode).toBe(200);
    const { engine } = ReadyResponseSchema.parse(res.json());
    // The pool lives as long as the app, so earlier tests have added to the counters
    expect(engine).toMatchObject({ workers: 1, queued: 0 });
    expect(engine?.completed).toBeGreaterThan(0);
  });
});
