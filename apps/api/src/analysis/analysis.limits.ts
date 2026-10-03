import type { RateLimitRule } from '../rate-limit/rate-limit.guard.js';

// Placeholders until they are tuned on the real server (PLAN.md 5.2)
export const ANALYSIS_LIMITS = {
  positionPerUser: { name: 'analysis-position-user', limit: 20, windowSeconds: 60, by: 'user' },
  reviewPerUser: { name: 'analysis-review-user', limit: 20, windowSeconds: 60, by: 'user' },
} as const satisfies Record<string, RateLimitRule>;
