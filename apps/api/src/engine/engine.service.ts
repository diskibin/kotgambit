import type { EngineAnalysisResponse } from '@kotgambit/contracts';
import { isValidFen } from '@kotgambit/chess-core';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { AnalysisCache, analysisCacheKey } from './analysis-cache.js';
import { EnginePool, Priority, type PoolMetrics } from './engine-pool.js';
import type { Analysis, EngineStrength } from './uci-engine.js';

// A bot move may wait for the engine this long beyond its own thinking time before it counts as lost
const BOT_MOVE_GRACE_MS = 1500;

export interface BotSearch {
  fen: string;
  strength: EngineStrength;
  depth?: number;
  movetimeMs: number;
  /** How many lines to ask for, so that a bot that makes mistakes has something to choose from. */
  candidates: number;
}

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

  /**
   * A search for a bot's move: the highest priority, a budget fixed by the bot's profile and no cache,
   * since a cached answer would make the bot play the same move in the same position every time.
   */
  async botMove(search: BotSearch): Promise<Analysis> {
    if (!this.pool || !this.config.engine) throw new AppError('server.unavailable', 503);
    return this.pool.analyze(
      {
        fen: search.fen,
        movetimeMs: search.movetimeMs,
        multipv: search.candidates,
        strength: search.strength,
        ...(search.depth === undefined ? {} : { depth: search.depth }),
      },
      { priority: Priority.Bot, timeoutMs: search.movetimeMs + BOT_MOVE_GRACE_MS },
    );
  }

  metrics(): PoolMetrics | null {
    return this.pool?.metrics() ?? null;
  }
}
