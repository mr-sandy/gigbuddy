import { Link } from 'react-router';
import { LibrarySongRow } from '../components/library-song-row.js';
import { useSongs } from '../hooks/use-songs.js';
import { ACTIONS, EMPTY_STATES } from '../lib/microcopy.js';

/*
 * Library (FR-4). Lists the active Band's Songs alphabetically — the
 * server alphabetizes; the route trusts the order and does NOT re-sort.
 * Tap a row → /songs/:songId (Story 2.6 registers the destination).
 * `+ New song` → /songs/new (also Story 2.6). The affordance renders in
 * BOTH populated and empty branches so Sandy can always reach creation.
 *
 * Branching order matters: gate on loading BEFORE the empty branch to
 * avoid flashing "No songs in this library yet." during the cold-load
 * fetch. After the persister restore lands (Story 2.4), this window
 * only exists on the very first ever visit.
 */
export function Library() {
  const { data, isLoading } = useSongs();
  const isInitialLoad = data === undefined && isLoading;
  const hasSongs = data !== undefined && data.length > 0;

  return (
    <section aria-labelledby="library-heading">
      <h1 id="library-heading" className="sr-only">
        Library
      </h1>
      <Link
        to="/songs/new"
        className="inline-flex min-h-tap items-center py-[calc(var(--spacing-unit)*2)] text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)] focus-visible:text-[color:var(--color-accent-strong)]"
      >
        {ACTIONS.newSong}
      </Link>
      {isInitialLoad ? (
        <p className="sr-only">Loading library.</p>
      ) : hasSongs ? (
        <ul className="mt-[var(--spacing-section-gap)] flex flex-col">
          {data.map((song) => (
            <LibrarySongRow key={song.songId} song={song} />
          ))}
        </ul>
      ) : (
        <p className="mt-[var(--spacing-section-gap)] text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]">
          {EMPTY_STATES.noSongsInLibrary}
        </p>
      )}
    </section>
  );
}
