import { z } from 'zod';

export const PlanKeySchema = z.enum(['month', 'year']);
export type PlanKeyValue = z.infer<typeof PlanKeySchema>;

export const PlanSchema = z.object({
  key: PlanKeySchema,
  /** Whole rubles. */
  priceRub: z.number().int().positive(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const PlansResponseSchema = z.object({
  /** False when the shop is not set up: Premium cannot be bought, and the screen says so. */
  available: z.boolean(),
  plans: z.array(PlanSchema),
});
export type PlansResponse = z.infer<typeof PlansResponseSchema>;

/** What the learner has. `none` is a learner who never had a subscription. */
export const SubscriptionViewSchema = z.object({
  premium: z.boolean(),
  status: z.enum(['none', 'active', 'past_due', 'canceled', 'expired']),
  plan: PlanKeySchema.nullable(),
  /** The end of the paid period, ISO 8601. */
  currentPeriodEnd: z.string().nullable(),
  autoRenew: z.boolean(),
  /** The last digits of the saved card, when the provider told them. */
  cardLast4: z.string().nullable(),
});
export type SubscriptionView = z.infer<typeof SubscriptionViewSchema>;

export const CheckoutRequestSchema = z.object({
  plan: PlanKeySchema,
  /** Decides nothing about the payment, only which return page the learner is sent back to. */
  client: z.enum(['web', 'mobile']),
  /** The learner agreed to the automatic renewal. Without it the payment is paid once and not kept. */
  autoRenew: z.boolean(),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export const CheckoutResponseSchema = z.object({
  paymentId: z.uuid(),
  /** The provider's page where the learner pays. Not logged anywhere. */
  confirmationUrl: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

export const PaymentStatusSchema = z.object({
  paymentId: z.uuid(),
  /** The server's word: it comes from the provider, never from the client coming back. */
  status: z.enum(['pending', 'succeeded', 'canceled']),
  subscription: SubscriptionViewSchema,
});
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/** What a free learner gets, and what is left of it today. Premium has no limits. */
export const EntitlementsSchema = z.object({
  premium: z.boolean(),
  puzzles: z.object({
    limit: z.number().int().positive().nullable(),
    left: z.number().int().nonnegative().nullable(),
  }),
  analysis: z.object({
    limit: z.number().int().positive().nullable(),
    left: z.number().int().nonnegative().nullable(),
  }),
  /** The full review (key moments and cards from mistakes) and the repetition of cards. */
  fullReview: z.boolean(),
  cards: z.boolean(),
  /** Chapters of the tracks after the Basics. */
  allTracks: z.boolean(),
});
export type Entitlements = z.infer<typeof EntitlementsSchema>;
