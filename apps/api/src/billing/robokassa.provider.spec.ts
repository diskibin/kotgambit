import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PaymentProviderError } from './payment-provider.js';
import { RobokassaProvider, type RobokassaSettings } from './robokassa.provider.js';

const SETTINGS: RobokassaSettings = {
  login: 'kotgambit',
  password1: 'pass-one',
  password2: 'pass-two',
  hash: 'md5',
  recurring: true,
};
const md5 = (text: string) => createHash('md5').update(text).digest('hex');

const text = (body: string, status = 200) => new Response(body, { status });
const state = (result: number, code?: number) =>
  `<OperationStateResponse xmlns="http://merchant.roboxchange.com/WebService/"><Result><Code>${result}</Code></Result>${
    code === undefined ? '' : `<State><Code>${code}</Code></State>`
  }</OperationStateResponse>`;

function setup(answer: Response | Error = text('OK1'), settings = SETTINGS) {
  const fetchMock = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return {
    fetchMock,
    robokassa: new RobokassaProvider(settings, fetchMock as never, () => 1_700_000_000_042),
  };
}

const INPUT = {
  amountKopecks: 29900,
  description: 'Кот Гамбит, Премиум на месяц',
  returnUrl: 'https://kotgambit.example/billing/return?paymentId=p-1&client=web',
  idempotencyKey: 'key-1',
  customerEmail: 'learner@example.com',
  metadata: {},
};

