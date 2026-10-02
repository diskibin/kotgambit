import { z } from 'zod';

/** Caps on what one request may ask for, so that a single call cannot hold an engine for long. */
export const ENGINE_MAX_DEPTH = 20;
export const ENGINE_MAX_MULTIPV = 3;
const MAX_FEN_LENGTH = 100;

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][nbrq]?$/;

export const EngineScoreSchema = z.discriminatedUnion('kind', [
  /** Centipawns from the point of view of the side to move. */
  z.object({ kind: z.literal('cp'), value: z.number().int() }),
  /** Moves to mate, negative when the side to move is the one getting mated. */
  z.object({ kind: z.literal('mate'), value: z.number().int() }),
]);

export const EngineAnalysisRequestSchema = z.object({
  fen: z.string().min(1).max(MAX_FEN_LENGTH),
  depth: z.number().int().min(1).max(ENGINE_MAX_DEPTH),
  multipv: z.number().int().min(1).max(ENGINE_MAX_MULTIPV).default(1),
});
export type EngineAnalysisRequest = z.input<typeof EngineAnalysisRequestSchema>;

export const EngineLineSchema = z.object({
  multipv: z.number().int().positive(),
  depth: z.number().int().positive(),
  score: EngineScoreSchema,
  pv: z.array(z.string().regex(UCI_MOVE)),
});
export type EngineLine = z.infer<typeof EngineLineSchema>;

export const EngineAnalysisResponseSchema = z.object({
  /** `null` when the position has no legal move. */
  bestMove: z.string().regex(UCI_MOVE).nullable(),
  lines: z.array(EngineLineSchema),
  /** The time budget ran out first, so the lines may be shallower than the depth asked for. */
  timedOut: z.boolean(),
  cached: z.boolean(),
});
export type EngineAnalysisResponse = z.infer<typeof EngineAnalysisResponseSchema>;

export const EngineMetricsSchema = z.object({
  workers: z.number().int().nonnegative(),
  busy: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  recentWaitMs: z.number().nonnegative(),
});
export type EngineMetrics = z.infer<typeof EngineMetricsSchema>;
