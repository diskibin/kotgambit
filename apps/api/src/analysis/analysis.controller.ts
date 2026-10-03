import {
  PositionAnalysisRequestSchema,
  type PositionAnalysis,
  type ReviewStatus,
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
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { AnalysisService } from './analysis.service.js';
import { ANALYSIS_LIMITS } from './analysis.limits.js';
import { ReviewService } from './review.service.js';

type PositionBody = z.output<typeof PositionAnalysisRequestSchema>;

const gameId = () => new ZodValidationPipe(z.uuid());

@Controller()
@UseGuards(AccessTokenGuard, RateLimitGuard)
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  constructor(
    private readonly analysis: AnalysisService,
    private readonly reviews: ReviewService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Post('analysis/position')
  @HttpCode(HttpStatus.OK)
  @RateLimit(ANALYSIS_LIMITS.positionPerUser)
  async position(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(PositionAnalysisRequestSchema)) body: PositionBody,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<PositionAnalysis> {
    await this.entitlements.assertAnalysisAllowed(userId);
    try {
      const result = await this.analysis.analyzePosition(body.fen);
      // Counted after the answer, so that a busy engine or a refused position does not use up the day
      await this.entitlements.recordAnalysis(userId);
      return result;
    } catch (error) {
      throw toHttpError(error, reply, this.logger);
    }
  }

  /** Starts the review, or reports the one that is already there: asking twice is fine. */
  @Post('games/:id/review')
  @HttpCode(HttpStatus.OK)
  @RateLimit(ANALYSIS_LIMITS.reviewPerUser)
  startReview(
    @CurrentUserId() userId: string,
    @Param('id', gameId()) id: string,
  ): Promise<ReviewStatus> {
    return this.reviews.start(userId, id);
  }

  @Get('games/:id/review')
  review(
    @CurrentUserId() userId: string,
    @Param('id', gameId()) id: string,
  ): Promise<ReviewStatus> {
    return this.reviews.status(userId, id);
  }
}
