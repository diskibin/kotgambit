import type {
  AdminUser,
  AdminUserList,
  GrantPremiumRequest,
  RevokePremiumRequest,
} from '@kotgambit/contracts';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { hasPremium } from '../billing/subscription-machine.js';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toAdminPayment } from './payments.service.js';
import { dayKey } from './stats.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const FOUND_LIMIT = 10;
const PAYMENTS_SHOWN = 10;
const ACTIONS_SHOWN = 20;

type AdminAction = AdminUser['actions'][number]['action'];

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, now: Date = new Date()): Promise<AdminUserList> {
    const rows = await this.prisma.user.findMany({
      where: { email: { contains: query, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: FOUND_LIMIT,
      include: { subscription: true },
    });
    return {
      users: rows.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        createdAt: row.createdAt.toISOString(),
        premium: row.subscription ? hasPremium(row.subscription, now) : false,
      })),
    };
  }

  async detail(id: string, now: Date = new Date()): Promise<AdminUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
        credential: { select: { userId: true } },
        identities: { select: { provider: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: PAYMENTS_SHOWN },
      },
    });
    if (!user) throw new AppError('http.not_found', HttpStatus.NOT_FOUND);

    const [activity, lessonsCompleted, puzzlesSolved, gamesPlayed, actions] = await Promise.all([
      this.prisma.dailyActivity.aggregate({
        where: { userId: id },
        _max: { day: true },
        _sum: { xp: true },
      }),
      this.prisma.lessonProgress.count({ where: { userId: id } }),
      this.prisma.puzzleAttempt.count({ where: { userId: id, status: 'solved' } }),
      this.prisma.game.count({ where: { userId: id } }),
      this.prisma.adminAction.findMany({
        where: { targetUserId: id },
        orderBy: { createdAt: 'desc' },
        take: ACTIONS_SHOWN,
      }),
    ]);

    const subscription = user.subscription;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
      lastActiveDay: activity._max.day ? dayKey(activity._max.day) : null,
      xpTotal: activity._sum.xp ?? 0,
      lessonsCompleted,
      puzzlesSolved,
      gamesPlayed,
      hasPassword: user.credential !== null,
      providers: user.identities.map((identity) => identity.provider),
      subscription: subscription
        ? {
            premium: hasPremium(subscription, now),
            status: subscription.status,
            plan: subscription.planKey as 'month' | 'year',
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            autoRenew: subscription.autoRenew,
            cardLast4: subscription.cardLast4,
          }
        : null,
      payments: user.payments.map(toAdminPayment),
      actions: actions.map((row) => ({
        createdAt: row.createdAt.toISOString(),
        adminEmail: row.adminEmail,
        action: row.action as AdminAction,
        details: row.details,
      })),
    };
  }

  /**
   * Gives Premium without a payment, counted from the end of what the learner has paid for, or from now.
   * It is a month plan with no card and no renewal, the log says why. A real subscription keeps its card.
   */
  async grant(
    adminId: string,
    id: string,
    body: GrantPremiumRequest,
    now: Date = new Date(),
  ): Promise<AdminUser> {
    await this.requireUser(id);
    const row = await this.prisma.subscription.findUnique({ where: { userId: id } });
    const from =
      row && hasPremium(row, now) && row.currentPeriodEnd > now ? row.currentPeriodEnd : now;
    const currentPeriodEnd = new Date(from.getTime() + body.days * MS_IN_DAY);
    await this.prisma.subscription.upsert({
      where: { userId: id },
      create: {
        userId: id,
        planKey: 'month',
        status: 'active',
        currentPeriodEnd,
        autoRenew: false,
      },
      update: { status: 'active', currentPeriodEnd },
    });
    await this.log(adminId, 'grant_premium', id, `${body.days} дн.: ${body.reason}`);
    return this.detail(id, now);
  }

  /** Takes Premium away at once and forgets the saved card, so that nothing is charged any more. */
  async revoke(
    adminId: string,
    id: string,
    body: RevokePremiumRequest,
    now: Date = new Date(),
  ): Promise<AdminUser> {
    await this.requireUser(id);
    await this.prisma.subscription.updateMany({
      where: { userId: id },
      data: {
        status: 'expired',
        currentPeriodEnd: now,
        autoRenew: false,
        paymentMethodId: null,
        cardLast4: null,
      },
    });
    await this.log(adminId, 'revoke_premium', id, body.reason);
    return this.detail(id, now);
  }

  private async requireUser(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new AppError('http.not_found', HttpStatus.NOT_FOUND);
  }

  private async log(
    adminId: string,
    action: AdminAction,
    targetUserId: string,
    details: string,
  ): Promise<void> {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true },
    });
    await this.prisma.adminAction.create({
      data: { adminEmail: admin?.email ?? 'unknown', action, targetUserId, details },
    });
    // The id only: an address does not go to the log of the server
    this.logger.log(`An admin did ${action} to ${targetUserId}`);
  }
}
