export const PLAN_KEYS = ['month', 'year'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

const MONTHS_IN_YEAR = 12;
const PLAN_MONTHS: Record<PlanKey, number> = { month: 1, year: MONTHS_IN_YEAR };

/** A calendar period from a date: a month later on the same day, or the last day of a shorter month. */
export function addPlanPeriod(from: Date, plan: PlanKey): Date {
  const result = new Date(from.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + PLAN_MONTHS[plan]);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
