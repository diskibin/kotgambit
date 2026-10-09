import { createHash, timingSafeEqual } from 'node:crypto';
import {
  PaymentProviderError,
  type CreatePaymentInput,
  type ParsedNotification,
  type PaymentProvider,
  type ProviderPayment,
} from './payment-provider.js';

// From the official documentation and its OpenAPI file, https://docs.robokassa.ru (checked October 2026)
const PAY_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx';
const RECURRING_URL = 'https://auth.robokassa.ru/Merchant/Recurring';
const STATE_URL = 'https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt';
const TIMEOUT_MS = 10_000;
const KOPECKS_IN_RUBLE = 100;
// "Description" of the payment form: up to 100 characters
const MAX_DESCRIPTION = 100;
// The number of an invoice is a whole number from 1 to 9223372036854775807, ours fit in 2^53
const INVOICE_SPREAD = 100;

// The codes of `State` in the answer of OpStateExt
const STATE_SUCCEEDED = 100;
// Not paid and closed (10), or paid and given back (60)
const STATES_CANCELED: readonly number[] = [10, 60];
// The answer for an invoice that Robokassa does not know yet: nobody has opened the payment page
const RESULT_NOT_FOUND = 3;

export type RobokassaHash = 'md5' | 'sha256' | 'sha384' | 'sha512';

export interface RobokassaSettings {
  login: string;
  /** Signs what we send. */
  password1: string;
  /** Signs what Robokassa sends and what we ask for. */
  password2: string;
  /** Has to be the same as the algorithm chosen in the technical settings of the shop. */
  hash: RobokassaHash;
  /** The shop is allowed to charge saved cards (Robokassa turns it on by agreement). */
  recurring: boolean;
}

/** "299.00" for 29900 kopecks: the same text goes into the form and into the signature. */
export function formatAmount(kopecks: number): string {
  return (kopecks / KOPECKS_IN_RUBLE).toFixed(2);
}

/**
 * Robokassa over `fetch`. A payment is not created with a request: the address of the payment page is
 * built and signed here. The state of a payment is asked with `OpStateExt`, which is the one thing believed.
 */
export class RobokassaProvider implements PaymentProvider {
  constructor(
    private readonly settings: RobokassaSettings,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly invoiceId: () => number = newInvoiceId,
  ) {}

  async create(input: CreatePaymentInput): Promise<ProviderPayment> {
    const id = this.invoiceId();
    const outSum = formatAmount(input.amountKopecks);
    const description = input.description.slice(0, MAX_DESCRIPTION);
    if (input.paymentMethodId) {
      await this.charge(id, input.paymentMethodId, outSum, description);
      return {
        id: String(id),
        status: 'pending',
        confirmationUrl: null,
        paymentMethod: null,
        metadata: {},
      };
    }

    const save = input.savePaymentMethod === true && this.settings.recurring;
    const back = input.returnUrl ? [input.returnUrl, 'GET', input.returnUrl, 'GET'] : [];
    const params = new URLSearchParams({
      MerchantLogin: this.settings.login,
      OutSum: outSum,
      InvId: String(id),
      Description: description,
      Culture: 'ru',
      ...(input.customerEmail ? { Email: input.customerEmail } : {}),
      ...(save ? { Recurring: 'true' } : {}),
      ...(input.returnUrl
        ? {
            SuccessUrl2: input.returnUrl,
            SuccessUrl2Method: 'GET',
            FailUrl2: input.returnUrl,
            FailUrl2Method: 'GET',
          }
        : {}),
    });
    // The order of the documentation: login, sum, invoice, the addresses, the password
    params.set(
      'SignatureValue',
      this.sign([this.settings.login, outSum, String(id), ...back, this.settings.password1]),
    );
    return {
      id: String(id),
      status: 'pending',
      confirmationUrl: `${PAY_URL}?${params.toString()}`,
      paymentMethod: null,
      metadata: {},
    };
  }

