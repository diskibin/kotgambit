import { legalMoves } from '@kotgambit/chess-core';
import {
  ActiveGameSchema,
  ApiErrorSchema,
  AuthResponseSchema,
  BotListSchema,
  GameHintResponseSchema,
  GameMoveResponseSchema,
  GameSchema,
  type Game,
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
import { dayKeyOf } from '../progress/streak.js';
import type { RedisService } from '../redis/redis.service.js';
import { GAME_XP, HINTS_PER_GAME, MAX_ACTIVE_GAMES } from './games.limits.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Moves the fake bot plays next, one by one. When the list is empty it plays the first legal move. */
let botScript: string[] = [];
/** The positions the fake engine was asked about and the options it was given, in order. */
const engineLog: string[] = [];

function fakeEngine(): UciEngine {
  return new UciEngine(
    () => {
      let fen = START;
      return new FakeEngineProcess((command, say) => {
        engineLog.push(command);
        if (command === 'uci') say('uciok');
        else if (command === 'isready') say('readyok');
        else if (command.startsWith('position fen ')) fen = command.slice('position fen '.length);
        else if (command.startsWith('go ')) {
          const move = botScript.shift() ?? legalMoves(fen)[0]?.uci;
          if (!move) {
            say('bestmove (none)');
            return;
          }
          say(`info depth 1 multipv 1 score cp 10 nodes 10 time 1 pv ${move}`);
          say(`bestmove ${move}`);
        }
      });
    },
    { uciOptions: {}, startupTimeoutMs: 1000 },
  );
}

describe('games', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let pool: EnginePool;
  let token: string;
  const previousPath = process.env.ENGINE_PATH;

  beforeAll(async () => {
    // The pool is replaced below, the path only has to be set so that the engine counts as configured
    process.env.ENGINE_PATH = 'fake-engine';
    pool = new EnginePool([fakeEngine(), fakeEngine()], {
      maxQueue: 5,
      defaultTimeoutMs: 1000,
      retryAfterSeconds: 4,
    });
    ({ app, prisma, redis, mail } = await createTestApp((builder) =>
      builder.overrideProvider(ENGINE_POOL).useValue(pool),
    ));
  });

  afterAll(async () => {
    await app.close();
    if (previousPath === undefined) delete process.env.ENGINE_PATH;
    else process.env.ENGINE_PATH = previousPath;
  });

  async function register(email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'long-enough-password' },
    });
    // The verification email goes out after the answer, let it finish before the next test cleans up
    const sent = mail.outbox.length;
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(sent));
    return AuthResponseSchema.parse(res.json()).accessToken;
  }

  beforeEach(async () => {
    botScript = [];
    engineLog.length = 0;
    vi.restoreAllMocks();
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
    token = await register('cat@example.com');
  });

  const call = (method: 'GET' | 'POST', url: string, body?: unknown, as = token) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${as}` },
      ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    });

  const create = async (body: Record<string, unknown> = {}, as = token): Promise<Game> => {
    const res = await call('POST', '/games', { botId: 'alisa', color: 'w', ...body }, as);
    expect(res.statusCode, res.body).toBe(201);
    return GameSchema.parse(res.json());
  };

  const play = (id: string, move: string, as = token) =>
    call('POST', `/games/${id}/moves`, { move }, as);

  const errorCode = (res: { json(): unknown }) => ApiErrorSchema.parse(res.json()).code;

  it('needs a signed-in user', async () => {
    expect((await app.inject({ method: 'GET', url: '/bots' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/games', payload: {} })).statusCode).toBe(401);
  });

  describe('bots', () => {
    it('lists the six bots from the weakest, without their strength settings', async () => {
      const res = await call('GET', '/bots');
      const { bots } = BotListSchema.parse(res.json());
      expect(bots.map((bot) => bot.level)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(bots[2]).toMatchObject({ id: 'alisa', kind: 'fox', name: 'Лиса Алиса' });
      expect(res.body).not.toMatch(/strength|elo|skillLevel|mistakeChance/i);
    });
  });

  describe('starting a game', () => {
    it('starts at the initial position with the learner to move', async () => {
      const game = await create({ color: 'w' });
      expect(game).toMatchObject({
        botId: 'alisa',
        userColor: 'w',
        learning: true,
        status: 'active',
        fen: START,
        turn: 'w',
        moves: [],
        hintsLeft: HINTS_PER_GAME,
        result: null,
      });
    });

    it('lets the bot open when the learner plays black', async () => {
      const game = await create({ color: 'b' });
      expect(game.moves).toHaveLength(1);
      expect(game.turn).toBe('b');
    });

    it('picks a color when asked to', async () => {
      const game = await create({ color: 'random' });
      expect(['w', 'b']).toContain(game.userColor);
      expect(game.turn).toBe('w' === game.userColor ? 'w' : 'b');
    });

    it('turns the learning mode off on request', async () => {
      const game = await create({ learning: false });
      expect(game).toMatchObject({ learning: false, hintsLeft: 0 });
    });

    it('does not know a bot that is not in the list', async () => {
      const res = await call('POST', '/games', { botId: 'dragon', color: 'w' });
      expect(res.statusCode).toBe(404);
      expect(errorCode(res)).toBe('game.bot_unknown');
    });

    it('limits the games open at once', async () => {
      for (let i = 0; i < MAX_ACTIVE_GAMES; i += 1) await create();
      const res = await call('POST', '/games', { botId: 'alisa', color: 'w' });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('game.too_many_active');
    });

    it('asks the engine to play at the strength of the bot', async () => {
      await create({ botId: 'misha', color: 'b' });
      expect(engineLog).toContain('setoption name Skill Level value 0');
      expect(engineLog.some((line) => line.startsWith('go depth 1 movetime 100'))).toBe(true);

      await create({ botId: 'alisa', color: 'b' });
      expect(engineLog).toContain('setoption name UCI_Elo value 1350');
    });
  });

  describe('playing', () => {
    it('answers a move with the bot’s move', async () => {
      const game = await create();
      botScript = ['e7e5'];
      const res = await play(game.id, 'e2e4');
      expect(res.statusCode).toBe(200);
      const body = GameMoveResponseSchema.parse(res.json());
      expect(body).toMatchObject({ result: 'ok', botMove: { uci: 'e7e5', san: 'e5' } });
      if (body.result !== 'ok') throw new Error('unreachable');
      expect(body.game.moves.map((move) => move.san)).toEqual(['e4', 'e5']);
      expect(body.game.turn).toBe('w');
    });

    it('does not change the game for a move that is not legal', async () => {
      const game = await create();
      const res = await play(game.id, 'e2e5');
      expect(GameMoveResponseSchema.parse(res.json())).toEqual({ result: 'illegal' });
      const after = GameSchema.parse((await call('GET', `/games/${game.id}`)).json());
      expect(after.moves).toEqual([]);
    });

    it('takes a promotion', async () => {
      const game = await create();
      // A line that brings a pawn to the last rank: the bot always answers with the next scripted move
      const line: [string, string][] = [
        ['a2a4', 'b7b5'],
        ['a4b5', 'a7a6'],
        ['b5a6', 'g8f6'],
        ['a6a7', 'f6g8'],
      ];
      for (const [mine, theirs] of line) {
        botScript = [theirs];
        expect((await play(game.id, mine)).statusCode).toBe(200);
      }
      botScript = ['g8f6'];
      const noPromotion = await play(game.id, 'a7b8');
      expect(GameMoveResponseSchema.parse(noPromotion.json())).toEqual({ result: 'illegal' });
      const promoted = await play(game.id, 'a7b8q');
      expect(GameMoveResponseSchema.parse(promoted.json())).toMatchObject({ result: 'ok' });
    });

    it('does not accept a move of the other side', async () => {
      const game = await create({ color: 'b' });
      botScript = [];
      const res = await play(game.id, 'e2e4');
      // The learner plays black, so a white pawn move is not legal for them
      expect(GameMoveResponseSchema.parse(res.json())).toEqual({ result: 'illegal' });
    });

    it('keeps games to their owner', async () => {
      const game = await create();
      const other = await register('other@example.com');
      const res = await call('GET', `/games/${game.id}`, undefined, other);
      expect(res.statusCode).toBe(404);
      expect(errorCode(res)).toBe('game.not_found');
      expect((await play(game.id, 'e2e4', other)).statusCode).toBe(404);
    });

    it('gives the game that is still open', async () => {
      expect(ActiveGameSchema.parse((await call('GET', '/games/active')).json())).toEqual({
        game: null,
      });
      const game = await create();
      const active = ActiveGameSchema.parse((await call('GET', '/games/active')).json());
      expect(active.game?.id).toBe(game.id);
    });
  });

  describe('the end of a game', () => {
    // Fool's mate with the learner on the black side
    async function foolsMate(): Promise<Game> {
      botScript = ['f2f3'];
      const game = await create({ color: 'b' });
      botScript = ['g2g4'];
      await play(game.id, 'e7e5');
      const res = await play(game.id, 'd8h4');
      const body = GameMoveResponseSchema.parse(res.json());
      if (body.result !== 'ok') throw new Error('the mate was not accepted');
      return body.game;
    }

    it('records a win by checkmate and gives the XP', async () => {
      const game = await foolsMate();
      expect(game.status).toBe('finished');
      expect(game.result).toEqual({ outcome: 'win', reason: 'checkmate', xp: GAME_XP.win });
      const day = await prisma.dailyActivity.findFirstOrThrow({});
      expect(day.xp).toBe(GAME_XP.win);
      expect(dayKeyOf(day.day)).toBe(dayKeyOf(new Date()));
    });

    it('records a loss by checkmate', async () => {
      const game = await create();
      const mate = ['f2f3', 'g2g4'];
      const replies = ['e7e5', 'd8h4'];
      let last: Game = game;
      for (const [index, move] of mate.entries()) {
        botScript = [replies[index] as string];
        const body = GameMoveResponseSchema.parse((await play(game.id, move)).json());
        if (body.result === 'ok') last = body.game;
      }
      expect(last.result).toEqual({ outcome: 'loss', reason: 'checkmate', xp: GAME_XP.loss });
    });

    it('takes no more moves after the end', async () => {
      const game = await foolsMate();
      const res = await play(game.id, 'a7a6');
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('game.finished');
      expect(ActiveGameSchema.parse((await call('GET', '/games/active')).json()).game).toBeNull();
    });

    it('counts a resignation as a loss that still brings XP', async () => {
      const game = await create();
      const res = await call('POST', `/games/${game.id}/resign`);
      expect(res.statusCode).toBe(200);
      expect(GameSchema.parse(res.json()).result).toEqual({
        outcome: 'loss',
        reason: 'resignation',
        xp: GAME_XP.loss,
      });
      expect(errorCode(await call('POST', `/games/${game.id}/resign`))).toBe('game.finished');
    });

    it('gives the XP once even when the end is reported twice', async () => {
      const game = await create();
      await Promise.all([
        call('POST', `/games/${game.id}/resign`),
        call('POST', `/games/${game.id}/resign`),
      ]);
      const days = await prisma.dailyActivity.findMany();
      expect(days.reduce((sum, day) => sum + day.xp, 0)).toBe(GAME_XP.loss);
    });
  });

  describe('learning mode', () => {
    it('takes back the learner’s move and the bot’s answer', async () => {
      const game = await create();
      await play(game.id, 'e2e4');
      const res = await call('POST', `/games/${game.id}/undo`);
      expect(res.statusCode).toBe(200);
      expect(GameSchema.parse(res.json())).toMatchObject({ moves: [], fen: START, turn: 'w' });
    });

    it('keeps the bot’s opening when the learner plays black', async () => {
      const game = await create({ color: 'b' });
      await play(game.id, 'e7e5');
      const undone = GameSchema.parse((await call('POST', `/games/${game.id}/undo`)).json());
      expect(undone.moves).toHaveLength(1);
      const again = await call('POST', `/games/${game.id}/undo`);
      expect(again.statusCode).toBe(409);
      expect(errorCode(again)).toBe('game.nothing_to_undo');
    });

    it('has nothing to take back at the start', async () => {
      const game = await create();
      expect(errorCode(await call('POST', `/games/${game.id}/undo`))).toBe('game.nothing_to_undo');
    });

    it('gives a limited number of hints', async () => {
      const game = await create();
      for (let left = HINTS_PER_GAME - 1; left >= 0; left -= 1) {
        const res = await call('POST', `/games/${game.id}/hint`);
        expect(res.statusCode, res.body).toBe(200);
        expect(GameHintResponseSchema.parse(res.json())).toMatchObject({ hintsLeft: left });
      }
      const over = await call('POST', `/games/${game.id}/hint`);
      expect(over.statusCode).toBe(409);
      expect(errorCode(over)).toBe('game.hints_over');
    });

    it('does not use up a hint when the engine is busy', async () => {
      const game = await create();
      vi.spyOn(pool, 'analyze').mockRejectedValueOnce(new EngineBusyError(4));
      const busy = await call('POST', `/games/${game.id}/hint`);
      expect(busy.statusCode).toBe(503);
      expect(busy.headers['retry-after']).toBe('4');
      const after = GameSchema.parse((await call('GET', `/games/${game.id}`)).json());
      expect(after.hintsLeft).toBe(HINTS_PER_GAME);
    });

    it('is closed for a game without it', async () => {
      const game = await create({ learning: false });
      for (const action of ['hint', 'undo']) {
        const res = await call('POST', `/games/${game.id}/${action}`);
        expect(res.statusCode).toBe(409);
        expect(errorCode(res)).toBe('game.learning_only');
      }
    });
  });

  describe('a busy engine', () => {
    it('keeps the learner’s move and lets the client ask for the answer again', async () => {
      const game = await create();
      vi.spyOn(pool, 'analyze').mockRejectedValueOnce(new EngineBusyError(4));
      const res = await play(game.id, 'e2e4');
      expect(res.statusCode).toBe(200);
      const body = GameMoveResponseSchema.parse(res.json());
      if (body.result !== 'ok') throw new Error('the move was not accepted');
      expect(body.botMove).toBeNull();
      expect(body.game).toMatchObject({ turn: 'b', status: 'active' });
      expect(body.game.moves.map((move) => move.uci)).toEqual(['e2e4']);

      botScript = ['c7c5'];
      const retry = await call('POST', `/games/${game.id}/bot-move`);
      expect(retry.statusCode).toBe(200);
      expect(GameMoveResponseSchema.parse(retry.json())).toMatchObject({
        result: 'ok',
        botMove: { uci: 'c7c5' },
      });
    });

    it('answers 503 with Retry-After while the engine is still busy', async () => {
      const game = await create();
      vi.spyOn(pool, 'analyze').mockRejectedValue(new EngineBusyError(4));
      await play(game.id, 'e2e4');
      const res = await call('POST', `/games/${game.id}/bot-move`);
      expect(res.statusCode).toBe(503);
      expect(res.headers['retry-after']).toBe('4');
      expect(errorCode(res)).toBe('server.unavailable');
    });

    it('keeps a game that was started as black when the opening move is missing', async () => {
      vi.spyOn(pool, 'analyze').mockRejectedValueOnce(new EngineBusyError(4));
      const game = await create({ color: 'b' });
      expect(game).toMatchObject({ moves: [], turn: 'w', status: 'active' });
      const res = await call('POST', `/games/${game.id}/bot-move`);
      expect(GameMoveResponseSchema.parse(res.json())).toMatchObject({ result: 'ok' });
    });

    it('does not ask for the bot’s move when it is the learner’s turn', async () => {
      const game = await create();
      const res = await call('POST', `/games/${game.id}/bot-move`);
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('game.not_your_turn');
    });
  });
});
