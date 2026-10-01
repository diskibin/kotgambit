import type { RateLimitRule } from '../rate-limit/rate-limit.guard.js';

const MINUTE = 60;
const HOUR = 60 * MINUTE;

// The per-email limit stops guessing one account's password from many addresses, the per-IP limit
// stops one address from trying many accounts. Window sizes follow the usual login throttling advice.
export const AUTH_LIMITS = {
  registerPerIp: { name: 'register-ip', limit: 5, windowSeconds: HOUR, by: 'ip' },
  loginPerIp: { name: 'login-ip', limit: 30, windowSeconds: 15 * MINUTE, by: 'ip' },
  loginPerEmail: { name: 'login-email', limit: 5, windowSeconds: 15 * MINUTE, by: 'email' },
  refreshPerIp: { name: 'refresh-ip', limit: 60, windowSeconds: MINUTE, by: 'ip' },
} as const satisfies Record<string, RateLimitRule>;
