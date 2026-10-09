import {
  ApiErrorSchema,
  AuthResponseSchema,
  CheckoutResponseSchema,
  PaymentStatusSchema,
  PlansResponseSchema,
  SubscriptionViewSchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { BillingService } from './billing.service.js';
import {
  PAYMENT_PROVIDER,
  PaymentProviderError,
  type CreatePaymentInput,
  type PaymentProvider,
  type ProviderPayment,
} from './payment-provider.js';
import { notificationPaymentId } from './yookassa.provider.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

/** A provider that is told by the test what the learner did on the payment page. */
class FakeProvider implements PaymentProvider {
  readonly created: CreatePaymentInput[] = [];
  private readonly payments = new Map<string, ProviderPayment>();
  failCreate = false;
  private counter = 0;

  async create(input: CreatePaymentInput): Promise<ProviderPayment> {
    if (this.failCreate) throw new PaymentProviderError('down', 500);
    this.created.push(input);
    // The same key gives the same payment, as at the real provider
    const known = [...this.payments.values()].find((p) => p.metadata.key === input.idempotencyKey);
    if (known) return known;
    this.counter += 1;
    const payment: ProviderPayment = {
      id: `provider-${this.counter}`,
      status: 'pending',
      confirmationUrl: input.paymentMethodId ? null : `https://pay.example/${this.counter}`,
      paymentMethod: null,
      metadata: { ...input.metadata, key: input.idempotencyKey },
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  async get(id: string): Promise<ProviderPayment> {
    const payment = this.payments.get(id);
    if (!payment) throw new PaymentProviderError('unknown', 404);
    return { ...payment };
  }

  notification({ body }: { body: unknown }) {
    const providerPaymentId = notificationPaymentId(body);
    return providerPaymentId ? { providerPaymentId, reply: '{}' } : null;
  }

  /** The learner paid; `saved` is whether they agreed to keep the card. */
  pay(id: string, saved: boolean): void {
    const payment = this.payments.get(id) as ProviderPayment;
    payment.status = 'succeeded';
    payment.paymentMethod = saved ? { id: 'pm-1', saved: true, cardLast4: '4477' } : null;
  }

  refuse(id: string, reason?: string): void {
    const payment = this.payments.get(id) as ProviderPayment;
    payment.status = 'canceled';
    if (reason) payment.cancelReason = reason;
  }
}

describe('billing', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let billing: BillingService;
  let provider: FakeProvider;
  let token: string;
  let userId: string;
  const saved: Record<string, string | undefined> = {};
  const env = {
    YOOKASSA_SHOP_ID: 'shop-1',
    YOOKASSA_SECRET_KEY: 'secret-1',
    BILLING_PRICE_MONTH_RUB: '299',
    BILLING_PRICE_YEAR_RUB: '1990',
    BILLING_RENEWAL_CHECK_MINUTES: '0',
  };

  beforeAll(async () => {
    for (const [key, value] of Object.entries(env)) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
    provider = new FakeProvider();
    ({ app, prisma, redis, mail } = await createTestApp((builder) =>
      builder.overrideProvider(PAYMENT_PROVIDER).useValue(provider),
    ));
    billing = app.get(BillingService);
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  async function register(email: string): Promise<{ token: string; id: string }> {
    // Read before the request: the mail can be sent before the answer is back in the test
    const sent = mail.outbox.length;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'long-enough-password' },
    });
    // The verification email goes out after the answer, let it finish before the next test cleans up
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(sent));
    const body = AuthResponseSchema.parse(res.json());
    return { token: body.accessToken, id: body.user.id };
  }

  beforeEach(async () => {
    provider.created.length = 0;
    provider.failCreate = false;
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
    ({ token, id: userId } = await register('cat@example.com'));
  });

  const call = (method: 'GET' | 'POST', url: string, body?: unknown, as = token) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${as}` },
      ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    });

  const checkout = async (plan: 'month' | 'year' = 'month', autoRenew = true, as = token) => {
    const res = await call('POST', '/billing/checkout', { plan, client: 'web', autoRenew }, as);
    expect(res.statusCode, res.body).toBe(200);
    return CheckoutResponseSchema.parse(res.json());
  };
  const status = async (paymentId: string, as = token) =>
    PaymentStatusSchema.parse(
      (await call('GET', `/billing/payments/${paymentId}`, undefined, as)).json(),
    );
  const subscription = async () =>
    SubscriptionViewSchema.parse((await call('GET', '/billing/subscription')).json());
  const providerIdOf = async (paymentId: string) =>
    (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
      .providerPaymentId as string;
  const notify = (providerPaymentId: string, event = 'payment.succeeded', claimed = 'succeeded') =>
    app.inject({
      method: 'POST',
      url: '/billing/webhook',
      payload: { type: 'notification', event, object: { id: providerPaymentId, status: claimed } },
    });

  it('shows the plans and the prices', async () => {
    const plans = PlansResponseSchema.parse((await call('GET', '/billing/plans')).json());
    expect(plans).toEqual({
      available: true,
      autoRenew: true,
      plans: [
        { key: 'year', priceRub: 1990 },
        { key: 'month', priceRub: 299 },
      ],
    });
  });

  it('shows the prices to a visitor who has not signed in', async () => {
    expect((await app.inject({ method: 'GET', url: '/billing/plans' })).statusCode).toBe(200);
  });

  it('needs a signed-in user', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/billing/checkout', payload: {} })).statusCode,
    ).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/billing/subscription' })).statusCode).toBe(
      401,
    );
  });

  it('starts without a subscription', async () => {
    expect(await subscription()).toEqual({
      premium: false,
      status: 'none',
      plan: null,
      currentPeriodEnd: null,
      autoRenew: false,
      cardLast4: null,
    });
  });

  describe('paying', () => {
    it('creates a payment at the provider with the price, the return page and the consent', async () => {
      const { paymentId, confirmationUrl, returnUrl } = await checkout('year', true);
      expect(confirmationUrl).toMatch(/^https:\/\/pay\.example\//);
      // The app watches for this address to close the payment page
      expect(returnUrl).toBe(
        `http://localhost:5173/billing/return?paymentId=${paymentId}&client=web`,
      );
      const [sent] = provider.created;
      expect(sent).toMatchObject({
        amountKopecks: 199_000,
        savePaymentMethod: true,
        metadata: { paymentId },
      });
      expect(sent?.returnUrl).toBe(
        `http://localhost:5173/billing/return?paymentId=${paymentId}&client=web`,
      );
      expect(sent?.idempotencyKey).toBeTruthy();
      // The receipt of the payment goes to the address of the learner
      const learner = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(sent?.customerEmail).toBe(learner.email);
      const row = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(row).toMatchObject({
        status: 'pending',
        planKey: 'year',
        purpose: 'initial',
        amountKopecks: 199_000,
      });
    });

    it('gives Premium only once the provider says the payment went through, and keeps the card', async () => {
      const { paymentId } = await checkout('month', true);
      // The learner has come back from the page, the provider has not got the money yet
      expect((await status(paymentId)).status).toBe('pending');
      expect((await subscription()).premium).toBe(false);

      provider.pay(await providerIdOf(paymentId), true);
      const paid = await status(paymentId);
      expect(paid.status).toBe('succeeded');
      expect(paid.subscription).toMatchObject({
        premium: true,
        status: 'active',
        plan: 'month',
        autoRenew: true,
        cardLast4: '4477',
      });
      const end = new Date(paid.subscription.currentPeriodEnd as string).getTime();
      expect(end - Date.now()).toBeGreaterThan(27 * MS_IN_DAY);
      expect(end - Date.now()).toBeLessThan(32 * MS_IN_DAY);
    });

    it('does not renew by itself when the learner did not agree to it', async () => {
      const { paymentId } = await checkout('month', false);
      provider.pay(await providerIdOf(paymentId), false);
      expect((await status(paymentId)).subscription).toMatchObject({
        premium: true,
        autoRenew: false,
        cardLast4: null,
      });
      expect(provider.created[0]?.savePaymentMethod).toBe(false);
    });

    it('marks a payment that was refused and gives nothing', async () => {
      const { paymentId } = await checkout();
      provider.refuse(await providerIdOf(paymentId), 'insufficient_funds');
      expect(await status(paymentId)).toMatchObject({
        status: 'canceled',
        subscription: { premium: false, status: 'none' },
      });
      // The admin page shows why
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).cancelReason,
      ).toBe('insufficient_funds');
    });

    it('extends the paid period when the learner pays again early', async () => {
      const first = await checkout('month');
      provider.pay(await providerIdOf(first.paymentId), true);
      const before = (await status(first.paymentId)).subscription.currentPeriodEnd as string;

      const second = await checkout('month');
      provider.pay(await providerIdOf(second.paymentId), true);
      const after = (await status(second.paymentId)).subscription.currentPeriodEnd as string;
      const gap = new Date(after).getTime() - new Date(before).getTime();
      expect(gap).toBeGreaterThanOrEqual(28 * MS_IN_DAY);
      expect(gap).toBeLessThanOrEqual(31 * MS_IN_DAY);
    });

    it('says the shop is busy when the provider fails, and keeps no pending payment', async () => {
      provider.failCreate = true;
      const res = await call('POST', '/billing/checkout', {
        plan: 'month',
        client: 'web',
        autoRenew: true,
      });
      expect(res.statusCode).toBe(503);
      expect(errorCode(res.json())).toBe('server.unavailable');
      expect((await prisma.payment.findFirstOrThrow()).status).toBe('canceled');
    });

    it('keeps payments to their owner', async () => {
      const { paymentId } = await checkout();
      const other = await register('other@example.com');
      const res = await call('GET', `/billing/payments/${paymentId}`, undefined, other.token);
      expect(res.statusCode).toBe(404);
      expect(errorCode(res.json())).toBe('billing.payment_not_found');
    });
  });

  describe('the notifications of the provider', () => {
    it('does not believe the body: the state comes from asking the provider', async () => {
      const { paymentId } = await checkout();
      const providerId = await providerIdOf(paymentId);
      // The body says succeeded, the provider says pending
      expect((await notify(providerId, 'payment.succeeded', 'succeeded')).statusCode).toBe(200);
      expect((await subscription()).premium).toBe(false);

      provider.pay(providerId, true);
      expect((await notify(providerId)).statusCode).toBe(200);
      expect((await subscription()).premium).toBe(true);
    });

    it('gives the period once, however many times the notification comes', async () => {
      const { paymentId } = await checkout();
      const providerId = await providerIdOf(paymentId);
      provider.pay(providerId, true);
      await notify(providerId);
      const first = (await subscription()).currentPeriodEnd;
      await notify(providerId);
      await status(paymentId);
      expect((await subscription()).currentPeriodEnd).toBe(first);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).appliedAt,
      ).not.toBeNull();
    });

    it('answers 200 to what it does not know', async () => {
      expect((await notify('nobody')).statusCode).toBe(200);
      expect((await notify('provider-1', 'refund.succeeded')).statusCode).toBe(200);
      const odd = await app.inject({
        method: 'POST',
        url: '/billing/webhook',
        payload: { hello: 'world' },
      });
      expect(odd.statusCode).toBe(200);

      // Robokassa calls with a form, or with the fields in the address
      const form = await app.inject({
        method: 'POST',
        url: '/billing/webhook',
        payload: 'OutSum=299.00&InvId=1&SignatureValue=abc',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      expect(form.statusCode).toBe(200);
      const query = await app.inject({
        method: 'GET',
        url: '/billing/webhook?OutSum=299.00&InvId=1&SignatureValue=abc',
      });
      expect(query.statusCode).toBe(200);
    });
  });

  describe('cancelling and coming back', () => {
    async function subscribed() {
      const { paymentId } = await checkout('month', true);
      provider.pay(await providerIdOf(paymentId), true);
      await status(paymentId);
    }

    it('keeps Premium until the end of the paid period and stops the renewal', async () => {
      await subscribed();
      const res = await call('POST', '/billing/cancel');
      expect(SubscriptionViewSchema.parse(res.json())).toMatchObject({
        premium: true,
        status: 'canceled',
        autoRenew: false,
      });
    });

    it('takes the cancellation back before the end', async () => {
      await subscribed();
      await call('POST', '/billing/cancel');
      const res = await call('POST', '/billing/resume');
      expect(SubscriptionViewSchema.parse(res.json())).toMatchObject({
        status: 'active',
        autoRenew: true,
      });
    });

    it('cannot cancel or resume without a subscription', async () => {
      for (const action of ['cancel', 'resume']) {
        const res = await call('POST', `/billing/${action}`);
        expect(res.statusCode).toBe(409);
        expect(errorCode(res.json())).toBe('billing.no_subscription');
      }
    });

    it('cannot resume when there is nothing to resume', async () => {
      await subscribed();
      const res = await call('POST', '/billing/resume');
      expect(res.statusCode).toBe(409);
      expect(errorCode(res.json())).toBe('billing.cannot_resume');
    });

    it('ends Premium when the paid period is over', async () => {
      await subscribed();
      await call('POST', '/billing/cancel');
      await prisma.subscription.update({
        where: { userId },
        data: { currentPeriodEnd: new Date(Date.now() - MS_IN_DAY) },
      });
      expect(await subscription()).toMatchObject({ premium: false, status: 'expired' });
    });
  });

  describe('the renewal', () => {
    async function subscribedEndingSoon() {
      const { paymentId } = await checkout('month', true);
      provider.pay(await providerIdOf(paymentId), true);
      await status(paymentId);
      const end = new Date(Date.now() + MS_IN_DAY / 2);
      await prisma.subscription.update({ where: { userId }, data: { currentPeriodEnd: end } });
      return end;
    }

    it('charges the saved card once per period and extends the period when it goes through', async () => {
      const end = await subscribedEndingSoon();
      provider.created.length = 0;
      await billing.runScheduled(new Date());
      expect(provider.created).toHaveLength(1);
      expect(provider.created[0]).toMatchObject({
        paymentMethodId: 'pm-1',
        amountKopecks: 29_900,
        idempotencyKey: `renewal:${userId}:${end.toISOString()}`,
      });
      expect(provider.created[0]?.customerEmail).toBeTruthy();
      expect(provider.created[0]?.returnUrl).toBeUndefined();

      // Running again before the answer comes does not charge twice
      await billing.runScheduled(new Date());
      expect(provider.created).toHaveLength(1);

      const renewal = await prisma.payment.findFirstOrThrow({ where: { purpose: 'renewal' } });
      provider.pay(renewal.providerPaymentId as string, true);
      await notify(renewal.providerPaymentId as string);
      const view = await subscription();
      expect(view.status).toBe('active');
      expect(new Date(view.currentPeriodEnd as string).getTime()).toBeGreaterThan(
        end.getTime() + 27 * MS_IN_DAY,
      );
    });

    it('keeps the access for the grace days when the card is refused', async () => {
      await subscribedEndingSoon();
      await billing.runScheduled(new Date());
      const renewal = await prisma.payment.findFirstOrThrow({ where: { purpose: 'renewal' } });
      provider.refuse(renewal.providerPaymentId as string);
      await notify(renewal.providerPaymentId as string, 'payment.canceled', 'canceled');
      expect((await prisma.subscription.findUniqueOrThrow({ where: { userId } })).status).toBe(
        'past_due',
      );
      expect((await subscription()).premium).toBe(true);
    });

    it('does not charge a learner who cancelled', async () => {
      await subscribedEndingSoon();
      await call('POST', '/billing/cancel');
      provider.created.length = 0;
      await billing.runScheduled(new Date());
      expect(provider.created).toEqual([]);
    });

    it('asks about a payment whose notification never came', async () => {
      const { paymentId } = await checkout();
      provider.pay(await providerIdOf(paymentId), true);
      await prisma.payment.update({
        where: { id: paymentId },
        data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
      });
      await billing.runScheduled(new Date());
      expect((await subscription()).premium).toBe(true);
    });
  });
});

function errorCode(body: unknown): string {
  return ApiErrorSchema.parse(body).code;
}
