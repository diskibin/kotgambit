import type { AccessoryKey, Profile, Wardrobe } from '@kotgambit/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { CardsService } from '../cards/cards.service.js';
import { BotsService } from '../games/bots.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PuzzleThemesService } from '../puzzles/puzzle-themes.service.js';
import { bestDailyStreak, solvedDailyDays } from '../puzzles/daily-streak.js';
import { evaluateAchievements, type AchievementStats } from '../progress/achievements.js';
import { levelOf } from '../progress/levels.js';
import { ProgressService } from '../progress/progress.service.js';
import { bestStreak, computeStreak, dayKeyOf, shiftDay } from '../progress/streak.js';
import { monthDays, ratingHistory } from './history.js';
import { buildWardrobe } from './wardrobe.js';

const SECONDS_IN_MINUTE = 60;
const WEEK_DAYS = 7;
// Themes need a few attempts before a percentage says anything, and only the recent ones count
const MIN_THEME_ATTEMPTS = 3;
const THEME_ATTEMPTS_LOOKED_AT = 500;
const MAX_THEMES = 6;
const PERCENT = 100;
const BASICS_TRACK = 'basics';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
    private readonly cards: CardsService,
    private readonly bots: BotsService,
    private readonly themes: PuzzleThemesService,
  ) {}

  async profile(userId: string, localDate: string | undefined): Promise<Profile> {
    const today = this.progress.resolveToday(localDate);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const goalSeconds = user.dailyGoalMinutes * SECONDS_IN_MINUTE;

    const [activity, xp, puzzleStats, games, reviews, lessons] = await Promise.all([
      this.prisma.dailyActivity.findMany({ where: { userId } }),
      this.prisma.dailyActivity.aggregate({ where: { userId }, _sum: { xp: true } }),
      this.prisma.userPuzzleStats.findUnique({ where: { userId } }),
      this.prisma.game.findMany({
        where: { userId, status: 'finished' },
        select: { botId: true, outcome: true, endReason: true },
      }),
      this.prisma.gameReview.count({ where: { status: 'done', game: { userId } } }),
      this.lessonFacts(userId),
    ]);

    const days = activity.map((row) => ({ day: dayKeyOf(row.day), seconds: row.seconds }));
    const xpTotal = xp._sum.xp ?? 0;
    const bear = this.bots.profiles().find((bot) => bot.kind === 'bear');
    const stats: AchievementStats = {
      lessonsCompleted: lessons.completed,
      basicsComplete: lessons.basicsComplete,
      bestStreakDays: bestStreak(days, goalSeconds),
      bestPuzzleStreak: puzzleStats?.bestStreak ?? 0,
      bestDailyPuzzleStreak: bestDailyStreak(await solvedDailyDays(this.prisma, userId)),
      matesDelivered: games.filter((g) => g.outcome === 'win' && g.endReason === 'checkmate')
        .length,
      gamesReviewed: reviews,
      winsAgainstBear: games.filter((g) => g.outcome === 'win' && g.botId === bear?.id).length,
    };

    const achievements = await this.achievements(userId, stats);
    const puzzlesSolved = puzzleStats?.solved ?? 0;

    return {
      displayName: user.displayName,
      memberSince: dayKeyOf(user.createdAt),
      level: levelOf(xpTotal),
      xpTotal,
      streak: { current: computeStreak(days, goalSeconds, today), best: stats.bestStreakDays },
      puzzles: {
        rating: Math.round(puzzleStats?.rating ?? 1000),
        solved: puzzleStats?.solved ?? 0,
      },
      games: {
        played: games.length,
        wins: games.filter((g) => g.outcome === 'win').length,
        draws: games.filter((g) => g.outcome === 'draw').length,
        losses: games.filter((g) => g.outcome === 'loss').length,
      },
      week: Array.from({ length: WEEK_DAYS }, (_, index) => {
        const day = shiftDay(today, index - (WEEK_DAYS - 1));
        return {
          day,
          done: days.some((d) => d.day === day && d.seconds >= goalSeconds),
          today: day === today,
        };
      }),
      month: monthDays(today, days, goalSeconds),
      ratingHistory: await this.ratings(userId, today),
      achievements,
      themes: await this.themeAccuracy(userId),
      cards: await this.cards.summary(userId),
      wardrobe: buildWardrobe(user.accessory as AccessoryKey, {
        achievements,
        puzzlesSolved,
        bestStreakDays: stats.bestStreakDays,
      }),
    };
  }

  /** Puts an item on the cat. Only an opened one can be worn: the rules are the server's, never the client's. */
  async setAccessory(userId: string, accessory: AccessoryKey): Promise<Wardrobe> {
    const { wardrobe } = await this.profile(userId, undefined);
    if (!wardrobe.items.some((item) => item.key === accessory && item.unlocked)) {
      throw new AppError('wardrobe.locked', HttpStatus.FORBIDDEN);
    }
    await this.prisma.user.update({ where: { id: userId }, data: { accessory } });
    return (await this.profile(userId, undefined)).wardrobe;
  }

  /** The rating at the end of each of the last weeks, for the graph of the profile. */
  private async ratings(userId: string, today: string) {
    const attempts = await this.prisma.puzzleAttempt.findMany({
      where: { userId, ratingAfter: { not: null } },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true, ratingBefore: true, ratingAfter: true },
    });
    return ratingHistory(
      today,
      attempts.flatMap((a) =>
        a.ratingAfter === null ? [] : [{ ...a, ratingAfter: a.ratingAfter }],
      ),
    );
  }

  /** Lessons finished, and whether the whole Basics track is among them. */
  private async lessonFacts(userId: string) {
    const [completed, basics, basicsDone] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { userId } }),
      this.prisma.lesson.count({ where: { track: BASICS_TRACK } }),
      this.prisma.lessonProgress.count({ where: { userId, lesson: { track: BASICS_TRACK } } }),
    ]);
    return { completed, basicsComplete: basics > 0 && basicsDone >= basics };
  }

  /** Remembers what was reached, so that an achievement stays even if the numbers it came from change. */
  private async achievements(userId: string, stats: AchievementStats) {
    const evaluated = evaluateAchievements(stats);
    const reached = evaluated.filter((a) => a.unlocked);
    if (reached.length > 0) {
      await this.prisma.userAchievement.createMany({
        data: reached.map((a) => ({ userId, key: a.key })),
        skipDuplicates: true,
      });
    }
    const kept = new Set(
      (await this.prisma.userAchievement.findMany({ where: { userId } })).map((a) => a.key),
    );
    return evaluated.map((a) => ({ ...a, unlocked: a.unlocked || kept.has(a.key) }));
  }

  /** The share of puzzles solved on the first try per theme, the weakest themes first. */
  private async themeAccuracy(userId: string): Promise<Profile['themes']> {
    const attempts = await this.prisma.puzzleAttempt.findMany({
      where: { userId, rated: true, status: { in: ['solved', 'failed'] } },
      orderBy: { startedAt: 'desc' },
      take: THEME_ATTEMPTS_LOOKED_AT,
      select: {
        status: true,
        mistakes: true,
        hintLevel: true,
        puzzle: { select: { themes: true } },
      },
    });
    const byTheme = new Map<string, { attempts: number; clean: number }>();
    for (const attempt of attempts) {
      const clean =
        attempt.status === 'solved' && attempt.mistakes === 0 && attempt.hintLevel === 0;
      for (const key of attempt.puzzle.themes) {
        const entry = byTheme.get(key) ?? { attempts: 0, clean: 0 };
        entry.attempts += 1;
        entry.clean += clean ? 1 : 0;
        byTheme.set(key, entry);
      }
    }
    return [...byTheme.entries()]
      .filter(([, entry]) => entry.attempts >= MIN_THEME_ATTEMPTS)
      .flatMap(([key, entry]) => {
        const label = this.themes.label(key);
        return label
          ? [
              {
                key,
                title: label.title,
                accuracy: Math.round((entry.clean / entry.attempts) * PERCENT),
                attempts: entry.attempts,
              },
            ]
          : [];
      })
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
      .slice(0, MAX_THEMES);
  }
}
