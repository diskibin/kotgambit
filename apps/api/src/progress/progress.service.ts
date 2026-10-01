import type { ProgressSummary } from '@kotgambit/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { computeStreak, dayKeyOf, daysBetween, shiftDay, type DayKey } from './streak.js';

const SECONDS_IN_MINUTE = 60;
// How far back the streak is looked up, a learner with a longer one just sees the capped number
const STREAK_LOOKBACK_DAYS = 400;
// Phones in other timezones are at most a day away from the server's UTC date
const MAX_DAY_SKEW = 1;

const toDate = (day: DayKey) => new Date(`${day}T00:00:00Z`);

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** The learner's "today" as they report it, rejected when it is too far from the server's date. */
  resolveToday(localDate: string | undefined): DayKey {
    const server = dayKeyOf(new Date());
    if (!localDate) return server;
    if (Math.abs(daysBetween(server, localDate)) > MAX_DAY_SKEW) {
      throw new AppError('lesson.invalid_report', HttpStatus.BAD_REQUEST);
    }
    return localDate;
  }

  async summary(userId: string, today: DayKey): Promise<ProgressSummary> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const goalSeconds = user.dailyGoalMinutes * SECONDS_IN_MINUTE;

    const [rows, total] = await Promise.all([
      this.prisma.dailyActivity.findMany({
        where: { userId, day: { gte: toDate(shiftDay(today, -STREAK_LOOKBACK_DAYS)) } },
      }),
      this.prisma.dailyActivity.aggregate({ where: { userId }, _sum: { xp: true } }),
    ]);
    const days = rows.map((row) => ({ day: dayKeyOf(row.day), seconds: row.seconds }));

    return {
      streakDays: computeStreak(days, goalSeconds, today),
      todaySeconds: days.find((d) => d.day === today)?.seconds ?? 0,
      goalSeconds,
      xpTotal: total._sum.xp ?? 0,
    };
  }

  /** Adds time and XP to the learner's day, creating the day on first use. */
  async addActivity(
    db: Pick<PrismaService, 'dailyActivity'>,
    userId: string,
    today: DayKey,
    seconds: number,
    xp: number,
  ): Promise<void> {
    await db.dailyActivity.upsert({
      where: { userId_day: { userId, day: toDate(today) } },
      create: { userId, day: toDate(today), seconds, xp },
      update: { seconds: { increment: seconds }, xp: { increment: xp } },
    });
  }
}
