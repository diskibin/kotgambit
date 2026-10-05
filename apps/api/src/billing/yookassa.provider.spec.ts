import { describe, expect, it, vi } from 'vitest';
import { PaymentProviderError } from './payment-provider.js';
import { YooKassaProvider, formatAmount } from './yookassa.provider.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const PENDING = {
  id: '23d93cac-000f-5000-8000-126628f15141',
  status: 'pending',
  confirmation: { type: 'redirect', confirmation_url: 'https://yoomoney.ru/pay/abc' },
  metadata: { paymentId: 'ours-1' },
};

function provider(answer: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return { fetchMock, provider: new YooKassaProvider('shop-1', 'secret-1', fetchMock as never) };
}

describe('formatAmount', () => {
  it('writes kopecks as rubles with two decimals', () => {
    expect(formatAmount(14900)).toBe('149.00');
    expect(formatAmount(5)).toBe('0.05');
    expect(formatAmount(129900)).toBe('1299.00');
  });
});

describe('YooKassaProvider', () => {
  it('creates a payment with the redirect confirmation and the key of idempotence', async () => {
    const { fetchMock, provider: yk } = provider(json(PENDING));
    const payment = await yk.create({
      amountKopecks: 14900,
      description: 'Премиум на месяц',
      returnUrl: 'https://kotgambit.example/billing/return?paymentId=ours-1',
      idempotencyKey: 'key-1',
      savePaymentMethod: true,
      metadata: { paymentId: 'ours-1' },
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.yookassa.ru/v3/payments');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotence-Key']).toBe('key-1');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('shop-1:secret-1').toString('base64')}`,
    );
    expect(JSON.parse(init.body as string)).toEqual({
      amount: { value: '149.00', currency: 'RUB' },
      capture: true,
      description: 'Премиум на месяц',
      metadata: { paymentId: 'ours-1' },
      confirmation: {
        type: 'redirect',
        return_url: 'https://kotgambit.example/billing/return?paymentId=ours-1',
      },
      save_payment_method: true,
    });
    expect(payment).toEqual({
      id: PENDING.id,
      status: 'pending',
      confirmationUrl: 'https://yoomoney.ru/pay/abc',
      paymentMethod: null,
      metadata: { paymentId: 'ours-1' },
    });
  });

  describe('the receipt (54-FZ)', () => {
    const input = {
      amountKopecks: 14900,
      description: 'Кот Гамбит, Премиум на месяц',
      idempotencyKey: 'key-1',
      customerEmail: 'cat@example.com',
      metadata: { paymentId: 'ours-1' },
    };
    const bodyOf = (fetchMock: ReturnType<typeof provider>['fetchMock']) =>
      JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);

    it('is sent as one service paid in full when the shop is set up for it', async () => {
      const fetchMock = vi.fn(async () => json(PENDING));
      const yk = new YooKassaProvider('shop-1', 'secret-1', fetchMock as never, {
        vatCode: 1,
        taxSystemCode: null,
      });
      await yk.create(input);

      expect(bodyOf({ mock: fetchMock.mock } as never).receipt).toEqual({
        customer: { email: 'cat@example.com' },
        items: [
          {
            description: 'Кот Гамбит, Премиум на месяц',
            quantity: '1.00',
            amount: { value: '149.00', currency: 'RUB' },
            vat_code: 1,
            payment_subject: 'service',
            payment_mode: 'full_payment',
          },
        ],
      });
    });

    it('carries the tax system and the VAT code that were set', async () => {
      const fetchMock = vi.fn(async () => json(PENDING));
      const yk = new YooKassaProvider('shop-1', 'secret-1', fetchMock as never, {
        vatCode: 2,
        taxSystemCode: 3,
      });
      await yk.create(input);
      const { receipt } = bodyOf({ mock: fetchMock.mock } as never);
      expect(receipt.tax_system_code).toBe(3);
      expect(receipt.items[0].vat_code).toBe(2);
    });

    it('cuts a long description to what the reference allows', async () => {
      const fetchMock = vi.fn(async () => json(PENDING));
      const yk = new YooKassaProvider('shop-1', 'secret-1', fetchMock as never, {
        vatCode: 1,
        taxSystemCode: null,
      });
      await yk.create({ ...input, description: 'я'.repeat(300) });
      expect(bodyOf({ mock: fetchMock.mock } as never).receipt.items[0].description).toHaveLength(
        128,
      );
    });

    it('is not sent when the shop is not set up for it, or there is no address', async () => {
      const plain = provider(json(PENDING));
      await plain.provider.create(input);
      expect(bodyOf(plain.fetchMock).receipt).toBeUndefined();

      const fetchMock = vi.fn(async () => json(PENDING));
      const yk = new YooKassaProvider('shop-1', 'secret-1', fetchMock as never, {
        vatCode: 1,
        taxSystemCode: null,
      });
      await yk.create({ ...input, customerEmail: undefined });
      expect(bodyOf({ mock: fetchMock.mock } as never).receipt).toBeUndefined();
    });
  });

  it('charges a saved payment method without a confirmation', async () => {
    const { fetchMock, provider: yk } = provider(json({ ...PENDING, confirmation: undefined }));
    await yk.create({
      amountKopecks: 14900,
      description: 'Продление',
      idempotencyKey: 'key-2',
      paymentMethodId: 'pm-1',
      metadata: {},
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.payment_method_id).toBe('pm-1');
    expect(body.confirmation).toBeUndefined();
    expect(body.save_payment_method).toBeUndefined();
  });

  it('reads a succeeded payment with the saved method and the card', async () => {
    const { fetchMock, provider: yk } = provider(
      json({
        id: PENDING.id,
        status: 'succeeded',
        payment_method: { id: 'pm-1', saved: true, card: { last4: '4477' } },
        metadata: { paymentId: 'ours-1' },
      }),
    );
    const payment = await yk.get(PENDING.id);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      `https://api.yookassa.ru/v3/payments/${PENDING.id}`,
    );
    expect(payment).toMatchObject({
      status: 'succeeded',
      paymentMethod: { id: 'pm-1', saved: true, cardLast4: '4477' },
    });
  });

  it('treats a payment that is not finished as pending and a canceled one as canceled', async () => {
    expect(
      (await provider(json({ id: 'a', status: 'waiting_for_capture' })).provider.get('a')).status,
    ).toBe('pending');
    expect((await provider(json({ id: 'a', status: 'canceled' })).provider.get('a')).status).toBe(
      'canceled',
    );
  });

  it('fails with the status and without any key when the provider refuses', async () => {
    const { provider: yk } = provider(json({ type: 'error', code: 'invalid_credentials' }, 401));
    const error = await yk.get('a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentProviderError);
    expect((error as PaymentProviderError).status).toBe(401);
    expect((error as Error).message).not.toContain('secret-1');
  });

  it('fails without a status when nothing answers or the answer is not a payment', async () => {
    const down = await provider(new Error('network'))
      .provider.get('a')
      .catch((e: unknown) => e);
    expect(down).toMatchObject({ status: null });
    const odd = await provider(json({ nothing: true }))
      .provider.get('a')
      .catch((e: unknown) => e);
    expect(odd).toBeInstanceOf(PaymentProviderError);
  });
});
