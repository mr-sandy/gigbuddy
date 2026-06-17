/*
 * recordKey is the outbox's per-record identifier and the queryClient's
 * cache-key namespace. Format: '<kind>:<bandId>:<resourceId>'.
 *
 * The flusher (sync/flusher.ts) parses a recordKey to route the PUT to
 * the matching /api/v1/* endpoint and to derive the queryKey to invalidate.
 *
 * Story 3.1 adds setlistRecordKey() and extends ParsedRecordKey's union.
 */
export function songRecordKey(bandId: string, songId: string): string {
  return `song:${bandId}:${songId}`;
}

export type ParsedRecordKey =
  | { kind: 'song'; bandId: string; songId: string }
  | { kind: 'unknown' };

export function parseRecordKey(recordKey: string): ParsedRecordKey {
  const parts = recordKey.split(':');
  if (parts.length === 3 && parts[0] === 'song') {
    const bandId = parts[1] ?? '';
    const songId = parts[2] ?? '';
    if (bandId === '' || songId === '') return { kind: 'unknown' };
    return { kind: 'song', bandId, songId };
  }
  return { kind: 'unknown' };
}
