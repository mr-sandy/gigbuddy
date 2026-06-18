import { OkResponseSchema, type Song, SongSchema } from '@gigbuddy/shared';
import { z } from 'zod';
import { apiFetch } from './client.js';

/*
 * The list-Songs API surface. The flusher (sync/flusher.ts) owns the
 * write path via the outbox; this module owns the read path used by
 * useSongs (Story 2.5). Story 2.6 will add `getSong(songId)` here for
 * the per-record `useSong()` hook.
 *
 * The envelope schema is composed at the call site (Story 2.4 precedent
 * in flusher.ts) — no new shared exports. The function does not catch:
 * a network or schema failure throws, and TanStack Query's retry layer
 * handles the recovery (architecture.md "Error handling" lines 740–753).
 */
export async function listSongs(): Promise<Song[]> {
  const response = await apiFetch('/api/v1/songs', {
    method: 'GET',
    schema: OkResponseSchema(z.array(SongSchema)),
  });
  return response.data.data;
}
