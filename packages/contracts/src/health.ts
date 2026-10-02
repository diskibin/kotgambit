import { z } from 'zod';
import { EngineMetricsSchema } from './engine.js';

export const HealthResponseSchema = z.object({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadyResponseSchema = z.object({
  status: z.literal('ok'),
  /** `null` when no engine is configured. The queue numbers show when the server needs more cores. */
  engine: EngineMetricsSchema.nullable(),
});
export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;
