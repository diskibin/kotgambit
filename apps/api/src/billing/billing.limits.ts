import type { RateLimitRule } from '../rate-limit/rate-limit.guard.js';

export const BILLING_LIMITS = {
  checkoutPerUser: { name: 'billing-checkout-user', limit: 10, windowSeconds: 60, by: 'user' },
  // The payment page asks every few seconds while the learner waits
  statusPerUser: { name: 'billing-status-user', limit: 60, windowSeconds: 60, by: 'user' },
} as const satisfies Record<string, RateLimitRule>;