  /** A child payment: Robokassa charges the card of the first one without the learner. */
  private async charge(id: number, parentId: string, outSum: string, description: string) {
    const body = new URLSearchParams({
      MerchantLogin: this.settings.login,
      InvoiceID: String(id),
      PreviousInvoiceID: parentId,
      Description: description,
      OutSum: outSum,
      // `PreviousInvoiceID` is not in the signature
      SignatureValue: this.sign([this.settings.login, outSum, String(id), this.settings.password1]),
    });
    let response: Response;
    try {
      response = await this.fetchImpl(RECURRING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new PaymentProviderError('Robokassa did not answer', null);
    }
    // "OK" and the number only says that the operation was made, the money is checked with `get`
    if (!response.ok || !/^OK\d+/.test((await response.text()).trim())) {
      throw new PaymentProviderError(
        `Robokassa answered ${response.status} to a repeat charge`,
        response.status,
      );
    }
  }

  async get(id: string): Promise<ProviderPayment> {
    if (!/^\d+$/.test(id)) throw new PaymentProviderError('Not a number of an invoice', null);
    const query = new URLSearchParams({
      MerchantLogin: this.settings.login,
      InvoiceID: id,
      Signature: this.sign([this.settings.login, id, this.settings.password2]),
    });
    let response: Response;
    try {
      response = await this.fetchImpl(`${STATE_URL}?${query.toString()}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new PaymentProviderError('Robokassa did not answer', null);
    }
    if (!response.ok) {
      throw new PaymentProviderError(`Robokassa answered ${response.status}`, response.status);
    }
    const text = await response.text();
    const result = Number(/<Result[^>]*>\s*<Code>(\d+)<\/Code>/.exec(text)?.[1]);
    if (Number.isNaN(result)) {
      throw new PaymentProviderError('Robokassa answered with an unknown shape', null);
    }
    const base = { id, confirmationUrl: null, metadata: {} } as const;
    // Not known yet is not a refusal: the learner may still be on the payment page
    if (result === RESULT_NOT_FOUND) return { ...base, status: 'pending', paymentMethod: null };
    if (result !== 0) {
      throw new PaymentProviderError(`Robokassa answered with the code ${result}`, null);
    }

    const state = Number(/<State[^>]*>\s*<Code>(\d+)<\/Code>/.exec(text)?.[1]);
    if (state === STATE_SUCCEEDED) {
      // The card is kept by the first payment of the learner who agreed (the billing checks that),
      // its number is what the next charges refer to
      return {
        ...base,
        status: 'succeeded',
        paymentMethod: { id, saved: this.settings.recurring, cardLast4: null },
      };
    }
    return {
      ...base,
      status: STATES_CANCELED.includes(state) ? 'canceled' : 'pending',
      paymentMethod: null,
    };
  }

  /**
   * ResultURL: the shop's server is told `OutSum`, `InvId` and a signature made with password 2. A notice
   * that is not signed right is not a notice. Only the invoice is taken from it, the state is asked for.
   */
  notification({ body, query }: { body: unknown; query: unknown }): ParsedNotification | null {
    const fields = { ...asRecord(query), ...asRecord(body) };
    const { OutSum: outSum, InvId: invId, SignatureValue: signature } = fields;
    if (!outSum || !invId || !signature || !/^\d+$/.test(invId)) return null;
    // Custom fields (`Shp_`) would be signed too, none are sent
    const expected = this.sign([outSum, invId, this.settings.password2]);
    if (!sameText(expected, signature)) return null;
    return { providerPaymentId: invId, reply: `OK${invId}` };
  }

  private sign(parts: string[]): string {
    return createHash(this.settings.hash).update(parts.join(':')).digest('hex');
  }
}

function asRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value !== 'object' || value === null) return out;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') out[key] = item;
  }
  return out;
}

/** The signature comes in capitals or small letters, and a comparison must not tell where it differs. */
function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase());
  const right = Buffer.from(b.toLowerCase());
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The time in milliseconds and two random digits: grows, and two payments in a millisecond rarely meet. */
function newInvoiceId(): number {
  return Date.now() * INVOICE_SPREAD + Math.floor(Math.random() * INVOICE_SPREAD);
}
