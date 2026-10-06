import type { ServerHealth } from '@kotgambit/contracts';
import { Injectable } from '@nestjs/common';
import { EngineService } from '../engine/engine.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const BYTES_IN_MB = 1024 * 1024;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly engine: EngineService,
  ) {}

  async check(now: Date = new Date()): Promise<ServerHealth> {
    const [database, redis, active, pending, running, failedDay] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.probe(() => this.redis.client.ping()),
      this.prisma.game.count({ where: { status: 'active' } }),
      this.prisma.gameReview.count({ where: { status: 'pending' } }),
      this.prisma.gameReview.count({ where: { status: 'running' } }),
      this.prisma.gameReview.count({
        where: { status: 'failed', createdAt: { gte: new Date(now.getTime() - MS_IN_DAY) } },
      }),
    ]);
    return {
      engine: this.engine.metrics(),
      database,
      redis,
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / BYTES_IN_MB),
        node: process.version,
      },
      games: { active },
      reviews: { pending, running, failedDay },
    };
  }

  /** How long a call takes, and whether it worked: a slow or failed one is what the owner looks for. */
  private async probe(call: () => PromiseLike<unknown>): Promise<{ ok: boolean; ms: number }> {
    const started = performance.now();
    try {
      await call();
      return { ok: true, ms: Math.round(performance.now() - started) };
    } catch {
      return { ok: false, ms: Math.round(performance.now() - started) };
    }
  }
}
