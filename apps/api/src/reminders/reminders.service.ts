import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { readUnsubscribeToken, unsubscribeToken } from './reminder-token.js';

const MS_IN_MINUTE = 60 * 1000;
const MS_IN_DAY = 24 * 60 * MS_IN_MINUTE;
// A learner is reminded after this many days without a lesson, a puzzle or a game
const QUIET_DAYS = 2;
// and not more often than this, however long they stay away
const REPEAT_AFTER_DAYS = 7;
// A burst of letters looks like spam to the mail provider; the rest goes out at the next check
const BATCH = 200;

@Injectable()
export class RemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    const { checkMinutes } = this.config.reminders;
    if (checkMinutes === 0) return;
    this.timer = setInterval(() => {
      void this.runScheduled(new Date()).catch((error: unknown) => this.logger.error(error));
    }, checkMinutes * MS_IN_MINUTE);
    // A timer must not keep the process alive on its own
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** The address that switches the reminders off for one learner, for the link in a letter. */
  unsubscribeUrl(userId: string): string {
    const token = unsubscribeToken(this.config.jwtAccessSecret, userId);
    return `${this.config.webUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  /** Switches the reminders off for the owner of a token. `false` when the token is not ours. */
  async unsubscribe(token: string): Promise<boolean> {
    const userId = readUnsubscribeToken(this.config.jwtAccessSecret, token);
    if (!userId) return false;
    // An account that is gone has nothing left to switch off, which is the same answer
    await this.prisma.user.updateMany({ where: { id: userId }, data: { remindersEnabled: false } });
    return true;
  }

  /** Sends what is due, only in the hour of the day that is set. Returns how many letters went out. */
  async runScheduled(now: Date): Promise<number> {
    if (now.getUTCHours() !== this.config.reminders.hourUtc) return 0;

    const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    // Quiet for QUIET_DAYS: no activity yesterday and none today
    const lastBusyDay = new Date(today.getTime() - (QUIET_DAYS - 1) * MS_IN_DAY);
    const due = await this.prisma.user.findMany({
      where: {
        remindersEnabled: true,
        // A letter to an address nobody has confirmed may reach a stranger
        emailVerifiedAt: { not: null },
        createdAt: { lte: new Date(now.getTime() - QUIET_DAYS * MS_IN_DAY) },
        OR: [
          { lastReminderAt: null },
          { lastReminderAt: { lte: new Date(now.getTime() - REPEAT_AFTER_DAYS * MS_IN_DAY) } },
        ],
        dailyActivity: { none: { day: { gte: lastBusyDay } } },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      select: { id: true, email: true, displayName: true, dailyGoalMinutes: true },
    });

    let sent = 0;
    for (const user of due) {
      try {
        await this.mail.sendReminder(user.email, {
          name: user.displayName,
          goalMinutes: user.dailyGoalMinutes,
          learnUrl: `${this.config.webUrl}/learn`,
          unsubscribeUrl: this.unsubscribeUrl(user.id),
        });
        // Only after the letter has gone, so that a failure is tried again at the next check
        await this.prisma.user.update({ where: { id: user.id }, data: { lastReminderAt: now } });
        sent += 1;
      } catch (error) {
        // No address in the log: the id is enough to find the account
        this.logger.warn(
          `A reminder to ${user.id} was not sent: ${error instanceof Error ? error.message : 'error'}`,
        );
      }
    }
    return sent;
  }
}
