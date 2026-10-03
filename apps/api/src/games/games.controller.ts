import {
  CreateGameRequestSchema,
  GameMoveRequestSchema,
  type ActiveGame,
  type BotList,
  type CreateGameRequest,
  type Game,
  type GameHintResponse,
  type GameMoveResponse,
} from '@kotgambit/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { toHttpError } from '../engine/engine-errors.js';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { BotsService } from './bots.service.js';
import { GAME_LIMITS } from './games.limits.js';
import { GamesService } from './games.service.js';

type MoveBody = z.output<typeof GameMoveRequestSchema>;

const GameIdSchema = z.uuid();
const gameId = () => new ZodValidationPipe(GameIdSchema);

@Controller()
@UseGuards(AccessTokenGuard, RateLimitGuard)
export class GamesController {
  private readonly logger = new Logger(GamesController.name);

  constructor(
    private readonly games: GamesService,
    private readonly bots: BotsService,
  ) {}

  @Get('bots')
  listBots(): BotList {
    return { bots: this.bots.profiles() };
  }

  @Post('games')
  @RateLimit(GAME_LIMITS.createPerUser)
  create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(CreateGameRequestSchema)) body: CreateGameRequest,
  ): Promise<Game> {
    return this.games.create(userId, body);
  }

  @Get('games/active')
  active(@CurrentUserId() userId: string): Promise<ActiveGame> {
    return this.games.active(userId);
  }

  @Get('games/:id')
  get(@CurrentUserId() userId: string, @Param('id', gameId()) id: string): Promise<Game> {
    return this.games.get(userId, id);
  }

  @Post('games/:id/moves')
  @HttpCode(HttpStatus.OK)
  @RateLimit(GAME_LIMITS.movePerUser)
  move(
    @CurrentUserId() userId: string,
    @Param('id', gameId()) id: string,
    @Body(new ZodValidationPipe(GameMoveRequestSchema)) body: MoveBody,
  ): Promise<GameMoveResponse> {
    return this.games.move(userId, id, body.move);
  }

  @Post('games/:id/bot-move')
  @HttpCode(HttpStatus.OK)
  @RateLimit(GAME_LIMITS.movePerUser)
  async botMove(
    @CurrentUserId() userId: string,
    @Param('id', gameId()) id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<GameMoveResponse> {
    try {
      return await this.games.botMove(userId, id);
    } catch (error) {
      throw toHttpError(error, reply, this.logger);
    }
  }

  @Post('games/:id/hint')
  @HttpCode(HttpStatus.OK)
  @RateLimit(GAME_LIMITS.hintPerUser)
  async hint(
    @CurrentUserId() userId: string,
    @Param('id', gameId()) id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<GameHintResponse> {
    try {
      return await this.games.hint(userId, id);
    } catch (error) {
      throw toHttpError(error, reply, this.logger);
    }
  }

  @Post('games/:id/undo')
  @HttpCode(HttpStatus.OK)
  @RateLimit(GAME_LIMITS.movePerUser)
  undo(@CurrentUserId() userId: string, @Param('id', gameId()) id: string): Promise<Game> {
    return this.games.undo(userId, id);
  }

  @Post('games/:id/resign')
  @HttpCode(HttpStatus.OK)
  @RateLimit(GAME_LIMITS.movePerUser)
  resign(@CurrentUserId() userId: string, @Param('id', gameId()) id: string): Promise<Game> {
    return this.games.resign(userId, id);
  }
}
