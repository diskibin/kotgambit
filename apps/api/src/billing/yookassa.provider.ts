import { z } from 'zod';
import {
  PaymentProviderError,
  type CreatePaymentInput,
  type PaymentProvider,
  type ProviderPayment,
} from './payment-provider.js';

// From the official reference, https://yookassa.ru/developers/api (checked October 2026)
const API_URL = 'https://api.yookassa.ru/v3/payments';
const TIMEOUT_MS = 10_000;
const KOPECKS_IN_RUBLE = 100;

const PaymentResponseSchema = z.object({
  id: z.string().min(1),
  // `waiting_for_capture` does not happen with `capture: true`, it is kept as waiting if it ever does
  status: z.string(),
  confirmation: z.object({ confirmation_url: z.string().optional() }).optional(),
  payment_method: z
    .object({
      id: z.string(),
      saved: z.boolean().optional(),
      card: z.object({ last4: z.string().optional() }).optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** "149.00" for 14900 kopecks, YooKassa wants the amount as a string with two decimals. */
export function formatAmount(kopecks: number): string {
  return (kopecks / KOPECKS_IN_RUBLE).toFixed(2);
}

function toProviderPayment(raw: z.infer<typeof PaymentResponseSchema>): ProviderPayment {
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw.metadata ?? {})) metadata[key] = String(value);
  return {
    id: raw.id,
    status:
      raw.status === 'succeeded' ? 'succeeded' : raw.status === 'canceled' ? 'canceled' : 'pending',
    confirmationUrl: raw.confirmation?.confirmation_url ?? null,
    paymentMethod: raw.payment_method
      ? {
          id: raw.payment_method.id,
          saved: raw.payment_method.saved === true,
          cardLast4: raw.payment_method.card?.last4 ?? null,
        }
      : null,
    metadata,
  };
}

/** The YooKassa API over `fetch`: Basic authorization with the shop and the secret key. */
export class YooKassaProvider implements PaymentProvider {
  private readonly authorization: string;

  constructor(
    shopId: string,
    secretKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.authorization = `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;
  }

  async create(input: CreatePaymentInput): Promise<ProviderPayment> {
    const body = {
      amount: { value: formatAmount(input.amountKopecks), currency: 'RUB' },
      capture: true,
      description: input.description,
      metadata: input.metadata,
      ...(input.returnUrl
        ? { confirmation: { type: 'redirect', return_url: input.returnUrl } }
        : {}),
      ...(input.savePaymentMethod ? { save_payment_method: true } : {}),
      ...(input.paymentMethodId ? { payment_method_id: input.paymentMethodId } : {}),
    };
    return this.request(API_URL, {
      method: 'POST',
      headers: { 'Idempotence-Key': input.idempotencyKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  get(id: string): Promise<ProviderPayment> {
    return this.request(`${API_URL}/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  private async request(url: string, init: RequestInit): Promise<ProviderPayment> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: { Authorization: this.authorization, ...(init.headers as Record<string, string>) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new PaymentProviderError('YooKassa did not answer', null);
    }
    if (!response.ok) {
      // The error body names the problem (code, description) but may echo request data, so only the status is kept
      throw new PaymentProviderError(`YooKassa answered ${response.status}`, response.status);
    }
    const parsed = PaymentResponseSchema.safeParse(await response.json());
    if (!parsed.success)
      throw new PaymentProviderError('YooKassa answered with an unknown shape', null);
    return toProviderPayment(parsed.data);
  }
}
