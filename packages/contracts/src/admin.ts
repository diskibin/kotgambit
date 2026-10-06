import { z } from 'zod';
import { EngineMetricsSchema } from './engine.js';

const Count = z.number().int().nonnegative();
const Percent = z.number().int().min(0).max(100);
const PlanKey = z.enum(['month', 'year']);

/** How the people who signed up in the period went on with the learning. */
export const LearningStatsSchema = z.object({
  days: z.number().int().positive(),
  funnel: z.object({
    registered: Count,
    /** Finished at least one chapter. */
    lesson: Count,
    /** Came back on a later day. */
    returned: Count,
    solvedPuzzle: Count,
    playedGame: Count,
  }),
  /** The last weeks of sign-ups, oldest first. `null` is a day that has not come yet for the whole week. */
  cohorts: z.array(
    z.object({
      /** The Monday of the week, UTC, `YYYY-MM-DD`. */
      week: z.string(),
      size: Count,
      d1: Count.nullable(),
      d7: Count.nullable(),
      d30: Count.nullable(),
    }),
  ),
  /** Chapters in the order of the path, over all time: where the learners stop. */
  lessons: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      track: z.string(),
      completed: Count,
      /** Of the learners who finished the chapter before it. `null` for the first of a track. */
      fromPrevious: Percent.nullable(),
      /** The mean of the best results, whole percent. */
      accuracy: Percent,
      /** The mean number of runs it took. */
      attempts: z.number().nonnegative(),
    }),
  ),
  /** The themes of puzzles that go worst in the period, with enough tries to say something. */
  themes: z.array(z.object({ theme: z.string(), attempts: Count, solved: Count })),
});
export type LearningStats = z.infer<typeof LearningStatsSchema>;

export const AdminPaymentSchema = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  plan: PlanKey,
  purpose: z.enum(['initial', 'renewal']),
  status: z.enum(['pending', 'succeeded', 'canceled']),
  amountKopecks: Count,
  client: z.string(),
  /** The code the provider gave for a cancelled payment. */
  cancelReason: z.string().nullable(),
});
export type AdminPayment = z.infer<typeof AdminPaymentSchema>;

export const PaymentsStatsSchema = z.object({
  days: z.number().int().positive(),
  /** First payments of the period by plan: made, and paid. */
  byPlan: z.array(z.object({ plan: PlanKey, started: Count, paid: Count })),
  /** Subscriptions whose paid period ended in the period and was not renewed. */
  churned: Count,
  /** Subscriptions inside the grace days after a refused renewal. */
  pastDue: Count,
  /** Why payments failed in the period: the codes and how many. */
  failures: z.array(z.object({ reason: z.string(), count: Count })),
  recent: z.array(AdminPaymentSchema.extend({ email: z.string() })),
});
export type PaymentsStats = z.infer<typeof PaymentsStatsSchema>;

const Probe = z.object({ ok: z.boolean(), ms: Count });

export const ServerHealthSchema = z.object({
  /** `null` when no engine is configured. */
  engine: EngineMetricsSchema.nullable(),
  database: Probe,
  redis: Probe,
  process: z.object({ uptimeSeconds: Count, memoryMb: Count, node: z.string() }),
  games: z.object({ active: Count }),
  /** The look at a finished game is made in the background. */
  reviews: z.object({ pending: Count, running: Count, failedDay: Count }),
});
export type ServerHealth = z.infer<typeof ServerHealthSchema>;

export const AdminUserFoundSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string().nullable(),
  createdAt: z.string(),
  premium: z.boolean(),
});
export type AdminUserFound = z.infer<typeof AdminUserFoundSchema>;

export const AdminUserListSchema = z.object({ users: z.array(AdminUserFoundSchema) });
export type AdminUserList = z.infer<typeof AdminUserListSchema>;

export const AdminUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
  /** The last day with activity, `YYYY-MM-DD`. */
  lastActiveDay: z.string().nullable(),
  xpTotal: Count,
  lessonsCompleted: Count,
  puzzlesSolved: Count,
  gamesPlayed: Count,
  hasPassword: z.boolean(),
  /** The services the account signs in with. */
  providers: z.array(z.string()),
  subscription: z
    .object({
      premium: z.boolean(),
      status: z.enum(['active', 'past_due', 'canceled', 'expired']),
      plan: PlanKey,
      currentPeriodEnd: z.string(),
      autoRenew: z.boolean(),
      cardLast4: z.string().nullable(),
    })
    .nullable(),
  payments: z.array(AdminPaymentSchema),
  actions: z.array(
    z.object({
      createdAt: z.string(),
      adminEmail: z.string(),
      action: z.enum(['grant_premium', 'revoke_premium']),
      details: z.string(),
    }),
  ),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const MAX_GRANT_DAYS = 366;
export const MIN_REASON_LENGTH = 3;
export const MAX_REASON_LENGTH = 200;

const Reason = z.string().trim().min(MIN_REASON_LENGTH).max(MAX_REASON_LENGTH);

export const GrantPremiumRequestSchema = z.object({
  days: z.number().int().min(1).max(MAX_GRANT_DAYS),
  /** Why, for the log. Nobody is given Premium without one. */
  reason: Reason,
});
export type GrantPremiumRequest = z.infer<typeof GrantPremiumRequestSchema>;

export const RevokePremiumRequestSchema = z.object({ reason: Reason });
export type RevokePremiumRequest = z.infer<typeof RevokePremiumRequestSchema>;

export const USER_SEARCH_MIN_LENGTH = 2;
export const UserSearchQuerySchema = z.string().trim().min(USER_SEARCH_MIN_LENGTH).max(100);
