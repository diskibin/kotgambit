import type { EngineAnalysisResponse } from '@kotgambit/contracts';
import { isValidFen } from '@kotgambit/chess-core';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { AnalysisCache, analysisCacheKey } from './analysis-cache.js';
import { EnginePool, Priority, type PoolMetrics } from './engine-pool.js';

export const ENGINE_POOL = Symbol('ENGINE_POOL');

export interface AnalysisQuery {
  fen: string;
  depth: number;
  multipv: number;
  priority: Priority;
}

@Injectable()
export class EngineService {
  constructor(
    @Inject(ENGINE_POOL) private readonly pool: EnginePool | null,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly cache: AnalysisCache,
  ) {}

  async analyze(query: AnalysisQuery): Promise<EngineAnalysisResponse> {
    if (!this.pool || !this.config.engine) throw new AppError('server.unavailable', 503);
    if (!isValidFen(query.fen)) throw new AppError('validation.failed', HttpStatus.BAD_REQUEST);

    const key = analysisCacheKey(query.fen, query.depth, query.multipv);
    const hit = await this.cache.get(key);
    if (hit) return { ...hit, timedOut: false, cached: true };

    const analysis = await this.pool.analyze(
      { fen: query.fen, depth: query.depth, multipv: query.multipv },
      { priority: query.priority },
    );
    const result = {
      bestMove: analysis.bestMove,
      lines: analysis.lines.map(({ multipv, depth, score, pv }) => ({ multipv, depth, score, pv })),
    };
    // A search cut short by the time budget is shallower than the key promises, so it is not kept
    if (!analysis.timedOut) await this.cache.set(key, result, this.config.engine.cacheTtlSeconds);
    return { ...result, timedOut: analysis.timedOut, cached: false };
  }

  metrics(): PoolMetrics | null {
    return this.pool?.metrics() ?? null;
  }
}
