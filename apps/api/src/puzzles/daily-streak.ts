import type { PrismaService } from '../prisma/prisma.service.js';
import { bestStreak, computeStreak, dayKeyOf, type DayKey } from '../progress/streak.js';

// The same rule as the streak of the daily goal, with "reached" meaning "solved the puzzle of the day"
const asDays = (days: readonly DayKey[]) => days.map((day) => ({ day, seconds: 1 }));
const REACHED = 1;

/** Days in a row, up to today, on which the puzzle of the day was solved. Not lost until the day is over. */
export function currentDailyStreak(days: readonly DayKey[], today: DayKey): number {
  return computeStreak(asDays(days), REACHED, today);
}

export function bestDailyStreak(days: readonly DayKey[]): number {
  return bestStreak(asDays(days), REACHED);
}

/** The days on which the learner solved the puzzle of the day cleanly, each once. */
export async function solvedDailyDays(prisma: PrismaService, userId: string): Promise<DayKey[]> {
  const rows = await prisma.puzzleAttempt.findMany({
    where: { userId, status: 'solved', dailyDay: { not: null } },
    select: { dailyDay: true },
    distinct: ['dailyDay'],
  });
  return rows.flatMap((row) => (row.dailyDay ? [dayKeyOf(row.dailyDay)] : []));
}
