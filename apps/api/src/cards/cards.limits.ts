import type { RateLimitRule } from '../rate-limit/rate-limit.guard.js';

export const CARD_LIMITS = {
  nextPerUser: { name: 'card-next-user', limit: 60, windowSeconds: 60, by: 'user' },
  answerPerUser: { name: 'card-answer-user', limit: 120, windowSeconds: 60, by: 'user' },
  makePerUser: { name: 'card-make-user', limit: 20, windowSeconds: 60, by: 'user' },
} as const satisfies Record<string, RateLimitRule>;

// Repeating a position is worth less than a lesson or a game, but it counts towards the day
export const CARD_XP = { correct: 3, wrong: 1 } as const;
export const CARD_SECONDS = 30;
