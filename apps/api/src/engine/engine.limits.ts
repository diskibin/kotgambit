import type { RateLimitRule } from '../rate-limit/rate-limit.guard.js';

// Placeholder for the first release, to be tuned against the real server size (PLAN.md 5.2).
// Per user, so that one account cannot fill the queue that everybody shares.
export const ENGINE_LIMITS = {
  analysisPerUser: { name: 'engine-analysis-user', limit: 30, windowSeconds: 60, by: 'user' },
} as const satisfies Record<string, RateLimitRule>;
