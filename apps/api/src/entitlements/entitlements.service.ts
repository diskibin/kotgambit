import type { Entitlements } from '@kotgambit/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { BillingService } from '../billing/billing.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dayKeyOf } from '../progress/streak.js';
import { RedisService } from '../redis/redis.service.js';

// The free limits of the design (web/screens and mobile/screens, the table of Free and Premium)
export const FREE_PUZZLES_PER_DAY = 10;
export const FREE_ANALYSES_PER_DAY = 3;

// The counter of a day outlives the day a little, so that a learner in a far timezone is not reset early
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

/**
 * What a learner may do, decided in one place (PLAN.md 6.8): no controller compares a plan by hand.
 * The days are UTC days, as everywhere on the server.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly billing: BillingService,
  ) {}

  async get(userId: string): Promise<Entitlements> {
    const premium = await this.billing.isPremium(userId);
    if (premium) {
      return {
        premium,
        puzzles: { limit: null, left: null },
        analysis: { limit: null, left: null },
        fullReview: true,
        cards: true,
      };
    }
    const [puzzlesToday, analysesToday] = await Promise.all([
      this.puzzlesToday(userId),
      this.analysesToday(userId),
    ]);
    return {
      premium,
      puzzles: {
        limit: FREE_PUZZLES_PER_DAY,
        left: Math.max(0, FREE_PUZZLES_PER_DAY - puzzlesToday),
      },
      analysis: {
        limit: FREE_ANALYSES_PER_DAY,
        left: Math.max(0, FREE_ANALYSES_PER_DAY - analysesToday),
      },
      fullReview: false,
      cards: false,
    };
  }

  isPremium(userId: string): Promise<boolean> {
    return this.billing.isPremium(userId);
  }

  async requirePremium(userId: string): Promise<void> {
    if (!(await this.billing.isPremium(userId))) {
      throw new AppError('premium.required', HttpStatus.FORBIDDEN);
    }
  }

  async assertPuzzleAllowed(userId: string): Promise<void> {
    if (await this.billing.isPremium(userId)) return;
    if ((await this.puzzlesToday(userId)) >= FREE_PUZZLES_PER_DAY) {
      throw new AppError('puzzle.limit', HttpStatus.FORBIDDEN);
    }
  }

  async assertAnalysisAllowed(userId: string): Promise<void> {
    if (await this.billing.isPremium(userId)) return;
    if ((await this.analysesToday(userId)) >= FREE_ANALYSES_PER_DAY) {
      throw new AppError('analysis.limit', HttpStatus.FORBIDDEN);
    }
  }

  /** Counted after the analysis succeeded, so that a busy engine does not use up the day. */
  async recordAnalysis(userId: string): Promise<void> {
    const key = this.analysisKey(userId);
    await this.redis.client.incr(key);
    await this.redis.client.expire(key, COUNTER_TTL_SECONDS);
  }

  /** Puzzles started today, whatever came of them: a skipped puzzle was still shown. */
  private puzzlesToday(userId: string): Promise<number> {
    const start = new Date(`${dayKeyOf(new Date())}T00:00:00Z`);
    return this.prisma.puzzleAttempt.count({ where: { userId, startedAt: { gte: start } } });
  }

  private async analysesToday(userId: string): Promise<number> {
    return Number((await this.redis.client.get(this.analysisKey(userId))) ?? 0);
  }

  private analysisKey(userId: string): string {
    return `entitlements:analysis:${userId}:${dayKeyOf(new Date())}`;
  }
}
