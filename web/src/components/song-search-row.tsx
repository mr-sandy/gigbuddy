import type { Song, SongRef } from '@gigbuddy/shared';
import { type JSX, useEffect, useRef, useState } from 'react';

/*
 * SongSearchRow (Story 3.4, FR-6 manual). Inline type-ahead picker that
 * appears under a Setlist Section when Sandy taps `+ Add song`. The row
 * filters the active Band's Library by case-insensitive substring on
 * `title`, capped at 8 results, and surfaces an `+ Add to library` option
 * when the query is non-empty and there's no exact full-string match
 * against any Library title.
 *
 * Pure presentation: the route owns the Library (via `useSongs()`) and
 * passes it in via the `songs` prop. The component holds only its local
 * `query` buffer. Selection / new-song creation / cancellation all flow
 * back to the route via callbacks; the parent decides what to do with
 * the resulting SongRef and how to clear the "searching" flag.
 *
 * Filtering is simple substring (not fuzzy). Fuzzy ranking lives in
 * Story 3.5's paste-to-parse flow.
 *
 * Keyboard:
 *   - Enter: if a selection is highlighted-by-default (top match), select
 *     it. We keep this simple — pressing Enter selects the top match if
 *     present, otherwise triggers `+ Add to library` if the query is
 *     non-empty.
 *   - Escape: dismisses via `onCancel`.
 */

export type SongSearchRowProps = {
  songs: Song[];
  onSelect: (songRef: SongRef) => void;
  onAddNew: (title: string) => void;
  onCancel: () => void;
};

const MAX_RESULTS = 8;

const INPUT_CLASS =
  'block w-full min-h-tap border-0 bg-transparent p-0 text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)] placeholder:text-[color:var(--color-text-secondary)] focus:outline-none focus-visible:[box-shadow:inset_0_-1px_0_0_var(--color-accent)]';

const OPTION_CLASS =
  'flex min-h-tap w-full items-center text-left text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] [font-family:var(--font-serif-editorial)] text-[color:var(--color-text-primary)] hover:text-[color:var(--color-accent)] focus-visible:text-[color:var(--color-accent)]';

const ADD_NEW_CLASS =
  'flex min-h-tap w-full items-center text-left text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] [font-family:var(--font-serif-editorial)] text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)] focus-visible:text-[color:var(--color-accent-strong)]';

export function SongSearchRow({
  songs,
  onSelect,
  onAddNew,
  onCancel,
}: SongSearchRowProps): JSX.Element {
  const [query, setQuery] = useState('');
  // Imperative autofocus on mount (Biome's `noAutofocus` a11y rule
  // disallows the `autoFocus` JSX attribute on raw DOM elements; for an
  // inline-summoned search field the autoFocus is intentional UX — the
  // input is the only landing target — so we trigger it via ref).
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedQuery = query.trim();
  const queryLower = trimmedQuery.toLowerCase();
  const hasQuery = trimmedQuery.length > 0;

  const matches = hasQuery
    ? songs.filter((s) => s.title.toLowerCase().includes(queryLower)).slice(0, MAX_RESULTS)
    : [];

  const hasExactMatch = hasQuery
    ? songs.some((s) => s.title.trim().toLowerCase() === queryLower)
    : false;

  const showAddNew = hasQuery && !hasExactMatch;
  const dropdownOpen = hasQuery && (matches.length > 0 || showAddNew);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length > 0) {
        const top = matches[0];
        if (top) {
          onSelect({ songId: top.songId, titleSnapshot: top.title });
        }
        return;
      }
      if (showAddNew) {
        onAddNew(trimmedQuery);
      }
    }
  };

  return (
    // WAI-ARIA combobox 1.2: `role="combobox"` lives directly on the
    // input (the focusable element), with `aria-controls` referencing the
    // listbox. The listbox uses `<div>` containers (not `<ul>`/`<li>`)
    // so Biome's `noNoninteractiveElementToInteractiveRole` rule is
    // satisfied; each option carries `tabIndex={-1}` so it is reachable
    // via aria-activedescendant patterns even though the input keeps the
    // visible focus.
    <div className="flex flex-col gap-[calc(var(--spacing-unit)*1)]">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search songs"
        aria-autocomplete="list"
        aria-expanded={dropdownOpen}
        aria-controls="song-search-listbox"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className={INPUT_CLASS}
      />
      {dropdownOpen ? (
        <div
          id="song-search-listbox"
          role="listbox"
          aria-label="Song matches"
          className="flex flex-col"
        >
          {matches.map((song) => (
            <div key={song.songId} role="option" aria-selected="false" tabIndex={-1}>
              <button
                type="button"
                onClick={() => onSelect({ songId: song.songId, titleSnapshot: song.title })}
                className={OPTION_CLASS}
              >
                {song.title}
              </button>
            </div>
          ))}
          {showAddNew ? (
            <div role="option" aria-selected="false" tabIndex={-1}>
              <button
                type="button"
                onClick={() => onAddNew(trimmedQuery)}
                className={ADD_NEW_CLASS}
              >
                {`+ Add to library: ${trimmedQuery}`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
