import { legalMoves } from '@kotgambit/chess-core';
import {
  ApiErrorSchema,
  AuthResponseSchema,
  PositionAnalysisSchema,
  ReviewStatusSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import { EngineBusyError, EnginePool } from '../engine/engine-pool.js';
import { ENGINE_POOL } from '../engine/engine.service.js';
import { FakeEngineProcess } from '../engine/fake-engine-process.js';
import { UciEngine } from '../engine/uci-engine.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { ReviewService } from './review.service.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
const ENGINE_CENTIPAWNS = 25;

/** The positions the fake engine was asked about, to see that finished positions never reach it. */
const searched: string[] = [];

/** Answers every search with the first legal moves as lines, all for the side to move at +25. */
function fakeEngine(): UciEngine {
  return new UciEngine(
    () => {
      let fen = START;
      let lines = 1;
      return new FakeEngineProcess((command, say) => {
        if (command === 'uci') say('uciok');
        else if (command === 'isready') say('readyok');
        else if (command.startsWith('setoption name MultiPV value ')) {
          lines = Number(command.split(' ').at(-1));
        } else if (command.startsWith('position fen ')) fen = command.slice('position fen '.length);
        else if (command.startsWith('go ')) {
          searched.push(fen);
          const moves = legalMoves(fen).slice(0, lines);
          if (moves.length === 0) {
            say('bestmove (none)');
            return;
          }
          moves.forEach((move, index) => {
            say(
              `info depth 14 multipv ${index + 1} score cp ${ENGINE_CENTIPAWNS - index * 5} nodes 10 time 1 pv ${move.uci}`,
            );
          });
          say(`bestmove ${moves[0]?.uci}`);
        }
      });
    },
    { uciOptions: {}, startupTimeoutMs: 1000 },
  );
}

describe('analysis', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let pool: EnginePool;
  let reviews: ReviewService;
  let token: string;
  let userId: string;
  const previousPath = process.env.ENGINE_PATH;

  beforeAll(async () => {
    // The pool is replaced below, the path only has to be set so that the engine counts as configured
    process.env.ENGINE_PATH = 'fake-engine';
    pool = new EnginePool([fakeEngine(), fakeEngine()], {
      maxQueue: 10,
      defaultTimeoutMs: 1000,
      retryAfterSeconds: 4,
    });
    ({ app, prisma, redis, mail } = await createTestApp((builder) =>
      builder.overrideProvider(ENGINE_POOL).useValue(pool),
    ));
    reviews = app.get(ReviewService);
    reviews.retryDelayMs = 10;
  });

  afterAll(async () => {
    await app.close();
    if (previousPath === undefined) delete process.env.ENGINE_PATH;
    else process.env.ENGINE_PATH = previousPath;
  });

  async function register(email: string): Promise<{ token: string; id: string }> {
    // Read before the request: the mail can be sent before the answer is back in the test
    const sent = mail.outbox.length;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'long-enough-password' },
    });
    // The verification email goes out after the answer, let it finish before the next test cleans up
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(sent));
    const body = AuthResponseSchema.parse(res.json());
    return { token: body.accessToken, id: body.user.id };
  }

  beforeEach(async () => {
    searched.length = 0;
    vi.restoreAllMocks();
    await reviews.idle();
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
    ({ token, id: userId } = await register('cat@example.com'));
  });

  const call = (method: 'GET' | 'POST', url: string, body?: unknown, as = token) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${as}` },
      ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    });

  const analyze = (fen: string) => call('POST', '/analysis/position', { fen });
  const errorOf = (res: { json(): unknown }) => ApiErrorSchema.parse(res.json());

  describe('a position', () => {
    it('needs a signed-in user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analysis/position',
        payload: { fen: START },
      });
      expect(res.statusCode).toBe(401);
    });

    it('gives the evaluation, the chances, the best move and three lines', async () => {
      const res = await analyze(START);
      expect(res.statusCode, res.body).toBe(200);
      const analysis = PositionAnalysisSchema.parse(res.json());
      expect(analysis).toMatchObject({
        fen: START,
        turn: 'w',
        score: { kind: 'cp', value: ENGINE_CENTIPAWNS },
        leader: 'equal',
        headline: 'Примерно равно',
      });
      expect(analysis.outlook.white + analysis.outlook.draw + analysis.outlook.black).toBe(100);
      expect(analysis.best).toMatchObject({ uci: expect.any(String), san: expect.any(String) });
      expect(analysis.best?.explanation.length).toBeGreaterThan(0);
      expect(analysis.lines).toHaveLength(3);
      expect(analysis.lines[0]?.san).toHaveLength(1);
    });

    it('gives the score for White even when Black is to move', async () => {
      const blackToMove = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const analysis = PositionAnalysisSchema.parse((await analyze(blackToMove)).json());
      expect(analysis).toMatchObject({
        turn: 'b',
        score: { kind: 'cp', value: -ENGINE_CENTIPAWNS },
      });
    });

    it('takes a position without move counters, as the editor builds it', async () => {
      const res = await analyze('4k3/8/8/8/8/8/8/4K3 w');
      expect(res.statusCode, res.body).toBe(200);
      expect(PositionAnalysisSchema.parse(res.json()).fen).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    });

    it('tells what is wrong with a position that cannot be, in the words of the design', async () => {
      const res = await analyze('8/8/8/8/8/8/8/4K3 w - - 0 1');
      expect(res.statusCode).toBe(422);
      expect(errorOf(res)).toMatchObject({
        code: 'analysis.invalid_position',
        message:
          'У чёрных нет короля. Поставь чёрного короля, например на e8, и анализ заработает.',
        details: { problem: 'no-king', color: 'b' },
      });
      expect(searched).toEqual([]);
    });

    it('does not ask the engine about a game that is over', async () => {
      const mate = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const analysis = PositionAnalysisSchema.parse((await analyze(mate)).json());
      expect(analysis).toMatchObject({ headline: 'Мат', leader: 'black', best: null, lines: [] });
      expect(searched).toEqual([]);
    });

    it('answers 503 with Retry-After when the engine is busy', async () => {
      vi.spyOn(pool, 'analyze').mockRejectedValueOnce(new EngineBusyError(4));
      const res = await analyze(START);
      expect(res.statusCode).toBe(503);
      expect(res.headers['retry-after']).toBe('4');
    });
  });

  describe('the review of a game', () => {
    async function finishedGame(moves = FOOLS_MATE, owner = userId) {
      return prisma.game.create({
        data: {
          userId: owner,
          botId: 'alisa',
          userColor: 'w',
          status: 'finished',
          moves,
          outcome: 'loss',
          endReason: 'checkmate',
          xp: 10,
          finishedAt: new Date(),
        },
      });
    }

    const start = async (id: string, as = token) =>
      call('POST', `/games/${id}/review`, undefined, as);
    const read = async (id: string, as = token) =>
      ReviewStatusSchema.parse((await call('GET', `/games/${id}/review`, undefined, as)).json());

    it('is not there before it is asked for', async () => {
      const game = await finishedGame();
      const res = await call('GET', `/games/${game.id}/review`);
      expect(res.statusCode).toBe(404);
      expect(errorOf(res).code).toBe('review.not_found');
    });

    it('waits for the game to end', async () => {
      const game = await prisma.game.create({ data: { userId, botId: 'alisa', userColor: 'w' } });
      const res = await start(game.id);
      expect(res.statusCode).toBe(409);
      expect(errorOf(res).code).toBe('review.not_ready');
    });

    it('looks at every position in the background and gives the review', async () => {
      const game = await finishedGame();
      const started = ReviewStatusSchema.parse((await start(game.id)).json());
      expect(started.total).toBe(FOOLS_MATE.length + 1);
      expect(['pending', 'running', 'done']).toContain(started.status);

      await vi.waitFor(async () => expect((await read(game.id)).status).toBe('done'));
      const done = await read(game.id);
      expect(done).toMatchObject({ done: 5, total: 5 });
      const review = done.review;
      if (!review) throw new Error('no review');
      expect(review.chances).toHaveLength(5);
      // White is mated, so the last position is a lost one for White
      expect(review.chances.at(-1)).toBe(0);
      expect(review.qualities).toHaveLength(4);
      expect(review.accuracy.player).not.toBeNull();
      // The mate position is not searched: the engine has nothing to say there
      expect(searched).toHaveLength(4);
    });

    it('answers the same way when it is asked for twice', async () => {
      const game = await finishedGame();
      await start(game.id);
      await vi.waitFor(async () => expect((await read(game.id)).status).toBe('done'));
      const searches = searched.length;
      const again = ReviewStatusSchema.parse((await start(game.id)).json());
      expect(again.status).toBe('done');
      expect(searched.length).toBe(searches);
    });

    it('keeps reviews to the owner of the game', async () => {
      const game = await finishedGame();
      const other = await register('other@example.com');
      expect((await start(game.id, other.token)).statusCode).toBe(404);
      expect(
        (await call('GET', `/games/${game.id}/review`, undefined, other.token)).statusCode,
      ).toBe(404);
    });

    it('waits out a busy engine instead of failing', async () => {
      const game = await finishedGame();
      vi.spyOn(pool, 'analyze').mockRejectedValueOnce(new EngineBusyError(1));
      await start(game.id);
      await vi.waitFor(async () => expect((await read(game.id)).status).toBe('done'));
    });

    it('marks the review as failed when the engine never comes back, and can be started again', async () => {
      const game = await finishedGame();
      const spy = vi.spyOn(pool, 'analyze').mockRejectedValue(new Error('the engine is gone'));
      await start(game.id);
      await vi.waitFor(async () => expect((await read(game.id)).status).toBe('failed'));

      spy.mockRestore();
      await start(game.id);
      await vi.waitFor(async () => expect((await read(game.id)).status).toBe('done'));
    });

    it('is deleted with the game', async () => {
      const game = await finishedGame();
      await start(game.id);
      await vi.waitFor(async () => expect((await read(game.id)).status).toBe('done'));
      await prisma.game.delete({ where: { id: game.id } });
      expect(await prisma.gameReview.count()).toBe(0);
    });
  });
});
