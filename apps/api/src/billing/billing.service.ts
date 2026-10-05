import type {
  CheckoutRequest,
  CheckoutResponse,
  PaymentStatus,
  PlansResponse,
  SubscriptionView,
} from '@kotgambit/contracts';
import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import type { BillingConfig } from '../config/config.js';
import type {
  Payment as PaymentRow,
  Subscription as SubscriptionRow,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PAYMENT_PROVIDER,
  PaymentProviderError,
  type PaymentProvider,
  type ProviderPayment,
} from './payment-provider.js';
import { addPlanPeriod, type PlanKey } from './plans.js';
import {
  hasPremium,
  transition,
  type SubscriptionEvent,
  type SubscriptionState,
} from './subscription-machine.js';

const KOPECKS_IN_RUBLE = 100;
const MS_IN_MINUTE = 60 * 1000;
const MS_IN_DAY = 24 * 60 * MS_IN_MINUTE;
// The renewal is charged this long before the period ends, so that a failed charge can be retried in time
const RENEW_AHEAD_MS = MS_IN_DAY;
// A payment still pending after this long is asked about again, in case the notification was lost
const SYNC_AFTER_MS = 2 * MS_IN_MINUTE;

const NO_SUBSCRIPTION: SubscriptionView = {
  premium: false,
  status: 'none',
  plan: null,
  currentPeriodEnd: null,
  autoRenew: false,
  cardLast4: null,
};

const PLAN_TITLES: Record<PlanKey, string> = { month: 'на месяц', year: 'на год' };

function stateOf(row: SubscriptionRow): SubscriptionState {
  return { status: row.status, currentPeriodEnd: row.currentPeriodEnd, autoRenew: row.autoRenew };
}

/**
 * Premium and the money behind it. The server is the one source of truth about a payment: a client coming
 * back from the payment page, and a notification from the provider, only make it ask the provider (PLAN.md 6.8).
 */
