import type { DataExport } from '@kotgambit/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

const isoDay = (day: Date) => day.toISOString().slice(0, 10);

/**
 * Everything the service keeps about one account, readable by a person (152-FZ, the right to get one's data).
 * What is left out on purpose: the password hash and the tokens, which are secrets and not the learner's data, and the
 * identifiers of the payment provider (the payment method, the payment ids), which only mean something to the provider.
 */
@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(userId: string, now: Date = new Date()): Promise<DataExport> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        identities: { select: { provider: true, email: true, createdAt: true } },
        subscription: true,
        payments: { orderBy: { createdAt: 'asc' } },
        lessonProgress: { orderBy: { completedAt: 'asc' } },
        dailyActivity: { orderBy: { day: 'asc' } },
        puzzleStats: true,
        puzzleAttempts: { orderBy: { startedAt: 'asc' } },
        games: { orderBy: { startedAt: 'asc' } },
        reviewCards: { orderBy: { createdAt: 'asc' } },
        achievements: { orderBy: { unlockedAt: 'asc' } },
      },
    });
    // A valid token for a deleted account is as good as no token
    if (!user) throw new AppError('auth.unauthorized', HttpStatus.UNAUTHORIZED);

    return {
      exportedAt: now.toISOString(),
      account: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerifiedAt !== null,
        createdAt: user.createdAt.toISOString(),
        dailyGoalMinutes: user.dailyGoalMinutes,
        accessory: user.accessory,
        reminders: user.remindersEnabled,
      },
      signInServices: user.identities.map((identity) => ({
        provider: identity.provider,
        email: identity.email,
        linkedAt: identity.createdAt.toISOString(),
      })),
      lessons: user.lessonProgress.map((row) => ({
        lesson: row.lessonId,
        bestAccuracy: row.bestAccuracy,
        stars: row.stars,
        attempts: row.attempts,
        completedAt: row.completedAt.toISOString(),
      })),
      activity: user.dailyActivity.map((row) => ({
        day: isoDay(row.day),
        seconds: row.seconds,
        xp: row.xp,
      })),
      puzzles: {
        rating: user.puzzleStats ? Math.round(user.puzzleStats.rating) : null,
        solved: user.puzzleStats?.solved ?? 0,
        failed: user.puzzleStats?.failed ?? 0,
        bestStreak: user.puzzleStats?.bestStreak ?? 0,
        attempts: user.puzzleAttempts.map((row) => ({
          puzzle: row.puzzleId,
          status: row.status,
          mistakes: row.mistakes,
          hintLevel: row.hintLevel,
          playedMoves: row.playedMoves,
          startedAt: row.startedAt.toISOString(),
          solvedAt: row.solvedAt?.toISOString() ?? null,
        })),
      },
      games: user.games.map((row) => ({
        bot: row.botId,
        color: row.userColor,
        learning: row.learning,
        status: row.status,
        moves: row.moves,
        hintsUsed: row.hintsUsed,
        outcome: row.outcome,
        endReason: row.endReason,
        xp: row.xp,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
      })),
      mistakeCards: user.reviewCards.map((row) => ({
        fen: row.fen,
        played: row.playedSan,
        best: row.correct,
        dueAt: row.dueAt.toISOString(),
        repetitions: row.repetitions,
        lapses: row.lapses,
        createdAt: row.createdAt.toISOString(),
      })),
      achievements: user.achievements.map((row) => ({
        key: row.key,
        unlockedAt: row.unlockedAt.toISOString(),
      })),
      subscription: user.subscription
        ? {
            plan: user.subscription.planKey,
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd.toISOString(),
            autoRenew: user.subscription.autoRenew,
            cardLast4: user.subscription.cardLast4,
          }
        : null,
      payments: user.payments.map((row) => ({
        plan: row.planKey,
        purpose: row.purpose,
        status: row.status,
        amountKopecks: row.amountKopecks,
        client: row.client,
        createdAt: row.createdAt.toISOString(),
        paidAt: row.paidAt?.toISOString() ?? null,
      })),
    };
  }
}
