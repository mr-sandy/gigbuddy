import { z } from 'zod';

export const BandSchema = z.object({
  bandId: z.string(),
  name: z.string(),
});

export type Band = z.infer<typeof BandSchema>;
