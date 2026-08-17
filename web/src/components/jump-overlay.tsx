import type { Section, Song, SongRef } from '@gigbuddy/shared';
import { type JSX, useEffect, useMemo, useState } from 'react';
import { useSongs } from '../hooks/use-songs.js';
import { JUMP_OVERLAY, SECTION_HEADING } from '../lib/microcopy.js';

/*
 * JumpOverlay — Story 6.3 shell + Story 6.4 content fill (P1 5-a lock,
 * unified-jump-scope).
 *
 * Full-screen overlay ("on top of the performance card") reached by
 * tapping the `≡ jump` control in the Performance Card's bottom toolbar.
 *
 *   ┌──────────────────────────────┐   shrink-0   ← top chrome (dismiss only):
 *   │  ‹                           │              ‹ top-left, low-emphasis
 *   ├──────────────────────────────┤
 *   │  Search this setlist or lib. │   shrink-0   ← pinned search input
 *   ├──────────────────────────────┤
 *   │  Set 1   6 songs             │              ← sectioned setlist overview
 *   │    Autumn Leaves       Em    │   flex-1     (when no query); or the
 *   │    ...                       │   overflow-y `In this setlist`/`In library`
 *   │  Set 2   5 songs             │              filtered groups (when a query
 *   │    ...                       │              is typed).
 *   └──────────────────────────────┘
 *
 * Explicitly out of scope for THIS story (owned by Story 6.5):
 *   - the `DETOUR` position-slot swap on the underlying card
 *   - `NEXT ›` returning to plan-cursor + 1 / `‹` undoing the jump
 *   - the Currently-performing-strip `↩` detour signal on the overview
 *
 * Story 6.4's job is narrow: guarantee that tapping a row makes the
 * Performance Card display the tapped song without moving the URL-encoded
 * plan cursor. The display-override plumbing lives in `PerformanceCard`;
 * this component just calls `onSelectSong(songId)` then dismisses.
 *
 * State ownership: overlay open/closed is single-route local UI state in
 * PerformanceCard's `useState<boolean>` — deliberately NOT part of
 * PerformanceModeContext (matches Story 6.3 precedent). The `query` string
 * is component-local to this overlay: opening/dismissing/re-opening always
 * starts with a fresh empty query (AC-7), no extra unmount plumbing
 * needed.
 *
 * Data reach: `useSongs()` (Story 2.5) is the ONLY new data source this
 * component pulls — the library is read from the client-side TanStack
 * Query cache, so this satisfies AR-28 (performance-mode reads from cache,
 * no auth-redirect on failure) by the same mechanism as `useSetlist()` /
 * `useSong()` in the underlying card.
 *
 * Positioning: `fixed inset-0` (full-screen), not a bottom sheet.
 *
 * Transition: real 150ms opacity fade on mount and dismiss (AC-3 from
 * Story 6.3). Row selection reuses `handleDismiss()` so the same fade
 * plays whether Sandy taps `‹` or a row.
 *
 * Accessibility:
 *   - `role="dialog" aria-modal="true"` on the root (unchanged from 6.3)
 *   - pinned search input carries both `aria-label` and `placeholder`
 *     `Search this setlist or library`
 *   - the row corresponding to the currently-displayed song (the
 *     `currentSongId` prop) is `accent`-filled AND carries
 *     `aria-current="true"` — the non-color signal required by
 *     architecture.md's color-never-alone rule (line 831).
 *
 * Reuse discipline:
 *   - `SECTION_HEADING.songCount` (Story 6.2) supplies `<n> song(s)` —
 *     no local pluralisation.
 *   - `<SectionHeading>` the *component* is NOT reused (it carries a
 *     MacBook-only rename branch that has no purpose here); the token
 *     references are re-declared locally instead.
 *   - `useSongs()` is called once and shared: the same Map is used both
 *     to look up per-row `key` and to compute library-reach matches.
 */

type JumpOverlayProps = {
  sections: Section[];
  currentSongId: string;
  onDismiss: () => void;
  onSelectSong: (songId: string) => void;
};

// Section-heading tokens — mirror `section-heading.tsx`'s NAME_CLASS /
// COUNT_CLASS (they aren't exported for reuse; re-declaring is the
// cheapest way to keep this overlay a lighter, read-only component).
const SECTION_NAME_CLASS =
  'text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-secondary)] uppercase tracking-wide [font-variant-caps:small-caps]';

const SECTION_COUNT_CLASS =
  'text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]';

