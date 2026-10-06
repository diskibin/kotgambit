import type { AdminPayment, PaymentsStats } from '@kotgambit/contracts';
import { Injectable } from '@nestjs/common';
import type { Payment } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { periodStart } from './stats.js';

const RECENT_PAYMENTS = 20;
const TOP_FAILURES = 10;
const PLANS = ['month', 'year'] as const;

export function toAdminPayment(row: Payment): AdminPayment {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    plan: row.planKey as AdminPayment['plan'],
    purpose: row.purpose,
    status: row.status,
    amountKopecks: row.amountKopecks,
    client: row.client,
    cancelReason: row.cancelReason,
  };
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(days: number, now: Date = new Date()): Promise<PaymentsStats> {
    const since = periodStart(now, days);
    const [byPlan, churned, pastDue, failures, recent] = await Promise.all([
      this.prisma.$queryRaw<{ plan: string; started: number; paid: number }[]>`
        SELECT plan_key AS plan, count(*)::int AS started,
          count(*) FILTER (WHERE status = 'succeeded')::int AS paid
        FROM payments WHERE purpose = 'initial' AND created_at >= ${since} GROUP BY plan_key`,
      this.prisma.subscription.count({
        where: { status: 'expired', currentPeriodEnd: { gte: since } },
      }),
      this.prisma.subscription.count({ where: { status: 'past_due' } }),
      this.prisma.$queryRaw<{ reason: string; count: number }[]>`
        SELECT coalesce(cancel_reason, 'unknown') AS reason, count(*)::int AS count
        FROM payments WHERE status = 'canceled' AND created_at >= ${since}
        GROUP BY 1 ORDER BY 2 DESC LIMIT ${TOP_FAILURES}`,
      this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: RECENT_PAYMENTS,
        include: { user: { select: { email: true } } },
      }),
    ]);
    return {
      days,
      byPlan: PLANS.map((plan) => {
        const row = byPlan.find((candidate) => candidate.plan === plan);
        return { plan, started: row?.started ?? 0, paid: row?.paid ?? 0 };
      }),
      churned,
      pastDue,
      failures,
      recent: recent.map((row) => ({ ...toAdminPayment(row), email: row.user.email })),
    };
  }
}
