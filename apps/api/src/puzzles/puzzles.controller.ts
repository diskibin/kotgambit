import {
  NextPuzzleRequestSchema,
  PuzzleMoveRequestSchema,
  type Puzzle,
  type PuzzleGiveUpResponse,
  type PuzzleHintResponse,
  type PuzzleMoveResponse,
  type PuzzleStats,
  type PuzzleThemeList,
} from '@kotgambit/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { PUZZLE_LIMITS } from './puzzles.limits.js';
import { PuzzlesService } from './puzzles.service.js';

type NextBody = z.input<typeof NextPuzzleRequestSchema>;
type MoveBody = z.output<typeof PuzzleMoveRequestSchema>;

const AttemptIdSchema = z.uuid();

@Controller('puzzles')
@UseGuards(AccessTokenGuard, RateLimitGuard)
export class PuzzlesController {
  constructor(private readonly puzzles: PuzzlesService) {}

  @Post('next')
  @HttpCode(HttpStatus.OK)
  @RateLimit(PUZZLE_LIMITS.nextPerUser)
  next(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(NextPuzzleRequestSchema)) body: NextBody,
  ): Promise<Puzzle> {
    return this.puzzles.next(userId, body);
  }

  @Post('attempts/:id/move')
  @HttpCode(HttpStatus.OK)
  @RateLimit(PUZZLE_LIMITS.movePerUser)
  move(
    @CurrentUserId() userId: string,
    @Param('id', new ZodValidationPipe(AttemptIdSchema)) id: string,
    @Body(new ZodValidationPipe(PuzzleMoveRequestSchema)) body: MoveBody,
  ): Promise<PuzzleMoveResponse> {
    return this.puzzles.move(userId, id, body.move);
  }

  @Post('attempts/:id/hint')
  @HttpCode(HttpStatus.OK)
  @RateLimit(PUZZLE_LIMITS.hintPerUser)
  hint(
    @CurrentUserId() userId: string,
    @Param('id', new ZodValidationPipe(AttemptIdSchema)) id: string,
  ): Promise<PuzzleHintResponse> {
    return this.puzzles.hint(userId, id);
  }

  @Post('attempts/:id/give-up')
  @HttpCode(HttpStatus.OK)
  @RateLimit(PUZZLE_LIMITS.hintPerUser)
  giveUp(
    @CurrentUserId() userId: string,
    @Param('id', new ZodValidationPipe(AttemptIdSchema)) id: string,
  ): Promise<PuzzleGiveUpResponse> {
    return this.puzzles.giveUp(userId, id);
  }

  @Get('stats')
  stats(@CurrentUserId() userId: string): Promise<PuzzleStats> {
    return this.puzzles.stats(userId);
  }

  @Get('themes')
  themes(): Promise<PuzzleThemeList> {
    return this.puzzles.themeList();
  }
}
