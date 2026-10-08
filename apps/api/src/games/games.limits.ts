import type { RateLimitRule } from '../rate-limit/rate-limit.guard.js';

const MINUTE = 60;

// Placeholders until they are tuned on the real server (PLAN.md 5.2). Bots are free, so these limits,
// together with the engine queue, are what keeps one account from taking the server.
export const GAME_LIMITS = {
  createPerUser: { name: 'game-create-user', limit: 10, windowSeconds: MINUTE, by: 'user' },
  movePerUser: { name: 'game-move-user', limit: 40, windowSeconds: MINUTE, by: 'user' },
  hintPerUser: { name: 'game-hint-user', limit: 20, windowSeconds: MINUTE, by: 'user' },
} as const satisfies Record<string, RateLimitRule>;

/** Games a learner may have open at once, so that abandoned games do not pile up. */
export const MAX_ACTIVE_GAMES = 3;

export const HINTS_PER_GAME = 10;

// Gentle on purpose: a loss still teaches something and the cat never punishes it (PLAN.md 14.2)
export const GAME_XP = { win: 30, draw: 15, loss: 10 } as const;

// A game left open for a day is not a day of playing, so the time that counts is capped
export const MAX_GAME_SECONDS = 20 * 60;

export const HINT_DEPTH = 12;
