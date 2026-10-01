import { PIECES, StepSchema, TRACKS } from '@kotgambit/content-schema';
import { z } from 'zod';

/**
 * `locked`: the previous chapter is not done yet. `premium`: needs a subscription, only the title is shown.
 * Finished chapters stay open for repetition.
 */
export const LESSON_STATUSES = ['available', 'completed', 'locked', 'premium'] as const;

export const LessonSummarySchema = z.object({
  id: z.string(),
  track: z.enum(TRACKS),
  /** The "Глава N" of the interface. */
  order: z.number().int().positive(),
  piece: z.enum(PIECES),
  title: z.string(),
  summary: z.string(),
  minutes: z.number().int().positive(),
  status: z.enum(LESSON_STATUSES),
  /** Best result so far: 0 when never finished, 1 to 3 otherwise. */
  stars: z.number().int().min(0).max(3),
});
export type LessonSummary = z.infer<typeof LessonSummarySchema>;

export const CatalogResponseSchema = z.object({ lessons: z.array(LessonSummarySchema) });
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

export const LessonDetailSchema = LessonSummarySchema.extend({ steps: z.array(StepSchema) });
export type LessonDetail = z.infer<typeof LessonDetailSchema>;

const MAX_STEPS = 12;
const MAX_ATTEMPTS = 50;
const MAX_LESSON_SECONDS = 3600;

/**
 * What the client reports about a finished lesson. The server works out accuracy, stars and XP itself,
 * so the client sends facts (tries per step, time), not results.
 */
export const CompleteLessonRequestSchema = z.object({
  /** One entry per step in order, text and demo steps are reported with 1 attempt. */
  attempts: z.array(z.number().int().min(1).max(MAX_ATTEMPTS)).min(1).max(MAX_STEPS),
  seconds: z.number().int().min(0).max(MAX_LESSON_SECONDS),
  /** The learner's calendar day, YYYY-MM-DD, so that "today" follows their timezone. */
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type CompleteLessonRequest = z.infer<typeof CompleteLessonRequestSchema>;

export const ProgressSummarySchema = z.object({
  streakDays: z.number().int().min(0),
  todaySeconds: z.number().int().min(0),
  goalSeconds: z.number().int().positive(),
  xpTotal: z.number().int().min(0),
});
export type ProgressSummary = z.infer<typeof ProgressSummarySchema>;

export const CompleteLessonResponseSchema = z.object({
  xp: z.number().int().min(0),
  /** Share of gradable steps solved on the first try, from 0 to 1. */
  accuracy: z.number().min(0).max(1),
  stars: z.number().int().min(1).max(3),
  firstTime: z.boolean(),
  /** The daily goal was reached by this lesson, so the streak grew today. */
  goalReachedNow: z.boolean(),
  nextLessonId: z.string().nullable(),
  progress: ProgressSummarySchema,
});
export type CompleteLessonResponse = z.infer<typeof CompleteLessonResponseSchema>;
