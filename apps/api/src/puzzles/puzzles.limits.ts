import type { RateLimitRule } from '../rate-limit/rate-limit.guard.js';

const MINUTE = 60;

// What a settled puzzle adds to the day: a clean solve is worth the most, a failed one still counts a little
export const PUZZLE_XP = { clean: 5, helped: 3, failed: 1 } as const;
// The time on a puzzle is capped, a puzzle left open overnight is not a night of practice
export const PUZZLE_MAX_SECONDS = 90;

// Generous for a person and tight for a script that hammers the server to learn solutions
export const PUZZLE_LIMITS = {
  nextPerUser: { name: 'puzzle-next-user', limit: 60, windowSeconds: MINUTE, by: 'user' },
  movePerUser: { name: 'puzzle-move-user', limit: 240, windowSeconds: MINUTE, by: 'user' },
  hintPerUser: { name: 'puzzle-hint-user', limit: 60, windowSeconds: MINUTE, by: 'user' },
} as const satisfies Record<string, RateLimitRule>;
