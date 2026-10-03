import { z } from 'zod';

/** The goals of the day the learner can choose, in minutes (web/screens/profile.md). */
export const DAILY_GOAL_MINUTES = [5, 10, 15] as const;
const MAX_DISPLAY_NAME_LENGTH = 40;

export const SettingsSchema = z.object({
  dailyGoalMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  displayName: z.string().nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** Only what is sent changes. An empty name takes the name away. */
export const UpdateSettingsRequestSchema = z.object({
  dailyGoalMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]).optional(),
  displayName: z
    .string()
    .trim()
    .max(MAX_DISPLAY_NAME_LENGTH)
    .transform((name) => (name === '' ? null : name))
    .optional(),
});
export type UpdateSettingsRequest = z.input<typeof UpdateSettingsRequestSchema>;
