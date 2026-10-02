import type { RateLimitRule } from '../rate-limit/rate-limit.guard.js';

const MINUTE = 60;

// Generous for a person and tight for a script that hammers the server to learn solutions
export const PUZZLE_LIMITS = {
  nextPerUser: { name: 'puzzle-next-user', limit: 60, windowSeconds: MINUTE, by: 'user' },
  movePerUser: { name: 'puzzle-move-user', limit: 240, windowSeconds: MINUTE, by: 'user' },
  hintPerUser: { name: 'puzzle-hint-user', limit: 60, windowSeconds: MINUTE, by: 'user' },
} as const satisfies Record<string, RateLimitRule>;
