import { z } from 'zod';
import { WardrobeSchema } from './wardrobe.js';

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][nbrq]?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const LevelSchema = z.object({
  level: z.number().int().positive(),
  /** XP earned inside the current level, `xpInLevel / xpForNext` is the bar. */
  xpInLevel: z.number().int().nonnegative(),
  xpForNext: z.number().int().positive(),
});

export const AchievementSchema = z.object({
  /** Names and hints are in the locale files under this key. */
  key: z.string(),
  current: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  unlocked: z.boolean(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const CardSummarySchema = z.object({
  /** Cards that are due now. */
  due: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type CardSummary = z.infer<typeof CardSummarySchema>;

export const ThemeAccuracySchema = z.object({
  key: z.string(),
  title: z.string(),
  /** Share of the puzzles of the theme solved on the first try, from 0 to 100. */
  accuracy: z.number().int().min(0).max(100),
  attempts: z.number().int().positive(),
});

export const ProfileSchema = z.object({
  displayName: z.string().nullable(),
  /** The day the learner joined, YYYY-MM-DD. */
  memberSince: z.string().regex(DAY),
  level: LevelSchema,
  xpTotal: z.number().int().nonnegative(),
  streak: z.object({
    current: z.number().int().nonnegative(),
    best: z.number().int().nonnegative(),
  }),
  puzzles: z.object({ rating: z.number().int(), solved: z.number().int().nonnegative() }),
  games: z.object({
    played: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    draws: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
  }),
  /** The last seven days ending today, oldest first. */
  week: z.array(z.object({ day: z.string().regex(DAY), done: z.boolean(), today: z.boolean() })),
  /** Every day of the month that today belongs to, the first of the month first. */
  month: z.array(z.object({ day: z.string().regex(DAY), done: z.boolean(), today: z.boolean() })),
  /**
   * The puzzle rating at the end of each of the last eight weeks, oldest first, the last one is today.
   * Empty until the learner has rated attempts, because a line needs something to start from.
   */
  ratingHistory: z.array(z.object({ day: z.string().regex(DAY), rating: z.number().int() })),
  achievements: z.array(AchievementSchema),
  /** Themes with enough attempts to say something, the weakest first. */
  themes: z.array(ThemeAccuracySchema),
  cards: CardSummarySchema,
  wardrobe: WardrobeSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

/** A card to repeat: a position from the learner's own mistake. The answer stays on the server. */
export const ReviewCardSchema = z.object({
  id: z.uuid(),
  fen: z.string(),
  solver: z.enum(['w', 'b']),
  /** The move of the game that was a mistake, so that the card can say "here you played ...". */
  playedSan: z.string(),
  moveNumber: z.number().int().positive(),
});
export type ReviewCard = z.infer<typeof ReviewCardSchema>;

export const NextCardSchema = z.object({
  card: ReviewCardSchema.nullable(),
  summary: CardSummarySchema,
});
export type NextCard = z.infer<typeof NextCardSchema>;

export const CardAnswerRequestSchema = z.object({ move: z.string().regex(UCI_MOVE) });

export const CardAnswerResponseSchema = z.discriminatedUnion('result', [
  /** The move is not legal here, the card is not counted. */
  z.object({ result: z.literal('illegal') }),
  z.object({
    result: z.enum(['correct', 'wrong']),
    best: z.object({ uci: z.string().regex(UCI_MOVE), san: z.string() }),
    /** When the card comes back. */
    nextInDays: z.number().int().positive(),
    summary: CardSummarySchema,
  }),
]);
export type CardAnswerResponse = z.infer<typeof CardAnswerResponseSchema>;

export const MakeCardsResponseSchema = z.object({
  /** New cards made from the mistakes of the game, mistakes that already had a card are not counted. */
  created: z.number().int().nonnegative(),
  summary: CardSummarySchema,
});
export type MakeCardsResponse = z.infer<typeof MakeCardsResponseSchema>;
