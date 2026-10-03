import { applyMove } from '@kotgambit/chess-core';
import {
  GameReviewSchema,
  type CardAnswerResponse,
  type CardSummary,
  type MakeCardsResponse,
  type NextCard,
} from '@kotgambit/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { dueAfter, nextSchedule } from '../progress/srs.js';
import { dayKeyOf } from '../progress/streak.js';
import { CARD_SECONDS, CARD_XP } from './cards.limits.js';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  async summary(userId: string): Promise<CardSummary> {
    const [due, total] = await Promise.all([
      this.prisma.reviewCard.count({ where: { userId, dueAt: { lte: new Date() } } }),
      this.prisma.reviewCard.count({ where: { userId } }),
    ]);
    return { due, total };
  }

  /**
   * Makes a card of every mistake and blunder of a reviewed game. A mistake that already has a card is
   * left alone, so pressing the button twice makes no duplicates.
   */
  async makeFromGame(userId: string, gameId: string): Promise<MakeCardsResponse> {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, userId } });
    if (!game) throw new AppError('game.not_found', HttpStatus.NOT_FOUND);
    const row = await this.prisma.gameReview.findUnique({ where: { gameId } });
    const review = row?.status === 'done' ? GameReviewSchema.safeParse(row.result) : null;
    if (!review?.success) throw new AppError('review.not_ready', HttpStatus.CONFLICT);

    const now = new Date();
    const { count } = await this.prisma.reviewCard.createMany({
      data: review.data.mistakes.map((mistake) => ({
        userId,
        gameId,
        ply: mistake.ply,
        fen: mistake.fen,
        correct: mistake.better.uci,
        playedUci: mistake.played.uci,
        playedSan: mistake.played.san,
        solver: mistake.color,
        dueAt: now,
      })),
      skipDuplicates: true,
    });
    return { created: count, summary: await this.summary(userId) };
  }

  /** The card that has waited longest, or none when everything is repeated for now. */
  async next(userId: string): Promise<NextCard> {
    const card = await this.prisma.reviewCard.findFirst({
      where: { userId, dueAt: { lte: new Date() } },
      orderBy: { dueAt: 'asc' },
    });
    return {
      card: card
        ? {
            id: card.id,
            fen: card.fen,
            solver: card.solver as 'w' | 'b',
            playedSan: card.playedSan,
            moveNumber: Math.ceil(card.ply / 2),
          }
        : null,
      summary: await this.summary(userId),
    };
  }

  async answer(userId: string, id: string, move: string): Promise<CardAnswerResponse> {
    const card = await this.prisma.reviewCard.findFirst({ where: { id, userId } });
    if (!card) throw new AppError('card.not_found', HttpStatus.NOT_FOUND);
    if (!applyMove(card.fen, move).ok) return { result: 'illegal' };

    // Only the engine's move counts: telling another good move from a bad one needs a search (ADR 0012)
    const grade = move === card.correct ? 'correct' : 'wrong';
    const schedule = nextSchedule(
      {
        intervalDays: card.intervalDays,
        ease: card.ease,
        repetitions: card.repetitions,
        lapses: card.lapses,
      },
      grade,
    );
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewCard.update({
        where: { id },
        data: { ...schedule, dueAt: dueAfter(now, schedule.intervalDays), lastAnsweredAt: now },
      });
      await this.progress.addActivity(tx, userId, dayKeyOf(now), CARD_SECONDS, CARD_XP[grade]);
    });

    const best = applyMove(card.fen, card.correct);
    return {
      result: grade,
      best: { uci: card.correct, san: best.ok ? best.move.san : card.correct },
      nextInDays: schedule.intervalDays,
      summary: await this.summary(userId),
    };
  }
}
