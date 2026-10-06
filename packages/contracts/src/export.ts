import { z } from 'zod';

/**
 * What the learner may take with them. The shape is the server's to grow, so only the parts a client
 * relies on are checked: the date and whose data this is.
 */
export const DataExportSchema = z.looseObject({
  exportedAt: z.string(),
  account: z.looseObject({ id: z.string(), email: z.string() }),
});
export type DataExport = z.infer<typeof DataExportSchema>;
