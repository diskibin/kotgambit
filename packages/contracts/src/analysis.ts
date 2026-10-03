import { z } from 'zod';
import { EngineScoreSchema } from './engine.js';

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][nbrq]?$/;
const MAX_FEN_LENGTH = 100;
/** How many moves of a line the learner is shown. */
export const ANALYSIS_LINE_MOVES = 6;

export const PositionAnalysisRequestSchema = z.object({
  fen: z.string().min(1).max(MAX_FEN_LENGTH),
});
export type PositionAnalysisRequest = z.infer<typeof PositionAnalysisRequestSchema>;

export const PositionProblemKindSchema = z.enum([
  'malformed',
  'no-king',
  'many-kings',
  'pawn-on-edge',
  'kings-touch',
  'too-many-pieces',
  'side-not-to-move-in-check',
  'illegal',
]);

/** The server tells why a position was refused, in words for the learner, and which square to look at. */
export const InvalidPositionDetailsSchema = z.object({
  problem: PositionProblemKindSchema,
  /** Present for a problem tied to one color. */
  color: z.enum(['w', 'b']).optional(),
  square: z.string().optional(),
});

/** The score in every field is from the point of view of White. */
export const AnalysisLineSchema = z.object({
  score: EngineScoreSchema,
  uci: z.array(z.string().regex(UCI_MOVE)),
  san: z.array(z.string()),
});
export type AnalysisLine = z.infer<typeof AnalysisLineSchema>;

export const PositionAnalysisSchema = z.object({
  fen: z.string(),
  turn: z.enum(['w', 'b']),
  score: EngineScoreSchema,
  leader: z.enum(['equal', 'white', 'black']),
  /** "Примерно равно" */
  headline: z.string(),
  /** A fact about the position, not a judgement of ideas. */
  detail: z.string(),
  /** Shares of the three results, an estimate from the evaluation that adds up to 100. */
  outlook: z.object({
    white: z.number().int().min(0).max(100),
    draw: z.number().int().min(0).max(100),
    black: z.number().int().min(0).max(100),
  }),
  /** `null` when the game is over in this position. */
  best: z
    .object({
      uci: z.string().regex(UCI_MOVE),
      san: z.string(),
      explanation: z.string(),
    })
    .nullable(),
  lines: z.array(AnalysisLineSchema),
  depth: z.number().int().positive(),
});
export type PositionAnalysis = z.infer<typeof PositionAnalysisSchema>;

export const MoveQualitySchema = z.enum(['best', 'good', 'inaccuracy', 'mistake', 'blunder']);

/** What stands out in a game: the learner's worst moves and their best one. */
export const KeyMomentSchema = z.object({
  /** 1-based index of the half-move in the game. */
  ply: z.number().int().positive(),
  /** The move number as it is written: 5 for both 5.Nxf7 and 5...Qxg2. */
  moveNumber: z.number().int().positive(),
  color: z.enum(['w', 'b']),
  kind: z.enum(['blunder', 'mistake', 'highlight']),
  played: z.object({ uci: z.string().regex(UCI_MOVE), san: z.string() }),
  /** The move the engine preferred, `null` for a highlight, where the move played was it. */
  better: z.object({ uci: z.string().regex(UCI_MOVE), san: z.string() }).nullable(),
  /** The position before the move, for the board of the card. */
  fen: z.string(),
  explanation: z.string(),
});
export type KeyMoment = z.infer<typeof KeyMomentSchema>;

/** A move of the learner that lost much, with what to play instead: the stuff of a card to repeat. */
export const ReviewMistakeSchema = z.object({
  ply: z.number().int().positive(),
  fen: z.string(),
  color: z.enum(['w', 'b']),
  played: z.object({ uci: z.string().regex(UCI_MOVE), san: z.string() }),
  better: z.object({ uci: z.string().regex(UCI_MOVE), san: z.string() }),
});
export type ReviewMistake = z.infer<typeof ReviewMistakeSchema>;

export const GameReviewSchema = z.object({
  /** Accuracy from 0 to 100, `null` for a side that made no moves. */
  accuracy: z.object({ player: z.number().int().nullable(), bot: z.number().int().nullable() }),
  /** How the learner's moves were judged. */
  counts: z.object({
    best: z.number().int().nonnegative(),
    good: z.number().int().nonnegative(),
    inaccuracy: z.number().int().nonnegative(),
    mistake: z.number().int().nonnegative(),
    blunder: z.number().int().nonnegative(),
  }),
  /** The chance that White wins, in percent, before the first move and after every half-move. */
  chances: z.array(z.number().min(0).max(100)),
  /** The quality of every half-move, in order. */
  qualities: z.array(MoveQualitySchema),
  keyMoments: z.array(KeyMomentSchema),
  /** Every mistake and blunder of the learner, for making cards. */
  mistakes: z.array(ReviewMistakeSchema),
});
export type GameReview = z.infer<typeof GameReviewSchema>;

export const ReviewStatusSchema = z.object({
  status: z.enum(['pending', 'running', 'done', 'failed']),
  /** Positions looked at so far and in all, for the progress bar. */
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  review: GameReviewSchema.nullable(),
});
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
