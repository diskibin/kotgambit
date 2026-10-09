import {
  CheckoutRequestSchema,
  type CheckoutRequest,
  type CheckoutResponse,
  type PaymentStatus,
  type PlansResponse,
  type SubscriptionView,
} from '@kotgambit/contracts';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { BillingService } from './billing.service.js';
import { BILLING_LIMITS } from './billing.limits.js';

const paymentId = () => new ZodValidationPipe(z.uuid());

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // Public: the landing page shows the prices to visitors who have not signed in yet
  @Get('plans')
  plans(): PlansResponse {
    return this.billing.plans();
  }

  @Get('subscription')
  @UseGuards(AccessTokenGuard)
  subscription(@CurrentUserId() userId: string): Promise<SubscriptionView> {
    return this.billing.subscription(userId);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard, RateLimitGuard)
  @RateLimit(BILLING_LIMITS.checkoutPerUser)
  checkout(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(CheckoutRequestSchema)) body: CheckoutRequest,
  ): Promise<CheckoutResponse> {
    return this.billing.checkout(userId, body);
  }

  /** Polled by the clients after the learner comes back from the payment page. */
  @Get('payments/:id')
  @UseGuards(AccessTokenGuard, RateLimitGuard)
  @RateLimit(BILLING_LIMITS.statusPerUser)
  payment(
    @CurrentUserId() userId: string,
    @Param('id', paymentId()) id: string,
  ): Promise<PaymentStatus> {
    return this.billing.paymentStatus(userId, id);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  cancel(@CurrentUserId() userId: string): Promise<SubscriptionView> {
    return this.billing.cancel(userId);
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  resume(@CurrentUserId() userId: string): Promise<SubscriptionView> {
    return this.billing.resume(userId);
  }

  /**
   * The notifications of the provider (YooKassa posts JSON, Robokassa calls with the fields in a form or in the
   * address). There is no sign-in here, the content is not believed: the service only takes the payment id and
   * asks the provider. A 200 stops the retries; the text is what the provider wants to hear ("OK5" for Robokassa).
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  webhook(@Body() body: unknown, @Query() query: unknown): Promise<string> {
    return this.billing.handleNotification({ body, query });
  }

  // One method takes one route in Nest, so the call with the fields in the address has its own
  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  webhookByAddress(@Query() query: unknown): Promise<string> {
    return this.billing.handleNotification({ body: undefined, query });
  }
}
