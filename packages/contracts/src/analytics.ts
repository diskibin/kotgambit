import { z } from 'zod';

/** The steps of a visitor that the site reports. Signing up and paying are read from the database, not reported. */
export const AnalyticsEventNameSchema = z.enum([
  'visit',
  'signed_in',
  'premium_view',
  'checkout_start',
]);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;

export const AnalyticsEventRequestSchema = z.object({
  /** A random id the browser made up and keeps, it says nothing about who the visitor is. */
  visitorId: z.uuid(),
  name: AnalyticsEventNameSchema,
});
export type AnalyticsEventRequest = z.infer<typeof AnalyticsEventRequestSchema>;

export const STATS_PERIOD_DAYS = [7, 30, 90] as const;
export const StatsPeriodSchema = z.coerce
  .number()
  .int()
  .refine((days): days is (typeof STATS_PERIOD_DAYS)[number] =>
    (STATS_PERIOD_DAYS as readonly number[]).includes(days),
  );

export const DEFAULT_STATS_DAYS = 30;
/** The `days` of the stats request, the default period when it is left out. */
export const StatsQuerySchema = StatsPeriodSchema.default(DEFAULT_STATS_DAYS);

const Count = z.number().int().nonnegative();

export const AdminStatsSchema = z.object({
  days: z.number().int().positive(),
  /** Distinct visitors that reached each step of the web funnel in the period. */
  funnel: z.object({
    visitors: Count,
    signedIn: Count,
    premiumView: Count,
    checkoutStart: Count,
    /** Learners whose first payment from the site went through. */
    paid: Count,
  }),
  /** One entry per day of the period, oldest first, UTC days as `YYYY-MM-DD`. */
  daily: z.array(
    z.object({
      day: z.string(),
      visitors: Count,
      registrations: Count,
      payments: Count,
      revenueKopecks: Count,
    }),
  ),
  users: z.object({
    total: Count,
    registered: Count,
    /** Learners with activity today, in the last 7 days and in the last 30 days. */
    dau: Count,
    wau: Count,
    mau: Count,
  }),
  premium: z.object({
    active: Count,
    month: Count,
    year: Count,
    autoRenew: Count,
    /** Cancelled but still inside the paid period. */
    canceledPaid: Count,
    newInPeriod: Count,
    renewalsInPeriod: Count,
    failedPayments: Count,
    revenueKopecks: Count,
    totalRevenueKopecks: Count,
  }),
  usage: z.object({
    gamesStarted: Count,
    gamesFinished: Count,
    puzzlesStarted: Count,
    puzzlesSolved: Count,
    lessonsCompleted: Count,
    reviewsDone: Count,
  }),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;