describe('RobokassaProvider', () => {
  describe('the payment page', () => {
    it('builds a signed address and calls nobody', async () => {
      const { fetchMock, robokassa } = setup();
      const payment = await robokassa.create(INPUT);

      const url = new URL(payment.confirmationUrl as string);
      expect(url.origin + url.pathname).toBe('https://auth.robokassa.ru/Merchant/Index.aspx');
      expect(payment.id).toBe('1700000000042');
      expect(payment.status).toBe('pending');
      expect(url.searchParams.get('MerchantLogin')).toBe('kotgambit');
      expect(url.searchParams.get('OutSum')).toBe('299.00');
      expect(url.searchParams.get('InvId')).toBe('1700000000042');
      expect(url.searchParams.get('Email')).toBe('learner@example.com');
      expect(url.searchParams.get('SuccessUrl2')).toBe(INPUT.returnUrl);
      expect(url.searchParams.get('FailUrl2Method')).toBe('GET');
      expect(url.searchParams.get('Recurring')).toBeNull();
      // login:sum:invoice:the addresses with their methods:password 1
      expect(url.searchParams.get('SignatureValue')).toBe(
        md5(
          `kotgambit:299.00:1700000000042:${INPUT.returnUrl}:GET:${INPUT.returnUrl}:GET:pass-one`,
        ),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('signs without the addresses when there is no return page', async () => {
      const { robokassa } = setup();
      const input: Partial<typeof INPUT> = { ...INPUT };
      delete input.returnUrl;
      const url = new URL(
        (await robokassa.create(input as typeof INPUT)).confirmationUrl as string,
      );
      expect(url.searchParams.get('SuccessUrl2')).toBeNull();
      expect(url.searchParams.get('SignatureValue')).toBe(
        md5('kotgambit:299.00:1700000000042:pass-one'),
      );
    });

    it('asks to keep the card only when the learner agreed and the shop may charge it', async () => {
      const { robokassa } = setup();
      const asked = await robokassa.create({ ...INPUT, savePaymentMethod: true });
      expect(new URL(asked.confirmationUrl as string).searchParams.get('Recurring')).toBe('true');

      const { robokassa: notAllowed } = setup(text('OK1'), { ...SETTINGS, recurring: false });
      const refused = await notAllowed.create({ ...INPUT, savePaymentMethod: true });
      expect(new URL(refused.confirmationUrl as string).searchParams.get('Recurring')).toBeNull();
    });

    it('signs with the algorithm of the shop', async () => {
      const { robokassa } = setup(text('OK1'), { ...SETTINGS, hash: 'sha256' });
      const input: Partial<typeof INPUT> = { ...INPUT };
      delete input.returnUrl;
      const url = new URL(
        (await robokassa.create(input as typeof INPUT)).confirmationUrl as string,
      );
      expect(url.searchParams.get('SignatureValue')).toBe(
        createHash('sha256').update('kotgambit:299.00:1700000000042:pass-one').digest('hex'),
      );
    });

    it('cuts the description to the 100 characters of the form', async () => {
      const { robokassa } = setup();
      const url = new URL(
        (await robokassa.create({ ...INPUT, description: 'я'.repeat(150) }))
          .confirmationUrl as string,
      );
      expect(url.searchParams.get('Description')).toHaveLength(100);
    });
  });

  describe('a repeat charge', () => {
    it('posts the new invoice with the first one named, which is not signed', async () => {
      const { fetchMock, robokassa } = setup(text('OK1700000000042'));
      const payment = await robokassa.create({
        ...INPUT,
        paymentMethodId: '1699999999999',
      });

      expect(payment).toMatchObject({
        id: '1700000000042',
        status: 'pending',
        confirmationUrl: null,
      });
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('https://auth.robokassa.ru/Merchant/Recurring');
      expect(init.method).toBe('POST');
      const body = new URLSearchParams(String(init.body));
      expect(body.get('PreviousInvoiceID')).toBe('1699999999999');
      expect(body.get('InvoiceID')).toBe('1700000000042');
      expect(body.get('OutSum')).toBe('299.00');
      expect(body.get('SignatureValue')).toBe(md5('kotgambit:299.00:1700000000042:pass-one'));
    });

    it('is a failure when Robokassa does not say OK', async () => {
      const { robokassa } = setup(text('error', 500));
      await expect(robokassa.create({ ...INPUT, paymentMethodId: '1' })).rejects.toBeInstanceOf(
        PaymentProviderError,
      );
      const { robokassa: unreachable } = setup(new Error('network'));
      await expect(unreachable.create({ ...INPUT, paymentMethodId: '1' })).rejects.toMatchObject({
        status: null,
      });
    });
  });

  describe('the state of a payment', () => {
    it('asks OpStateExt with a signature made with password 2', async () => {
      const { fetchMock, robokassa } = setup(text(state(0, 100)));
      await robokassa.get('1700000000042');
      const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
      expect(url.origin + url.pathname).toBe(
        'https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt',
      );
      expect(url.searchParams.get('MerchantLogin')).toBe('kotgambit');
      expect(url.searchParams.get('InvoiceID')).toBe('1700000000042');
      expect(url.searchParams.get('Signature')).toBe(md5('kotgambit:1700000000042:pass-two'));
    });

    it('reads 100 as paid, and names the first invoice as the method that was kept', async () => {
      const { robokassa } = setup(text(state(0, 100)));
      expect(await robokassa.get('7')).toMatchObject({
        status: 'succeeded',
        paymentMethod: { id: '7', saved: true, cardLast4: null },
      });
      const { robokassa: noPeriodic } = setup(text(state(0, 100)), {
        ...SETTINGS,
        recurring: false,
      });
      expect((await noPeriodic.get('7')).paymentMethod?.saved).toBe(false);
    });

    it.each([
      [5, 'pending'],
      [20, 'pending'],
      [50, 'pending'],
      [80, 'pending'],
      [10, 'canceled'],
      [60, 'canceled'],
    ] as const)('reads the state %i as %s', async (code, expected) => {
      const { robokassa } = setup(text(state(0, code)));
      expect((await robokassa.get('7')).status).toBe(expected);
    });

    it('does not take an invoice that Robokassa does not know yet for a refusal', async () => {
      const { robokassa } = setup(text(state(3)));
      expect((await robokassa.get('7')).status).toBe('pending');
    });

    it('fails on a refusal of the request itself, such as a wrong signature', async () => {
      const { robokassa } = setup(text(state(1)));
      await expect(robokassa.get('7')).rejects.toBeInstanceOf(PaymentProviderError);
    });

    it('fails on an odd answer, a bad status and an invoice that is not a number', async () => {
      await expect(setup(text('<html>nope</html>')).robokassa.get('7')).rejects.toThrow();
      await expect(setup(text('', 502)).robokassa.get('7')).rejects.toMatchObject({ status: 502 });
      await expect(setup().robokassa.get('7; drop')).rejects.toThrow();
      await expect(setup(new Error('network')).robokassa.get('7')).rejects.toMatchObject({
        status: null,
      });
    });
  });

  describe('the notification', () => {
    const signed = (outSum: string, invId: string, password = 'pass-two') =>
      md5(`${outSum}:${invId}:${password}`);

    it('takes the invoice of a notice signed with password 2 and answers OK and its number', () => {
      const { robokassa } = setup();
      const fields = {
        OutSum: '299.000000',
        InvId: '42',
        SignatureValue: signed('299.000000', '42'),
      };
      expect(robokassa.notification({ body: fields, query: {} })).toEqual({
        providerPaymentId: '42',
        reply: 'OK42',
      });
      // A call with the fields in the address, and the signature in capitals
      expect(
        robokassa.notification({
          body: undefined,
          query: { ...fields, SignatureValue: fields.SignatureValue.toUpperCase() },
        }),
      ).toEqual({ providerPaymentId: '42', reply: 'OK42' });
    });

    it('is not a notice when the signature is wrong, made with password 1, or a field is missing', () => {
      const { robokassa } = setup();
      const bad = [
        { OutSum: '299.00', InvId: '42', SignatureValue: signed('299.00', '42', 'pass-one') },
        { OutSum: '1.00', InvId: '42', SignatureValue: signed('299.00', '42') },
        { OutSum: '299.00', InvId: '43', SignatureValue: signed('299.00', '42') },
        { OutSum: '299.00', InvId: '42' },
        { OutSum: '299.00', InvId: 'x', SignatureValue: signed('299.00', 'x') },
      ];
      for (const fields of bad) {
        expect(robokassa.notification({ body: fields, query: {} })).toBeNull();
      }
      expect(robokassa.notification({ body: null, query: undefined })).toBeNull();
    });
  });
});
