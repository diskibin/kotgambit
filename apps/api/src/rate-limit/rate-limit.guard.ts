import {
  HttpStatus,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequest } from '../auth/access-token.guard.js';
import { AppError } from '../common/app-error.js';
import { RateLimiterService } from './rate-limiter.service.js';

export interface RateLimitRule {
  /** Part of the Redis key, also how the rule shows up in logs. */
  name: string;
  limit: number;
  windowSeconds: number;
  /** What the counter is kept per: the client address, the email in the body or the signed-in user. */
  by: 'ip' | 'email' | 'user';
}

const RATE_LIMIT_KEY = 'rate-limit-rules';

export const RateLimit = (...rules: RateLimitRule[]) => SetMetadata(RATE_LIMIT_KEY, rules);

function subject(rule: RateLimitRule, request: FastifyRequest): string | null {
  if (rule.by === 'ip') return request.ip;
  // Only routes behind AccessTokenGuard have a user, and the guard runs before this one
  if (rule.by === 'user') return (request as Partial<AuthenticatedRequest>).userId ?? null;
  const email = (request.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== 'string') return null;
  // Hashed so that the key does not carry an address in the clear
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.get<RateLimitRule[] | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!rules) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    let retryAfter = 0;
    for (const rule of rules) {
      const id = subject(rule, request);
      // Without a subject (no email in the body) the validation pipe will reject the request anyway
      if (id === null) continue;
      const result = await this.limiter.consume(
        `rl:${rule.name}:${id}`,
        rule.limit,
        rule.windowSeconds,
      );
      if (!result.allowed) retryAfter = Math.max(retryAfter, result.retryAfterSeconds);
    }

    if (retryAfter > 0) {
      void context.switchToHttp().getResponse<FastifyReply>().header('Retry-After', retryAfter);
      throw new AppError('http.too_many_requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
