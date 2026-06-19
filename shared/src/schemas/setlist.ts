import { z } from 'zod';

/*
 * Setlist Zod contract (architecture.md AR-9, AR-11, AR-23). A Setlist is
 * the single DDB item that owns its `sections[]` array, each containing
 * `SongRef[]` (songId + titleSnapshot + optional perGigAnnotation).
 *
 * `titleSnapshot` (AR-11) keeps the rendered title independent of the
 * Songs table — renaming a Song never mutates historical Setlists. The
 * client supplies titleSnapshot at write time; the server never reads
 * the Songs table on a Setlist PUT.
 *
 * Whole-record PUT (AR-23): the entire `sections[]` array is replaced
 * atomically on every PUT — no per-section or per-song merging.
 */
export const SongRefSchema = z.object({
  songId: z.string(),
  titleSnapshot: z.string(),
  perGigAnnotation: z.string().optional(),
});
export type SongRef = z.infer<typeof SongRefSchema>;

export const SectionSchema = z.object({
  name: z.string(),
  songs: z.array(SongRefSchema),
});
export type Section = z.infer<typeof SectionSchema>;

export const SetlistSchema = z.object({
  bandId: z.string(),
  setlistId: z.string(),
  gigMeta: z.object({
    venue: z.string(),
    date: z.string().date(), // ISO date only, e.g. "2026-06-21"
    time: z.string().optional(), // HH:MM 24h, e.g. "20:00"
  }),
  sections: z.array(SectionSchema),
  clientWrittenAt: z.string().datetime(),
  serverReceivedAt: z.string().datetime(),
  version: z.literal(1),
});
export type Setlist = z.infer<typeof SetlistSchema>;

// .strict() mirrors SongPutInputSchema in song.ts:21 — enforces the AR-23
// client contract: the server stamps serverReceivedAt itself, so a body
// that includes it (or any other unknown key) is a client bug and the
// API rejects with 400.
export const SetlistPutInputSchema = SetlistSchema.omit({ serverReceivedAt: true }).strict();
export type SetlistPutInput = z.infer<typeof SetlistPutInputSchema>;
