import {
  CardAnswerRequestSchema,
  type CardAnswerResponse,
  type CardSummary,
  type MakeCardsResponse,
  type NextCard,
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
import { CARD_LIMITS } from './cards.limits.js';
import { CardsService } from './cards.service.js';

type AnswerBody = z.output<typeof CardAnswerRequestSchema>;

const id = () => new ZodValidationPipe(z.uuid());

@Controller()
@UseGuards(AccessTokenGuard, RateLimitGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get('cards/summary')
  summary(@CurrentUserId() userId: string): Promise<CardSummary> {
    return this.cards.summary(userId);
  }

  @Post('cards/next')
  @HttpCode(HttpStatus.OK)
  @RateLimit(CARD_LIMITS.nextPerUser)
  next(@CurrentUserId() userId: string): Promise<NextCard> {
    return this.cards.next(userId);
  }

  @Post('cards/:id/answer')
  @HttpCode(HttpStatus.OK)
  @RateLimit(CARD_LIMITS.answerPerUser)
  answer(
    @CurrentUserId() userId: string,
    @Param('id', id()) cardId: string,
    @Body(new ZodValidationPipe(CardAnswerRequestSchema)) body: AnswerBody,
  ): Promise<CardAnswerResponse> {
    return this.cards.answer(userId, cardId, body.move);
  }

  /** Makes cards from the mistakes of a reviewed game. Pressing it twice is fine. */
  @Post('games/:id/review/cards')
  @HttpCode(HttpStatus.OK)
  @RateLimit(CARD_LIMITS.makePerUser)
  make(
    @CurrentUserId() userId: string,
    @Param('id', id()) gameId: string,
  ): Promise<MakeCardsResponse> {
    return this.cards.makeFromGame(userId, gameId);
  }
}
