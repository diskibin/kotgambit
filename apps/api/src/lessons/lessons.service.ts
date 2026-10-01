import {
  type CatalogResponse,
  type CompleteLessonRequest,
  type CompleteLessonResponse,
  type LessonDetail,
  type LessonSummary,
} from '@kotgambit/contracts';
import { StepSchema, type Step } from '@kotgambit/content-schema';
import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../common/app-error.js';
import type { Lesson as LessonRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';

const FIRST_COMPLETION_XP = 20;
const REPEAT_COMPLETION_XP = 5;
const THREE_STARS_ACCURACY = 0.9;
const TWO_STARS_ACCURACY = 0.7;
// A step takes a minute or so at most, longer sessions are the learner leaving the screen open
const MAX_SECONDS_PER_MINUTE_OF_LESSON = 180;
const GRADABLE: readonly Step['type'][] = ['move', 'quiz', 'find-squares'];

const StepsSchema = z.array(StepSchema);

function starsFor(accuracy: number): number {
  if (accuracy >= THREE_STARS_ACCURACY) return 3;
  return accuracy >= TWO_STARS_ACCURACY ? 2 : 1;
}

type Progress = { lessonId: string; stars: number };

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  /**
   * Summaries of all chapters with the learner's status. A chapter opens when the one before it in
   * the same track is finished, and stays open for repetition afterwards.
   */
  private summarize(lessons: LessonRow[], done: Map<string, Progress>): LessonSummary[] {
    return lessons.map((lesson, index) => {
      const previous = lessons[index - 1];
      const unlocked = !previous || previous.track !== lesson.track || done.has(previous.id);
      const result = done.get(lesson.id);
      const status =
        lesson.access !== 'free'
          ? 'premium'
          : result
            ? 'completed'
            : unlocked
              ? 'available'
              : 'locked';
      return {
        id: lesson.id,
        track: lesson.track as LessonSummary['track'],
        order: lesson.order,
        piece: lesson.piece as LessonSummary['piece'],
        title: lesson.title,
        summary: lesson.summary,
        minutes: lesson.minutes,
        status,
        stars: result?.stars ?? 0,
      };
    });
  }

  private async load(
    userId: string,
  ): Promise<{ lessons: LessonRow[]; summaries: LessonSummary[] }> {
    const [lessons, progress] = await Promise.all([
      this.prisma.lesson.findMany({ orderBy: [{ track: 'asc' }, { order: 'asc' }] }),
      this.prisma.lessonProgress.findMany({ where: { userId } }),
    ]);
    const done = new Map(progress.map((p) => [p.lessonId, p]));
    return { lessons, summaries: this.summarize(lessons, done) };
  }

  async catalog(userId: string): Promise<CatalogResponse> {
    return { lessons: (await this.load(userId)).summaries };
  }

  private async open(userId: string, id: string) {
    const { lessons, summaries } = await this.load(userId);
    const index = lessons.findIndex((lesson) => lesson.id === id);
    const row = lessons[index];
    const summary = summaries[index];
    if (!row || !summary) throw new AppError('lesson.not_found', HttpStatus.NOT_FOUND);
    if (summary.status === 'premium') throw new AppError('lesson.premium', HttpStatus.FORBIDDEN);
    if (summary.status === 'locked') throw new AppError('lesson.locked', HttpStatus.FORBIDDEN);
    const next = lessons[index + 1];
    return { row, summary, nextId: next?.track === row.track ? next.id : null };
  }

  async detail(userId: string, id: string): Promise<LessonDetail> {
    const { row, summary } = await this.open(userId, id);
    return { ...summary, steps: StepsSchema.parse(row.steps) };
  }

  async complete(
    userId: string,
    id: string,
    body: CompleteLessonRequest,
  ): Promise<CompleteLessonResponse> {
    const { row, nextId } = await this.open(userId, id);
    const steps = StepsSchema.parse(row.steps);
    if (body.attempts.length !== steps.length) {
      throw new AppError('lesson.invalid_report', HttpStatus.BAD_REQUEST);
    }
    const today = this.progress.resolveToday(body.localDate);

    // Text and demo steps cannot be failed, only the tasks count towards accuracy
    const graded = steps.flatMap((step, index) =>
      GRADABLE.includes(step.type) ? [body.attempts[index] === 1] : [],
    );
    const accuracy = graded.length === 0 ? 1 : graded.filter(Boolean).length / graded.length;
    const stars = starsFor(accuracy);
    const seconds = Math.min(body.seconds, row.minutes * MAX_SECONDS_PER_MINUTE_OF_LESSON);

    const before = await this.progress.summary(userId, today);
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: id } },
    });
    const firstTime = !existing;
    const xp = firstTime ? FIRST_COMPLETION_XP : REPEAT_COMPLETION_XP;

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: id } },
        create: { userId, lessonId: id, bestAccuracy: accuracy, stars, completedAt: new Date() },
        update: {
          bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracy),
          stars: Math.max(existing?.stars ?? 0, stars),
          attempts: { increment: 1 },
        },
      });
      await this.progress.addActivity(tx, userId, today, seconds, xp);
    });

    const progress = await this.progress.summary(userId, today);
    return {
      xp,
      accuracy,
      stars,
      firstTime,
      goalReachedNow:
        before.todaySeconds < before.goalSeconds && progress.todaySeconds >= progress.goalSeconds,
      nextLessonId: nextId,
      progress,
    };
  }
}
