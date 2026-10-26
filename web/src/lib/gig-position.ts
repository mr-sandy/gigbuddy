import type { Setlist, SongRef } from '@gigbuddy/shared';

/** Every song in the setlist, sections flattened in stored order. */
export function playOrder(setlist: Setlist): SongRef[] {
  return setlist.sections.flatMap((section) => section.songs);
}

/**
 * 0-based index of the place in playOrder for this song, or null when the
 * song isn't in the setlist. `at` is the raw `?at=` value (1-based).
 * A valid `at` whose song matches wins; otherwise the first appearance.
 */
export function resolvePlace(order: SongRef[], songId: string, at: string | null): number | null {
  if (at !== null && /^\d+$/.test(at)) {
    const n = Number(at);
    if (n >= 1 && n <= order.length && order[n - 1]?.songId === songId) return n - 1;
  }
  const first = order.findIndex((ref) => ref.songId === songId);
  return first === -1 ? null : first;
}

/** Link to the gig song page at a 0-based place. */
export function gigSongPath(setlistId: string, order: SongRef[], index: number): string {
  return `/gigs/${setlistId}/songs/${order[index]?.songId}?at=${index + 1}`;
}