@Injectable()
export class BillingService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BillingService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider | null,
  ) {}

  onApplicationBootstrap(): void {
    const billing = this.config.billing;
    if (!billing || !this.provider || billing.renewalCheckMinutes === 0) return;
    this.timer = setInterval(() => {
      void this.runScheduled(new Date()).catch((error: unknown) => this.logger.error(error));
    }, billing.renewalCheckMinutes * MS_IN_MINUTE);
    // A timer must not keep the process alive on its own
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  plans(): PlansResponse {
    const billing = this.config.billing;
    if (!billing) return { available: false, plans: [] };
    return {
      available: true,
      plans: [
        { key: 'year', priceRub: billing.prices.year },
        { key: 'month', priceRub: billing.prices.month },
      ],
    };
  }

  /** What the learner has now. Time passing is applied first, so that an ended period shows as ended. */
  async subscription(userId: string, now = new Date()): Promise<SubscriptionView> {
    const row = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!row) return NO_SUBSCRIPTION;
    const current = await this.advance(row, { type: 'tick', now });
    return this.view(current, now);
  }

  /** Premium or not, for the limits. */
  async isPremium(userId: string, now = new Date()): Promise<boolean> {
    return (await this.subscription(userId, now)).premium;
  }

  async checkout(userId: string, request: CheckoutRequest): Promise<CheckoutResponse> {
    const billing = this.requireBilling();
    const provider = this.requireProvider();
    const amountKopecks = billing.prices[request.plan] * KOPECKS_IN_RUBLE;
    const customerEmail = await this.emailOf(userId);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planKey: request.plan,
        purpose: 'initial',
        amountKopecks,
        idempotencyKey: randomUUID(),
        client: request.client,
      },
    });
    try {
      const returnUrl = `${this.config.webUrl}/billing/return?paymentId=${payment.id}&client=${request.client}`;
      const created = await provider.create({
        amountKopecks,
        description: `Кот Гамбит, Премиум ${PLAN_TITLES[request.plan]}`,
        returnUrl,
        idempotencyKey: payment.idempotencyKey,
        customerEmail,
        savePaymentMethod: request.autoRenew,
        metadata: { paymentId: payment.id },
      });
      if (!created.confirmationUrl) throw new PaymentProviderError('No confirmation page', null);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: created.id },
      });
      return { paymentId: payment.id, confirmationUrl: created.confirmationUrl, returnUrl };
    } catch (error) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'canceled' } });
      this.logger.error(error instanceof Error ? error.message : 'Payment could not be created');
      throw new AppError('server.unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** The status of a payment of the learner. A payment still waiting is asked about at the provider. */
  async paymentStatus(userId: string, paymentId: string): Promise<PaymentStatus> {
    let payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment) throw new AppError('billing.payment_not_found', HttpStatus.NOT_FOUND);
    if (payment.status === 'pending' && payment.providerPaymentId) {
      payment = await this.sync(payment).catch((error: unknown) => {
        // The provider being slow is not the learner's problem: they see "pending" and the page asks again
        this.logger.warn(error instanceof Error ? error.message : 'Payment could not be checked');
        return payment as PaymentRow;
      });
    }
    return {
      paymentId: payment.id,
      status: payment.status,
      subscription: await this.subscription(userId),
    };
  }

  /**
   * A notification from the provider. Its body is not believed: only the payment id is taken from it,
   * and the state comes from asking the provider. A notification that is repeated or unknown changes nothing.
   */
  async handleNotification(body: unknown): Promise<void> {
    const providerId = notificationPaymentId(body);
    if (!providerId) return;
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId: providerId },
    });
    if (!payment) return;
    await this.sync(payment);
  }

  async cancel(userId: string): Promise<SubscriptionView> {
    const row = await this.requireSubscription(userId);
    return this.view(await this.advance(row, { type: 'cancel' }), new Date());
  }

  async resume(userId: string): Promise<SubscriptionView> {
    const now = new Date();
    const row = await this.requireSubscription(userId);
    if (!row.paymentMethodId) throw new AppError('billing.cannot_resume', HttpStatus.CONFLICT);
    const next = await this.advance(row, { type: 'resume', now });
    if (next.status === row.status && next.autoRenew === row.autoRenew) {
      throw new AppError('billing.cannot_resume', HttpStatus.CONFLICT);
    }
    return this.view(next, now);
  }

  /**
   * One pass of the background work: asks about payments that are still waiting, charges the renewals that
   * are due, and lets ended periods end. Safe to run again at any time: every step is keyed.
   */
  async runScheduled(now: Date): Promise<void> {
    if (!this.provider) return;
    await this.syncPending(now);
    await this.renewDue(now);
    await this.expireEnded(now);
  }

  private async syncPending(now: Date): Promise<void> {
    const pending = await this.prisma.payment.findMany({
      where: {
        status: 'pending',
        providerPaymentId: { not: null },
        createdAt: { lte: new Date(now.getTime() - SYNC_AFTER_MS) },
      },
    });
    for (const payment of pending) {
      await this.sync(payment).catch((error: unknown) =>
        this.logger.warn(error instanceof Error ? error.message : 'Payment could not be checked'),
      );
    }
  }

  private async renewDue(now: Date): Promise<void> {
    const provider = this.requireProvider();
    const billing = this.requireBilling();
    const due = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'past_due'] },
        autoRenew: true,
        paymentMethodId: { not: null },
        currentPeriodEnd: { lte: new Date(now.getTime() + RENEW_AHEAD_MS) },
      },
    });
    for (const row of due) {
      const plan = row.planKey as PlanKey;
      // One renewal per period: the key is the same however many times this runs, so no double charge
      const idempotencyKey = `renewal:${row.userId}:${row.currentPeriodEnd.toISOString()}`;
      const known = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
      if (known) continue;
      const amountKopecks = billing.prices[plan] * KOPECKS_IN_RUBLE;
      const payment = await this.prisma.payment.create({
        data: {
          userId: row.userId,
          planKey: plan,
          purpose: 'renewal',
          amountKopecks,
          idempotencyKey,
          client: 'web',
        },
      });
      try {
        const created = await provider.create({
          amountKopecks,
          description: `Кот Гамбит, продление Премиума ${PLAN_TITLES[plan]}`,
          idempotencyKey,
          customerEmail: await this.emailOf(row.userId),
          paymentMethodId: row.paymentMethodId as string,
          metadata: { paymentId: payment.id },
        });
        const saved = await this.prisma.payment.update({
          where: { id: payment.id },
          data: { providerPaymentId: created.id },
        });
        await this.sync(saved);
      } catch (error) {
        this.logger.error(error instanceof Error ? error.message : 'Renewal could not be charged');
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'canceled' },
        });
        await this.advance(row, { type: 'renewal-failed' });
      }
    }
  }

  private async expireEnded(now: Date): Promise<void> {
    const rows = await this.prisma.subscription.findMany({
      where: { status: { not: 'expired' }, currentPeriodEnd: { lte: now } },
    });
    for (const row of rows) await this.advance(row, { type: 'tick', now });
  }

  /** Asks the provider for the payment and brings our record in line, once for a finished payment. */
  private async sync(payment: PaymentRow): Promise<PaymentRow> {
    const provider = this.requireProvider();
    if (!payment.providerPaymentId) return payment;
    const remote = await provider.get(payment.providerPaymentId);
    if (remote.status === 'pending') return payment;

    if (remote.status === 'canceled') {
      const { count } = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: 'canceled' },
      });
      if (count > 0 && payment.purpose === 'renewal') {
        const row = await this.prisma.subscription.findUnique({
          where: { userId: payment.userId },
        });
        if (row) await this.advance(row, { type: 'renewal-failed' });
      }
      return this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    }
    return this.apply(payment, remote);
  }

  /** A succeeded payment moves the subscription. It does so once: `appliedAt` is set in the same step. */
  private async apply(payment: PaymentRow, remote: ProviderPayment): Promise<PaymentRow> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, appliedAt: null },
        data: { appliedAt: now, paidAt: now, status: 'succeeded' },
      });
      if (count === 0) return;

      const existing = await tx.subscription.findUnique({ where: { userId: payment.userId } });
      const plan = payment.planKey as PlanKey;
      // A payment made early extends the paid period, one made late starts from now
      const live = existing && existing.status !== 'expired' && existing.currentPeriodEnd > now;
      const periodEnd = addPlanPeriod(live ? existing.currentPeriodEnd : now, plan);
      const base: SubscriptionState = existing
        ? stateOf(existing)
        : { status: 'expired', currentPeriodEnd: now, autoRenew: false };
      const next = transition(base, { type: 'payment-succeeded', periodEnd });

      // The autopayment needs the learner's agreement and a method the provider really kept
      const kept = remote.paymentMethod?.saved ? remote.paymentMethod : null;
      const method = kept
        ? { paymentMethodId: kept.id, cardLast4: kept.cardLast4, autoRenew: true }
        : payment.purpose === 'renewal'
          ? {
              paymentMethodId: existing?.paymentMethodId ?? null,
              cardLast4: existing?.cardLast4 ?? null,
              autoRenew: next.autoRenew,
            }
          : { paymentMethodId: null, cardLast4: null, autoRenew: false };

      await tx.subscription.upsert({
        where: { userId: payment.userId },
        create: {
          userId: payment.userId,
          planKey: plan,
          status: next.status,
          currentPeriodEnd: next.currentPeriodEnd,
          ...method,
        },
        update: {
          planKey: plan,
          status: next.status,
          currentPeriodEnd: next.currentPeriodEnd,
          ...method,
        },
      });
    });
    return this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }

  private async advance(row: SubscriptionRow, event: SubscriptionEvent): Promise<SubscriptionRow> {
    const next = transition(stateOf(row), event);
    if (
      next.status === row.status &&
      next.autoRenew === row.autoRenew &&
      next.currentPeriodEnd.getTime() === row.currentPeriodEnd.getTime()
    ) {
      return row;
    }
    return this.prisma.subscription.update({
      where: { userId: row.userId },
      data: {
        status: next.status,
        autoRenew: next.autoRenew,
        currentPeriodEnd: next.currentPeriodEnd,
      },
    });
  }

  private view(row: SubscriptionRow, now: Date): SubscriptionView {
    return {
      premium: hasPremium(stateOf(row), now),
      status: row.status,
      plan: row.planKey as PlanKey,
      currentPeriodEnd: row.currentPeriodEnd.toISOString(),
      autoRenew: row.autoRenew,
      cardLast4: row.cardLast4,
    };
  }

  private async requireSubscription(userId: string): Promise<SubscriptionRow> {
    const row = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!row) throw new AppError('billing.no_subscription', HttpStatus.CONFLICT);
    return row;
  }

  /** The address the receipt goes to. */
  private async emailOf(userId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email;
  }

  private requireBilling(): BillingConfig {
    if (!this.config.billing)
      throw new AppError('billing.unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    return this.config.billing;
  }

  private requireProvider(): PaymentProvider {
    if (!this.provider) throw new AppError('billing.unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    return this.provider;
  }
}

const PAYMENT_EVENTS = new Set([
  'payment.succeeded',
  'payment.canceled',
  'payment.waiting_for_capture',
]);

/** The id of the payment in a YooKassa notification, or `null` for any other event or an odd body. */
function notificationPaymentId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { event, object } = body as { event?: unknown; object?: unknown };
  if (typeof event !== 'string' || !PAYMENT_EVENTS.has(event)) return null;
  if (typeof object !== 'object' || object === null) return null;
  const id = (object as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
