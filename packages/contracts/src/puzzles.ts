import { z } from 'zod';

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][nbrq]?$/;
const SQUARE = /^[a-h][1-8]$/;
const THEME_KEY = /^[a-zA-Z0-9]+$/;
const MAX_THEME_KEY_LENGTH = 40;

/**
 * - `rating`: a puzzle near the player's rating that they have not seen
 * - `theme`: a puzzle of one theme, near the rating
 * - `review`: a puzzle that was failed before and has not been solved since
 * - `daily`: the puzzle of the day
 */
export const PuzzleModeSchema = z.enum(['rating', 'theme', 'review', 'daily']);
export type PuzzleMode = z.infer<typeof PuzzleModeSchema>;

export const NextPuzzleRequestSchema = z
  .object({
    mode: PuzzleModeSchema.default('rating'),
    theme: z.string().regex(THEME_KEY).max(MAX_THEME_KEY_LENGTH).optional(),
    /** The learner's calendar day, YYYY-MM-DD, decides which puzzle is the daily one. */
    localDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((value) => value.mode !== 'theme' || value.theme !== undefined, {
    message: 'A theme is needed for the theme mode',
    path: ['theme'],
  });
export type NextPuzzleRequest = z.input<typeof NextPuzzleRequestSchema>;

export const PuzzleThemeLabelSchema = z.object({ key: z.string(), title: z.string() });
export type PuzzleThemeLabel = z.infer<typeof PuzzleThemeLabelSchema>;

/** A puzzle as the learner sees it. The line of the solution never leaves the server. */
export const PuzzleSchema = z.object({
  attemptId: z.uuid(),
  puzzleId: z.string(),
  /** The position to solve, after the opponent's first move. */
  fen: z.string(),
  /** The opponent's move that led here, for the board to show what just happened. */
  lastMove: z.string().regex(UCI_MOVE),
  solver: z.enum(['w', 'b']),
  rating: z.number().int(),
  /** Only filled in the theme mode: in the others the theme would give the idea away. */
  themes: z.array(PuzzleThemeLabelSchema),
});
export type Puzzle = z.infer<typeof PuzzleSchema>;

/** The puzzle of the day as the catalog shows it: a look at it, without starting an attempt. */
export const DailyPuzzleSchema = z.object({
  puzzleId: z.string(),
  fen: z.string(),
  lastMove: z.string().regex(UCI_MOVE),
  solver: z.enum(['w', 'b']),
  /** The theme that names it, such as "Мат в 2 хода". The card tells it, the solving screen does not. */
  title: z.string(),
  /** The learner has already solved today's puzzle. */
  solved: z.boolean(),
  /** Days in a row on which the puzzle of the day was solved, up to today (or yesterday while today is open). */
  streak: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
});
export type DailyPuzzle = z.infer<typeof DailyPuzzleSchema>;

export const PuzzleMoveRequestSchema = z.object({ move: z.string().regex(UCI_MOVE) });

/** What the attempt came to, sent once its rating is settled. */
export const PuzzleSummarySchema = z.object({
  status: z.enum(['solved', 'failed']),
  /** False for a puzzle the player has already tried, it does not move the rating. */
  rated: z.boolean(),
  ratingBefore: z.number().int(),
  ratingAfter: z.number().int(),
  /** The themes of the puzzle, which are no secret any more. */
  themes: z.array(PuzzleThemeLabelSchema),
  streak: z.number().int().nonnegative(),
});
export type PuzzleSummary = z.infer<typeof PuzzleSummarySchema>;

export const PuzzleMoveResponseSchema = z.discriminatedUnion('result', [
  /** The move is not legal here, nothing is counted. */
  z.object({ result: z.literal('illegal') }),
  /** A legal move that is not the one. The first one settles the rating and comes with a summary. */
  z.object({
    result: z.literal('wrong'),
    mistakes: z.number().int().positive(),
    summary: PuzzleSummarySchema.nullable(),
  }),
  z.object({
    result: z.literal('correct'),
    /** The opponent's answer to play on the board, `null` once the puzzle is solved. */
    reply: z.string().regex(UCI_MOVE).nullable(),
    solved: z.boolean(),
    summary: PuzzleSummarySchema.nullable(),
  }),
]);
export type PuzzleMoveResponse = z.infer<typeof PuzzleMoveResponseSchema>;

/** Three levels: the piece to move, the idea (the themes), then the move itself. */
export const PuzzleHintResponseSchema = z.discriminatedUnion('level', [
  z.object({ level: z.literal(1), square: z.string().regex(SQUARE) }),
  z.object({ level: z.literal(2), themes: z.array(PuzzleThemeLabelSchema) }),
  /** The move given away counts as a miss, so the summary comes with it. */
  z.object({
    level: z.literal(3),
    move: z.string().regex(UCI_MOVE),
    summary: PuzzleSummarySchema.nullable(),
  }),
]);
export type PuzzleHintResponse = z.infer<typeof PuzzleHintResponseSchema>;

export const PuzzleGiveUpResponseSchema = z.object({
  /** The rest of the line from here, the learner's moves and the replies in turn, to play on the board. */
  solution: z.array(z.string().regex(UCI_MOVE)),
  summary: PuzzleSummarySchema.nullable(),
});
export type PuzzleGiveUpResponse = z.infer<typeof PuzzleGiveUpResponseSchema>;

export const PuzzleStatsSchema = z.object({
  rating: z.number().int(),
  solved: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
});
export type PuzzleStats = z.infer<typeof PuzzleStatsSchema>;

export const PuzzleThemeListSchema = z.object({
  themes: z.array(
    PuzzleThemeLabelSchema.extend({
      count: z.number().int().positive(),
      /** How many of them this learner has solved. */
      solved: z.number().int().nonnegative(),
    }),
  ),
});
export type PuzzleThemeList = z.infer<typeof PuzzleThemeListSchema>;