// `In this setlist` / `In library` group headings — same small-caps
// treatment as the setlist-section headings but stand-alone (no count).
const GROUP_HEADING_CLASS = SECTION_NAME_CLASS;

// Song title — mirror `setlist-song-row.tsx`'s TITLE_CLASS (serif,
// `--text-perf-body`). Color is applied on the parent button so the
// accent-highlight state can flip title AND key to `--color-bg` in one
// place; the spans inherit the button's `color`.
const ROW_TITLE_CLASS =
  'text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] font-[family-name:var(--font-serif-editorial)]';

// Song key — mono, `--text-practice-body`. Color inherited from the
// parent button (see `ROW_TITLE_CLASS` note).
const ROW_KEY_CLASS =
  'text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] font-[family-name:var(--font-mono-slab)]';

// Row layout — title on the left, key aligned to the right. Full-width
// tap target with min-h-tap so all rows are comfortably touchable.
const ROW_BUTTON_CLASS =
  'flex min-h-tap w-full items-baseline justify-between gap-[calc(var(--spacing-unit)*3)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*2)] text-left text-[color:var(--color-text-primary)]';

// Highlight for the currently-displayed song (`currentSongId`). Accent
// fill + bg-colored text, paired with `aria-current="true"` — the row's
// non-color signal per architecture.md line 831.
const ROW_BUTTON_HIGHLIGHT_CLASS =
  'flex min-h-tap w-full items-baseline justify-between gap-[calc(var(--spacing-unit)*3)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*2)] text-left bg-[color:var(--color-accent)] text-[color:var(--color-bg)]';

// Serif search input — mirrors `song-search-row.tsx`'s INPUT_CLASS.
const SEARCH_INPUT_CLASS =
  'block w-full min-h-tap border-0 bg-transparent p-0 text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)] placeholder:text-[color:var(--color-text-secondary)] focus:outline-none focus-visible:[box-shadow:inset_0_-1px_0_0_var(--color-accent)]';

