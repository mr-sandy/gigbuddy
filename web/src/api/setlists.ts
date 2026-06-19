import {
  AppliedResponseSchema,
  DroppedAsStaleResponseSchema,
  ErrorResponseSchema,
  OkResponseSchema,
  type Setlist,
  type SetlistPutInput,
  SetlistSchema,
} from '@gigbuddy/shared';
import { z } from 'zod';
import { apiFetch } from './client.js';

/*
 * The Setlists API surface. Mirrors web/src/api/songs.ts structure. The
 * flusher (sync/flusher.ts) owns the outbox drain path with its own
 * (widened) envelope schema; this module owns the read paths consumed by
 * `useSetlists` / `useSetlist`, and `putSetlist` for any non-outbox caller
 * (currently only test fixtures — production writes go through
 * useSetlistMutation → outbox → flusher).
 *
 * Envelope schemas are composed at the call site — no new shared exports.
 */

const GetSetlistResponseSchema = z.discriminatedUnion('status', [
  OkResponseSchema(SetlistSchema),
  ErrorResponseSchema,
]);

const PutSetlistResponseSchema = z.discriminatedUnion('status', [
  AppliedResponseSchema(SetlistSchema),
  DroppedAsStaleResponseSchema(SetlistSchema),
  ErrorResponseSchema,
]);

export async function listSetlists(): Promise<Setlist[]> {
  const response = await apiFetch('/api/v1/setlists', {
    method: 'GET',
    schema: OkResponseSchema(z.array(SetlistSchema)),
  });
  return response.data.data;
}

export async function getSetlist(setlistId: string): Promise<Setlist | null> {
  const response = await apiFetch(`/api/v1/setlists/${setlistId}`, {
    method: 'GET',
    schema: GetSetlistResponseSchema,
  });
  if (response.data.status === 'ok') return response.data.data;
  if (response.data.status === 'error' && response.data.error.code === 'NOT_FOUND') return null;
  throw new Error(`getSetlist: unexpected error code ${response.data.error.code}`);
}

export type PutSetlistResult =
  | { kind: 'applied'; data: Setlist }
  | { kind: 'dropped-as-stale'; currentState: Setlist };

export async function putSetlist(input: SetlistPutInput): Promise<PutSetlistResult> {
  const response = await apiFetch(`/api/v1/setlists/${input.setlistId}`, {
    method: 'PUT',
    body: input,
    schema: PutSetlistResponseSchema,
  });
  if (response.data.status === 'applied') {
    return { kind: 'applied', data: response.data.data };
  }
  if (response.data.status === 'dropped-as-stale') {
    return { kind: 'dropped-as-stale', currentState: response.data.currentState };
  }
  throw new Error(`putSetlist: error envelope ${response.data.error.code}`);
}
