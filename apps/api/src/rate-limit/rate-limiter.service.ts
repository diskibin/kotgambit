import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window ends, only meaningful when the request is not allowed. */
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Fixed window counter. The window starts with the first hit and ends `windowSeconds` later.
   * `SET NX EX` and `INCR` run in one transaction, so the counter can never be left without an expiry.
   */
  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    try {
      const results = await this.redis.client
        .multi()
        .set(key, 0, 'EX', windowSeconds, 'NX')
        .incr(key)
        .ttl(key)
        .exec();
      const count = Number(results?.[1]?.[1]);
      const ttl = Number(results?.[2]?.[1]);
      return { allowed: count <= limit, retryAfterSeconds: Math.max(ttl, 1) };
    } catch (error) {
      // Failing open keeps sign-in working when Redis is down, the outage itself is logged
      this.logger.error(error);
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }
}
