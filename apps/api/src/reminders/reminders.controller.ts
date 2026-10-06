import { UnsubscribeRequestSchema, type UnsubscribeRequest } from '@kotgambit/contracts';
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { RemindersService } from './reminders.service.js';

const UNSUBSCRIBE_LIMIT = {
  name: 'unsubscribe-ip',
  limit: 20,
  windowSeconds: 60,
  by: 'ip',
} as const;

@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /**
   * Public, the link in a letter works without signing in. A POST and not a GET, so that a mail scanner that
   * opens every link of a letter does not unsubscribe people by itself; the page of the link sends it.
   */
  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit(UNSUBSCRIBE_LIMIT)
  async unsubscribe(
    @Body(new ZodValidationPipe(UnsubscribeRequestSchema)) body: UnsubscribeRequest,
  ): Promise<void> {
    if (!(await this.reminders.unsubscribe(body.token))) {
      throw new AppError('reminders.bad_link', HttpStatus.BAD_REQUEST);
    }
  }
}
