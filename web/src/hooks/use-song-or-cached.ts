import type { Song } from '@gigbuddy/shared';
import { SONGS } from '../lib/microcopy.js';
import { useSong } from './use-song.js';
import { useSongs } from './use-songs.js';

/*
 * Resolves one song for a page: the single-song query wins, the list cache
 * fills in while it loads (instant title, works offline). When no song is
 * available, `statusLine` says why (not found / loading / error).
 */
export function useSongOrCached(songId: string | undefined): {
  song: Song | undefined;
  statusLine: string | null;
} {
  const one = useSong(songId ?? null);
  const list = useSongs();

  const song = one.data ?? list.data?.find((s) => s.songId === songId);
  const statusLine = song
    ? null
    : one.data === null
      ? SONGS.notFound
      : one.isPending || list.isPending
        ? SONGS.loading
        : SONGS.error;
  return { song, statusLine };
}
