import {
  AppliedResponseSchema,
  DroppedAsStaleResponseSchema,
  ErrorResponseSchema,
  OkResponseSchema,
  type Song,
  type SongPutInput,
  SongSchema,
} from '@gigbuddy/shared';
import { z } from 'zod';
import { apiFetch } from './client.js';

/*
 * The Songs API surface. The flusher (sync/flusher.ts) owns the outbox
 * drain path with its own schema; this module owns the read paths
 * (`listSongs`, `getSong`) consumed by the `useSongs` / `useSong` hooks,
 * and `putSong` for any non-outbox caller (currently only test fixtures —
 * production writes go through `useSongMutation` → outbox → flusher).
 *
 * Envelope schemas are composed at the call site (Story 2.4 precedent in
 * flusher.ts) — no new shared exports. Schema parse failures and non-2xx
 * statuses throw; TanStack Query's retry layer handles recovery
 * (architecture.md "Error handling" lines 740–753).
 */

const GetSongResponseSchema = z.discriminatedUnion('status', [
  OkResponseSchema(SongSchema),
  ErrorResponseSchema,
]);

const PutSongResponseSchema = z.discriminatedUnion('status', [
  AppliedResponseSchema(SongSchema),
  DroppedAsStaleResponseSchema(SongSchema),
  ErrorResponseSchema,
]);

export async function listSongs(): Promise<Song[]> {
  const response = await apiFetch('/api/v1/songs', {
    method: 'GET',
    schema: OkResponseSchema(z.array(SongSchema)),
  });
  return response.data.data;
}

export async function getSong(songId: string): Promise<Song | null> {
  const response = await apiFetch(`/api/v1/songs/${songId}`, {
    method: 'GET',
    schema: GetSongResponseSchema,
  });
  if (response.data.status === 'ok') return response.data.data;
  if (response.data.status === 'error' && response.data.error.code === 'NOT_FOUND') return null;
  throw new Error(`getSong: unexpected error code ${response.data.error.code}`);
}

export type PutSongResult =
  | { kind: 'applied'; data: Song }
  | { kind: 'dropped-as-stale'; currentState: Song };

export async function putSong(input: SongPutInput): Promise<PutSongResult> {
  const response = await apiFetch(`/api/v1/songs/${input.songId}`, {
    method: 'PUT',
    body: input,
    schema: PutSongResponseSchema,
  });
  if (response.data.status === 'applied') {
    return { kind: 'applied', data: response.data.data };
  }
  if (response.data.status === 'dropped-as-stale') {
    return { kind: 'dropped-as-stale', currentState: response.data.currentState };
  }
  throw new Error(`putSong: error envelope ${response.data.error.code}`);
}
