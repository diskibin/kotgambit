import { Global, Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimiterService } from './rate-limiter.service.js';

@Global()
@Module({
  providers: [RateLimiterService, RateLimitGuard],
  exports: [RateLimiterService, RateLimitGuard],
})
export class RateLimitModule {}
