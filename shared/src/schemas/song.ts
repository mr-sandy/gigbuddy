import { z } from 'zod';

export const SongSchema = z.object({
  bandId: z.string(),
  songId: z.string(),
  title: z.string(),
  key: z.string().optional(),
  patch: z.string().optional(),
  chordChart: z.string().optional(),
  performanceNotes: z.string().optional(),
  practiceNotes: z.string().optional(),
  clientWrittenAt: z.string().datetime(),
  serverReceivedAt: z.string().datetime(),
  version: z.literal(1),
});
export type Song = z.infer<typeof SongSchema>;

// .strict() enforces the AR-23 client contract: the server stamps
// serverReceivedAt itself, so a body that includes it (or any other
// unknown key) is a client bug and the API rejects with 400.
export const SongPutInputSchema = SongSchema.omit({ serverReceivedAt: true }).strict();
export type SongPutInput = z.infer<typeof SongPutInputSchema>;
