import type { ProgressSummary } from '@kotgambit/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProgressService } from './progress.service.js';

const SummaryQuerySchema = z.object({
  /** The learner's calendar day, YYYY-MM-DD. Without it the server's UTC date is used. */
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

@Controller('progress')
@UseGuards(AccessTokenGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('summary')
  summary(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(SummaryQuerySchema)) query: z.output<typeof SummaryQuerySchema>,
  ): Promise<ProgressSummary> {
    return this.progress.summary(userId, this.progress.resolveToday(query.localDate));
  }
}
