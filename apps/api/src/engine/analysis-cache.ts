import { EngineAnalysisResponseSchema, type EngineAnalysisResponse } from '@kotgambit/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

const CachedAnalysisSchema = EngineAnalysisResponseSchema.pick({ bestMove: true, lines: true });
export type CachedAnalysis = Pick<EngineAnalysisResponse, 'bestMove' | 'lines'>;

// Bump when the shape of a cached entry or the engine settings that shape results change
const KEY_VERSION = 'v1';

/**
 * The position without the move counters: two games reaching the same position at different move
 * numbers get the same evaluation, so they should share one cache entry.
 */
const FEN_FIELDS_IN_KEY = 4;

export function analysisCacheKey(fen: string, depth: number, multipv: number): string {
  const position = fen.trim().split(/\s+/).slice(0, FEN_FIELDS_IN_KEY).join(' ');
  return `engine:${KEY_VERSION}:${position}:${depth}:${multipv}`;
}

@Injectable()
export class AnalysisCache {
  private readonly logger = new Logger(AnalysisCache.name);

  constructor(private readonly redis: RedisService) {}

  async get(key: string): Promise<CachedAnalysis | null> {
    try {
      const raw = await this.redis.client.get(key);
      if (raw === null) return null;
      const parsed = CachedAnalysisSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch (error) {
      // A cache that is down or holds garbage only costs a search, so it must not fail the request
      this.logger.error(error);
      return null;
    }
  }

  async set(key: string, value: CachedAnalysis, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
