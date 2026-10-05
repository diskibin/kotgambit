export type ProviderPaymentStatus = 'pending' | 'succeeded' | 'canceled';

export interface ProviderPayment {
  id: string;
  status: ProviderPaymentStatus;
  /** Where the learner confirms the payment, only for a payment that needs them. */
  confirmationUrl: string | null;
  /** The payment method the provider kept, when the learner agreed to the autopayment. */
  paymentMethod: { id: string; saved: boolean; cardLast4: string | null } | null;
  /** What we put in at creation, comes back so that a payment can be matched to its learner. */
  metadata: Record<string, string>;
}

export interface CreatePaymentInput {
  amountKopecks: number;
  description: string;
  /** For a payment the learner confirms: where the provider sends them back. */
  returnUrl?: string;
  /** The same key gives the same payment, so a repeated request is never a second charge. */
  idempotencyKey: string;
  /** Keep the payment method for autopayments, only with the learner's agreement. */
  savePaymentMethod?: boolean;
  /** Where the receipt goes, when the provider is set up to send one. */
  customerEmail?: string | undefined;
  /** Charge a payment method that was saved earlier, without the learner. */
  paymentMethodId?: string;
  metadata: Record<string, string>;
}

/** The part of a payment provider the billing needs, so that tests use a fake and no network. */
export interface PaymentProvider {
  create(input: CreatePaymentInput): Promise<ProviderPayment>;
  /** The state of a payment as the provider has it now: the one source to believe (PLAN.md 6.8). */
  get(id: string): Promise<ProviderPayment>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/** The provider refused or could not be reached. The message never holds a key. */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    /** The HTTP status, or `null` when there was no answer. */
    readonly status: number | null,
  ) {
    super(message);
  }
}
