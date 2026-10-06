import type { AdminStats } from '@kotgambit/contracts';
import { Injectable } from '@nestjs/common';
import { hasPremium } from '../billing/subscription-machine.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dayKey, periodDays, periodStart } from './stats.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const WEEK = 7;
const MONTH = 30;

interface DayCount {
  day: string;
  n: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** The numbers of the admin page for the last `days` UTC days, today included. */
  async stats(days: number, now: Date = new Date()): Promise<AdminStats> {
    const since = periodStart(now, days);
    const [funnel, daily, users, premium, usage] = await Promise.all([
      this.funnel(since),
      this.daily(now, days, since),
      this.users(now, since),
      this.premium(now, since),
      this.usage(since),
    ]);
    return { days, funnel, daily, users, premium, usage };
  }

  private async funnel(since: Date): Promise<AdminStats['funnel']> {
    const steps = await this.prisma.$queryRaw<{ name: string; n: number }[]>`
      SELECT name::text AS name, count(DISTINCT visitor_id)::int AS n
      FROM analytics_events WHERE created_at >= ${since} GROUP BY name`;
    const count = (name: string) => steps.find((step) => step.name === name)?.n ?? 0;
    // Paid counts learners, not visitors: the payment is tied to an account and knows nothing of a visitor id.
    // Only payments made on the site belong in the funnel of the site.
    const [paid] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT user_id)::int AS n FROM payments
      WHERE status = 'succeeded' AND purpose = 'initial' AND client = 'web' AND paid_at >= ${since}`;
    return {
      visitors: count('visit'),
      signedIn: count('signed_in'),
      premiumView: count('premium_view'),
      checkoutStart: count('checkout_start'),
      paid: paid?.n ?? 0,
    };
  }

  private async daily(now: Date, days: number, since: Date): Promise<AdminStats['daily']> {
    const [visitors, registrations, payments] = await Promise.all([
      this.prisma.$queryRaw<DayCount[]>`
        SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(DISTINCT visitor_id)::int AS n
        FROM analytics_events WHERE name = 'visit' AND created_at >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<DayCount[]>`
        SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::int AS n
        FROM users WHERE created_at >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<{ day: string; n: number; revenue: bigint }[]>`
        SELECT to_char(paid_at, 'YYYY-MM-DD') AS day, count(*)::int AS n,
               coalesce(sum(amount_kopecks), 0)::bigint AS revenue
        FROM payments WHERE status = 'succeeded' AND paid_at >= ${since} GROUP BY 1`,
    ]);
    const at = (rows: DayCount[], day: string) => rows.find((row) => row.day === day)?.n ?? 0;
    return periodDays(now, days).map((day) => {
      const paid = payments.find((row) => row.day === day);
      return {
        day,
        visitors: at(visitors, day),
        registrations: at(registrations, day),
        payments: paid?.n ?? 0,
        revenueKopecks: Number(paid?.revenue ?? 0),
      };
    });
  }

  private async users(now: Date, since: Date): Promise<AdminStats['users']> {
    const active = async (days: number) => {
      const from = dayKey(new Date(now.getTime() - (days - 1) * MS_IN_DAY));
      const [row] = await this.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(DISTINCT user_id)::int AS n FROM daily_activity WHERE day >= ${from}::date`;
      return row?.n ?? 0;
    };
    const [total, registered, dau, wau, mau] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      active(1),
      active(WEEK),
      active(MONTH),
    ]);
    return { total, registered, dau, wau, mau };
  }

  private async premium(now: Date, since: Date): Promise<AdminStats['premium']> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: { not: 'expired' } },
      select: { planKey: true, status: true, currentPeriodEnd: true, autoRenew: true },
    });
    const current = subscriptions.filter((row) => hasPremium(row, now));

    const paidWhere = (extra: Prisma.PaymentWhereInput = {}): Prisma.PaymentWhereInput => ({
      status: 'succeeded',
      paidAt: { gte: since },
      ...extra,
    });
    const [newUsers, renewals, failed, revenue, total] = await Promise.all([
      this.prisma.payment.groupBy({ by: ['userId'], where: paidWhere({ purpose: 'initial' }) }),
      this.prisma.payment.count({ where: paidWhere({ purpose: 'renewal' }) }),
      this.prisma.payment.count({ where: { status: 'canceled', createdAt: { gte: since } } }),
      this.prisma.payment.aggregate({ where: paidWhere(), _sum: { amountKopecks: true } }),
      this.prisma.payment.aggregate({
        where: { status: 'succeeded' },
        _sum: { amountKopecks: true },
      }),
    ]);
    return {
      active: current.length,
      month: current.filter((row) => row.planKey === 'month').length,
      year: current.filter((row) => row.planKey === 'year').length,
      autoRenew: current.filter((row) => row.autoRenew).length,
      canceledPaid: current.filter((row) => row.status === 'canceled').length,
      newInPeriod: newUsers.length,
      renewalsInPeriod: renewals,
      failedPayments: failed,
      revenueKopecks: revenue._sum.amountKopecks ?? 0,
      totalRevenueKopecks: total._sum.amountKopecks ?? 0,
    };
  }

  private async usage(since: Date): Promise<AdminStats['usage']> {
    const [gamesStarted, gamesFinished, puzzlesStarted, puzzlesSolved, lessonsCompleted, reviews] =
      await Promise.all([
        this.prisma.game.count({ where: { startedAt: { gte: since } } }),
        this.prisma.game.count({ where: { finishedAt: { gte: since } } }),
        this.prisma.puzzleAttempt.count({ where: { startedAt: { gte: since } } }),
        this.prisma.puzzleAttempt.count({ where: { status: 'solved', startedAt: { gte: since } } }),
        this.prisma.lessonProgress.count({ where: { completedAt: { gte: since } } }),
        this.prisma.gameReview.count({ where: { status: 'done', finishedAt: { gte: since } } }),
      ]);
    return {
      gamesStarted,
      gamesFinished,
      puzzlesStarted,
      puzzlesSolved,
      lessonsCompleted,
      reviewsDone: reviews,
    };
  }
}
