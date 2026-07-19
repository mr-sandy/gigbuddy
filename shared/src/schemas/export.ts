import { z } from 'zod';
import { BandSchema } from './band.js';
import { SetlistSchema } from './setlist.js';
import { SongSchema } from './song.js';

/*
 * ExportSchema — Story 5.1 (FR-33). The single Zod source of truth for the
 * `GET /api/v1/export` archive shape (architecture.md "Export endpoint").
 *
 * Composed from the existing Band/Song/Setlist schemas — do NOT hand-roll a
 * parallel TypeScript type for the archive (CLAUDE.md: "Zod schemas in
 * `shared/` are the single source of truth"). Bumping `schemaVersion` past
 * `1` is the forward-compat gate for V2+ importers; the V1 export just
 * stamps the literal.
 *
 * The archive is a raw JSON file download, NOT the standard `{status,data}`
 * read envelope — architecture.md's "Export endpoint" section documents
 * that deviation.
 */
export const ExportSchema = z.object({
  exportedAt: z.string().datetime(),
  schemaVersion: z.literal(1),
  bands: z.array(
    z.object({
      band: BandSchema,
      songs: z.array(SongSchema),
      setlists: z.array(SetlistSchema),
    }),
  ),
});

export type Export = z.infer<typeof ExportSchema>;
