import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CONFIG, type AppConfig } from '../config/config.module.js';

/** One shared connection for rate limits now, and for the cache and one-time codes later. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(CONFIG) config: AppConfig) {
    // Fail a command fast instead of queueing it for ever when Redis is down
    this.client = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
