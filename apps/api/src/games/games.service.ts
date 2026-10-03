import { applyMove, playGame, type GameStatus } from '@kotgambit/chess-core';
import type {
  ActiveGame,
  CreateGameRequest,
  Game,
  GameEndReason,
  GameHintResponse,
  GameMoveResponse,
  GameOutcome,
} from '@kotgambit/contracts';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { isEngineFailure } from '../engine/engine-errors.js';
import { Priority } from '../engine/engine-pool.js';
import { EngineService } from '../engine/engine.service.js';
import type { Game as GameRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { dayKeyOf } from '../progress/streak.js';
import { pickBotMove } from './bot-move.js';
import { BotsService } from './bots.service.js';
import {
  GAME_XP,
  HINTS_PER_GAME,
  HINT_DEPTH,
  MAX_ACTIVE_GAMES,
  MAX_GAME_SECONDS,
} from './games.limits.js';

type Color = 'w' | 'b';

interface Ending {
  outcome: GameOutcome;
  reason: GameEndReason;
}

function endingOf(status: GameStatus, userColor: Color): Ending | null {
  if (status.kind === 'checkmate') {
    return { outcome: status.winner === userColor ? 'win' : 'loss', reason: 'checkmate' };
  }
  if (status.kind === 'draw') return { outcome: 'draw', reason: status.reason };
  return null;
}

/** How many plies of a game with `plies` plies the learner has played. */
function learnerPlies(userColor: Color, plies: number): number {
  return userColor === 'w' ? Math.ceil(plies / 2) : Math.floor(plies / 2);
}

function sideToMove(fen: string): Color {
  return fen.split(' ')[1] as Color;
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bots: BotsService,
    private readonly engine: EngineService,
    private readonly progress: ProgressService,
  ) {}

  async create(userId: string, request: CreateGameRequest): Promise<Game> {
    if (!this.bots.get(request.botId)) throw new AppError('game.bot_unknown', HttpStatus.NOT_FOUND);
    const open = await this.prisma.game.count({ where: { userId, status: 'active' } });
    if (open >= MAX_ACTIVE_GAMES) throw new AppError('game.too_many_active', HttpStatus.CONFLICT);

    const userColor: Color =
      request.color === 'random' ? (randomInt(2) === 0 ? 'w' : 'b') : request.color;
    let row = await this.prisma.game.create({
      data: { userId, botId: request.botId, userColor, learning: request.learning ?? true },
    });
    // The bot opens when the learner plays black. If the engine is busy the game still exists
    // and the client asks for the bot's move again, so a busy server does not lose the game.
    if (userColor === 'b') row = await this.botMoveOrWait(row);
    return this.view(row);
  }

  async active(userId: string): Promise<ActiveGame> {
    const row = await this.prisma.game.findFirst({
      where: { userId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    return { game: row ? this.view(row) : null };
  }

  async get(userId: string, id: string): Promise<Game> {
    return this.view(await this.load(userId, id));
  }

  async move(userId: string, id: string, uci: string): Promise<GameMoveResponse> {
    const row = await this.load(userId, id);
    this.assertActive(row);
    const played = this.replay(row);
    if (sideToMove(played.fen) !== row.userColor) {
      throw new AppError('game.not_your_turn', HttpStatus.CONFLICT);
    }
    if (!applyMove(played.fen, uci).ok) return { result: 'illegal' };

    const moves = [...row.moves, uci];
    const ending = endingOf(this.replay({ ...row, moves }).status, row.userColor as Color);
    const saved = await this.commit(row, moves, ending);
    // Two moves for one position at once: the second one finds the board changed
    if (!saved) throw new AppError('game.not_your_turn', HttpStatus.CONFLICT);

    const answered = saved.status === 'active' ? await this.botMoveOrWait(saved) : saved;
    return this.moveResponse(answered, saved.moves.length);
  }

  /** The bot's move when it did not come the first time, for a busy engine. */
  async botMove(userId: string, id: string): Promise<GameMoveResponse> {
    const row = await this.load(userId, id);
    this.assertActive(row);
    if (sideToMove(this.replay(row).fen) === row.userColor) {
      throw new AppError('game.not_your_turn', HttpStatus.CONFLICT);
    }
    // Engine failures are not caught here: the controller turns them into 503 with Retry-After
    const answered = await this.playBotMove(row);
    return this.moveResponse(answered, row.moves.length);
  }

  async resign(userId: string, id: string): Promise<Game> {
    const row = await this.load(userId, id);
    this.assertActive(row);
    const saved = await this.commit(row, row.moves, { outcome: 'loss', reason: 'resignation' });
    return saved ? this.view(saved) : this.get(userId, id);
  }

  async undo(userId: string, id: string): Promise<Game> {
    const row = await this.load(userId, id);
    this.assertActive(row);
    if (!row.learning) throw new AppError('game.learning_only', HttpStatus.CONFLICT);
    if (learnerPlies(row.userColor as Color, row.moves.length) === 0) {
      throw new AppError('game.nothing_to_undo', HttpStatus.CONFLICT);
    }

    // When the bot has not answered yet, only the learner's move is there to take back
    const botToMove = sideToMove(this.replay(row).fen) !== row.userColor;
    const moves = row.moves.slice(0, botToMove ? -1 : -2);
    const { count } = await this.prisma.game.updateMany({
      where: { id, status: 'active', moves: { equals: row.moves } },
      data: { moves },
    });
    if (count === 0) throw new AppError('game.not_your_turn', HttpStatus.CONFLICT);
    return this.get(userId, id);
  }

  async hint(userId: string, id: string): Promise<GameHintResponse> {
    const row = await this.load(userId, id);
    this.assertActive(row);
    if (!row.learning) throw new AppError('game.learning_only', HttpStatus.CONFLICT);
    const fen = this.replay(row).fen;
    if (sideToMove(fen) !== row.userColor) {
      throw new AppError('game.not_your_turn', HttpStatus.CONFLICT);
    }
    if (row.hintsUsed >= HINTS_PER_GAME) throw new AppError('game.hints_over', HttpStatus.CONFLICT);

    const analysis = await this.engine.analyze({
      fen,
      depth: HINT_DEPTH,
      multipv: 1,
      priority: Priority.Analysis,
    });
    if (!analysis.bestMove) throw new Error(`The engine gave no hint for game ${id}`);

    // Counted after the answer, so that a busy engine does not use up a hint
    const { count } = await this.prisma.game.updateMany({
      where: { id, hintsUsed: { lt: HINTS_PER_GAME } },
      data: { hintsUsed: { increment: 1 } },
    });
    if (count === 0) throw new AppError('game.hints_over', HttpStatus.CONFLICT);
    return { move: analysis.bestMove, hintsLeft: HINTS_PER_GAME - row.hintsUsed - 1 };
  }

  private async botMoveOrWait(row: GameRow): Promise<GameRow> {
    try {
      return await this.playBotMove(row);
    } catch (error) {
      if (!isEngineFailure(error)) throw error;
      this.logger.warn(`The bot could not move in game ${row.id}, the client will ask again`);
      return row;
    }
  }

  private async playBotMove(row: GameRow): Promise<GameRow> {
    const bot = this.bots.get(row.botId);
    if (!bot) throw new Error(`Game ${row.id} has an unknown bot ${row.botId}`);
    const fen = this.replay(row).fen;
    const { skillLevel, elo, depth, movetimeMs, candidates } = bot.strength;

    const analysis = await this.engine.botMove({
      fen,
      strength: {
        ...(skillLevel === undefined ? {} : { skillLevel }),
        ...(elo === undefined ? {} : { elo }),
      },
      ...(depth === undefined ? {} : { depth }),
      movetimeMs,
      candidates,
    });
    const uci = pickBotMove(analysis, bot.strength, Math.random);
    if (!uci || !applyMove(fen, uci).ok) {
      throw new Error(`The engine gave no legal move in game ${row.id}`);
    }

    const moves = [...row.moves, uci];
    const ending = endingOf(this.replay({ ...row, moves }).status, row.userColor as Color);
    const saved = await this.commit(row, moves, ending);
    // A repeated request got there first, what it saved is the truth
    return saved ?? this.prisma.game.findUniqueOrThrow({ where: { id: row.id } });
  }

  /**
   * Saves the moves, and when the game is over its result and the XP, in one step. Returns `null`
   * when the game is no longer as the caller read it: a second request got there first.
   */
  private async commit(
    row: GameRow,
    moves: string[],
    ending: Ending | null,
  ): Promise<GameRow | null> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const xp = ending ? GAME_XP[ending.outcome] : 0;
      const { count } = await tx.game.updateMany({
        where: { id: row.id, status: 'active', moves: { equals: row.moves } },
        data: {
          moves,
          ...(ending
            ? {
                status: 'finished' as const,
                outcome: ending.outcome,
                endReason: ending.reason,
                xp,
                finishedAt: now,
              }
            : {}),
        },
      });
      if (count === 0) return null;
      if (ending) {
        const elapsed = Math.round((now.getTime() - row.startedAt.getTime()) / 1000);
        const seconds = Math.min(MAX_GAME_SECONDS, elapsed);
        await this.progress.addActivity(tx, row.userId, dayKeyOf(now), seconds, xp);
      }
      return tx.game.findUniqueOrThrow({ where: { id: row.id } });
    });
  }

  private async load(userId: string, id: string): Promise<GameRow> {
    const row = await this.prisma.game.findFirst({ where: { id, userId } });
    if (!row) throw new AppError('game.not_found', HttpStatus.NOT_FOUND);
    return row;
  }

  private assertActive(row: GameRow): void {
    if (row.status !== 'active') throw new AppError('game.finished', HttpStatus.CONFLICT);
  }

  private replay(row: Pick<GameRow, 'id' | 'moves'>) {
    const played = playGame(row.moves);
    // Moves are checked before they are saved, so this would be a corrupted row
    if (!played) throw new Error(`Game ${row.id} has a move that is not legal`);
    return played;
  }

  private moveResponse(row: GameRow, movesBefore: number): GameMoveResponse {
    const game = this.view(row);
    return { result: 'ok', game, botMove: game.moves[movesBefore] ?? null };
  }

  private view(row: GameRow): Game {
    const played = this.replay(row);
    const finished = row.status === 'finished' && row.outcome !== null && row.endReason !== null;
    return {
      id: row.id,
      botId: row.botId,
      userColor: row.userColor as Color,
      learning: row.learning,
      status: row.status,
      fen: played.fen,
      turn: sideToMove(played.fen),
      moves: played.moves.map(({ uci, san }) => ({ uci, san })),
      inCheck: played.status.kind === 'playing' && played.status.inCheck,
      hintsLeft: row.learning ? Math.max(0, HINTS_PER_GAME - row.hintsUsed) : 0,
      result: finished
        ? {
            outcome: row.outcome as GameOutcome,
            reason: row.endReason as GameEndReason,
            xp: row.xp,
          }
        : null,
    };
  }
}
