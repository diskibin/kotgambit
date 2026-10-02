import { EngineAnalysisRequestSchema, type EngineAnalysisResponse } from '@kotgambit/contracts';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { AppError } from '../common/app-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { EngineBusyError, Priority } from './engine-pool.js';
import { ENGINE_LIMITS } from './engine.limits.js';
import { EngineService } from './engine.service.js';
import { EngineCrashedError, EngineTimeoutError } from './uci-engine.js';

type AnalysisBody = z.output<typeof EngineAnalysisRequestSchema>;

/** The one engine endpoint of stage 5. Bots and game review get their own routes on top of the same service. */
@Controller('engine')
@UseGuards(AccessTokenGuard, RateLimitGuard)
export class EngineController {
  private readonly logger = new Logger(EngineController.name);

  constructor(private readonly engine: EngineService) {}

  @Post('analysis')
  @HttpCode(HttpStatus.OK)
  @RateLimit(ENGINE_LIMITS.analysisPerUser)
  async analyze(
    @Body(new ZodValidationPipe(EngineAnalysisRequestSchema)) body: AnalysisBody,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<EngineAnalysisResponse> {
    try {
      return await this.engine.analyze({ ...body, priority: Priority.Analysis });
    } catch (error) {
      if (error instanceof EngineBusyError) {
        void reply.header('Retry-After', error.retryAfterSeconds);
        throw new AppError('server.unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      }
      if (error instanceof EngineTimeoutError || error instanceof EngineCrashedError) {
        // The engine restarts itself, so asking again soon is the right advice
        this.logger.error(error);
        throw new AppError('server.unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      }
      throw error;
    }
  }
}
