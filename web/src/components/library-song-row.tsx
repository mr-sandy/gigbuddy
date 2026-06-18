import type { Song } from '@gigbuddy/shared';
import { Link } from 'react-router';

/*
 * Library variant of the Song row (UX-DR4, EXPERIENCE.md Component
 * Patterns line 95): title only, quiet treatment, no row actions, no
 * annotation subline. The whole row IS the link — tap target satisfies
 * min-h-tap (44pt; --spacing-tap in tokens.css). The row consumes the
 * Song via props only — list ownership lives in the route.
 *
 * Story 3.3 will land the Setlist variant (`SetlistSongRow`) which adds
 * the per-gig annotation subline and the MacBook drag handle.
 */
export function LibrarySongRow({ song }: { song: Song }) {
  return (
    <li>
      <Link
        to={`/songs/${song.songId}`}
        className="flex min-h-tap items-center py-[calc(var(--spacing-unit)*3)] text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-primary)] decoration-[color:var(--color-accent)] [font-family:var(--font-serif-editorial)] hover:underline focus-visible:underline"
      >
        {song.title}
      </Link>
    </li>
  );
}
