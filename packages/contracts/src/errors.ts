import { z } from 'zod';

/** The single error shape of the API. `message` is for the user and is in Russian. */
export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  /** For developers only, never shown in the interface. */
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
