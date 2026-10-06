import { AnalyticsEventRequestSchema, type AnalyticsEventRequest } from '@kotgambit/contracts';
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard.js';

// A visitor makes a handful of steps in a visit, a script that makes more is not a visitor
const EVENT_LIMIT = { name: 'analytics-ip', limit: 60, windowSeconds: 60, by: 'ip' } as const;

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public on purpose: the visitors it counts have not signed in. Nothing but the id and the step is kept. */
  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit(EVENT_LIMIT)
  async record(
    @Body(new ZodValidationPipe(AnalyticsEventRequestSchema)) body: AnalyticsEventRequest,
  ): Promise<void> {
    await this.prisma.analyticsEvent.create({
      data: { visitorId: body.visitorId, name: body.name, detail: body.detail ?? null },
    });
  }
}