export function JumpOverlay({
  sections,
  currentSongId,
  onDismiss,
  onSelectSong,
}: JumpOverlayProps): JSX.Element {
  // Mount fade: start at opacity-0, then flip to opacity-100 after the
  // first paint. A requestAnimationFrame + microtask defer gives the
  // browser a distinct starting frame so the transition actually runs.
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  function handleDismiss(): void {
    if (closing) return;
    setClosing(true);
    // Wait for the fade-out to complete before telling the parent to
    // unmount. Matches the Tailwind `duration-150` on the root.
    setTimeout(() => {
      onDismiss();
    }, 150);
  }

  function handleSelectRow(songId: string): void {
    onSelectSong(songId);
    handleDismiss();
  }

  const visible = mounted && !closing;

  // Library reach (AC-4) + per-row key lookups (setlist SongRef has no
  // key field of its own — `shared/src/schemas/setlist.ts`). One
  // `useSongs()` call powers both.
  const { data: librarySongs } = useSongs();
  const songsById = useMemo(
    () => new Map((librarySongs ?? []).map<[string, Song]>((s) => [s.songId, s])),
    [librarySongs],
  );

  // Every setlist SongRef's id — used to de-dup the `In library` results
  // (AC-4: a matching setlist song must not also render under `In library`).
  const setlistSongIds = useMemo(
    () => new Set(sections.flatMap((sec) => sec.songs.map((sr) => sr.songId))),
    [sections],
  );

  const trimmedQuery = query.trim();
  const queryLower = trimmedQuery.toLowerCase();
  const hasQuery = trimmedQuery.length > 0;

  // Flatten setlist SongRefs once for filtering. Order preserved:
  // sections in order, songs within each section in order.
  const flatSetlistSongs = useMemo(() => sections.flatMap((sec) => sec.songs), [sections]);

  const setlistMatches: SongRef[] = hasQuery
    ? flatSetlistSongs.filter((sr) => sr.titleSnapshot.toLowerCase().includes(queryLower))
    : [];

  const libraryMatches: Song[] = hasQuery
    ? (librarySongs ?? []).filter(
        (s) => s.title.toLowerCase().includes(queryLower) && !setlistSongIds.has(s.songId),
      )
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jump to a song"
      className={`fixed inset-0 z-50 flex flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)] transition-opacity duration-150 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Top chrome — dismiss control + pinned search input. */}
      <div
        className="shrink-0 bg-[color:var(--color-surface)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*4)]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <button
          type="button"
          aria-label="Dismiss jump overlay"
          onClick={handleDismiss}
          className="min-h-tap min-w-tap text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-secondary)]"
        >
          ‹
        </button>
        <div className="mt-[calc(var(--spacing-unit)*3)]">
          <input
            type="search"
            aria-label={JUMP_OVERLAY.searchLabel}
            placeholder={JUMP_OVERLAY.searchLabel}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={SEARCH_INPUT_CLASS}
          />
        </div>
      </div>

      {/* Content region — sectioned setlist overview (no query) OR
          `In this setlist` / `In library` filtered groups (with query).
          Silent when a query matches neither (no invented "no matches"
          copy — see story Dev Notes). */}
      <div className="flex-1 overflow-y-auto py-[calc(var(--spacing-unit)*2)]">
        {!hasQuery ? (
          <div className="flex flex-col gap-[calc(var(--spacing-unit)*4)]">
            {sections.map((section) => (
              <SetlistSection
                key={`section-${section.name}`}
                section={section}
                currentSongId={currentSongId}
                songsById={songsById}
                onSelectRow={handleSelectRow}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-[calc(var(--spacing-unit)*4)]">
            {setlistMatches.length > 0 ? (
              <div>
                <div className="px-[var(--spacing-gutter)] pb-[calc(var(--spacing-unit)*2)]">
                  <span className={GROUP_HEADING_CLASS}>{JUMP_OVERLAY.inThisSetlistHeading}</span>
                </div>
                <ul className="flex flex-col">
                  {setlistMatches.map((songRef) => (
                    <li key={`setlist-match-${songRef.songId}`}>
                      <SongRow
                        songId={songRef.songId}
                        title={songRef.titleSnapshot}
                        songKey={songsById.get(songRef.songId)?.key}
                        isCurrent={songRef.songId === currentSongId}
                        onSelect={handleSelectRow}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {libraryMatches.length > 0 ? (
              <div>
                <div className="px-[var(--spacing-gutter)] pb-[calc(var(--spacing-unit)*2)]">
                  <span className={GROUP_HEADING_CLASS}>{JUMP_OVERLAY.inLibraryHeading}</span>
                </div>
                <ul className="flex flex-col">
                  {libraryMatches.map((song) => (
                    <li key={`library-match-${song.songId}`}>
                      <SongRow
                        songId={song.songId}
                        title={song.title}
                        songKey={song.key}
                        isCurrent={song.songId === currentSongId}
                        onSelect={handleSelectRow}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

type SetlistSectionProps = {
  section: Section;
  currentSongId: string;
  songsById: Map<string, Song>;
  onSelectRow: (songId: string) => void;
};

function SetlistSection({
  section,
  currentSongId,
  songsById,
  onSelectRow,
}: SetlistSectionProps): JSX.Element {
  return (
    <div>
      <div className="flex items-baseline gap-[calc(var(--spacing-unit)*2)] px-[var(--spacing-gutter)] pb-[calc(var(--spacing-unit)*2)]">
        <span className={SECTION_NAME_CLASS}>{section.name}</span>
        <span className={SECTION_COUNT_CLASS}>
          {SECTION_HEADING.songCount(section.songs.length)}
        </span>
      </div>
      <ul className="flex flex-col">
        {section.songs.map((songRef) => (
          <li key={`section-song-${songRef.songId}`}>
            <SongRow
              songId={songRef.songId}
              title={songRef.titleSnapshot}
              songKey={songsById.get(songRef.songId)?.key}
              isCurrent={songRef.songId === currentSongId}
              onSelect={onSelectRow}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

type SongRowProps = {
  songId: string;
  title: string;
  songKey: string | undefined;
  isCurrent: boolean;
  onSelect: (songId: string) => void;
};

function SongRow({ songId, title, songKey, isCurrent, onSelect }: SongRowProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(songId)}
      aria-current={isCurrent ? 'true' : undefined}
      className={isCurrent ? ROW_BUTTON_HIGHLIGHT_CLASS : ROW_BUTTON_CLASS}
    >
      <span className={ROW_TITLE_CLASS}>{title}</span>
      {songKey !== undefined && songKey !== '' ? (
        // Key remains lighter than the title in the non-highlighted row
        // (text-secondary via the same `text-[color:...]` utility that
        // otherwise would break inheritance) — but when the row IS the
        // current row the accent-fill highlight owns the color, so we
        // let the key inherit the button's `--color-bg` text color.
        <span
          className={
            isCurrent ? ROW_KEY_CLASS : `${ROW_KEY_CLASS} text-[color:var(--color-text-secondary)]`
          }
        >
          {songKey}
        </span>
      ) : null}
    </button>
  );
}
