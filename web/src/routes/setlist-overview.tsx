import type { Section, SetlistPutInput, SongRef } from '@gigbuddy/shared';
import type { JSX } from 'react';
import { useNavigate, useParams } from 'react-router';
import { SectionHeading } from '../components/section-heading.js';
import { SetlistSongRow } from '../components/setlist-song-row.js';
import { useSetlist } from '../hooks/use-setlist.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { formatGigDate } from '../lib/gig-date.js';
import { ACTIONS, EMPTY_STATES } from '../lib/microcopy.js';
import { isIPhone } from '../lib/platform.js';

/*
 * Setlist overview surface (Story 3.3, FR-13 / FR-10 / FR-11).
 *
 * The route renders one Setlist: gig metadata header, then each
 * section with an inline-editable heading (MacBook) and a list of
 * SetlistSongRow rows. Per-gig annotations and section renames flow
 * through `useSetlistMutation()` as whole-record PUTs (AR-23): the
 * route deep-copies the cached setlist and replaces only the affected
 * field, never sending a partial update.
 *
 * Atmosphere is fixed at boot — the route doesn't read it; each
 * component decides its own platform-aware behaviour. The
 * iPhone-only `Start performance ›` CTA is rendered inert in Epic 3;
 * Epic 4 wires the actual entry handler.
 *
 * `CurrentlyPerformingStrip` (Epic 4) mounts at the top of the
 * content area on iPhone — the slot is reserved as a comment here
 * with no DOM (no empty <div>) so Epic 4 can drop the component in
 * without restructuring the route.
 */
export function SetlistOverview(): JSX.Element {
  const { setlistId } = useParams<{ setlistId: string }>();
  const { data: setlist, isLoading } = useSetlist(setlistId ?? null);
  const { saveSetlist } = useSetlistMutation();
  const navigate = useNavigate();
  const iphone = isIPhone();

  if (isLoading || setlist === undefined) {
    // Quiet skeleton (no spinner, no copy). The route renders an empty
    // section; TanStack Query will rerender once the fetch resolves.
    return <section aria-labelledby="setlist-overview-heading" />;
  }

  if (setlist === null) {
    return (
      <section aria-labelledby="setlist-overview-heading">
        <h1 id="setlist-overview-heading" className="sr-only">
          Setlist
        </h1>
        <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-primary)]">
          {EMPTY_STATES.setlistNotFound}
        </p>
      </section>
    );
  }

  const handleRename = (sectionIndex: number, newName: string): void => {
    const updated: SetlistPutInput = {
      bandId: setlist.bandId,
      setlistId: setlist.setlistId,
      gigMeta: setlist.gigMeta,
      version: setlist.version,
      clientWrittenAt: new Date().toISOString(),
      sections: setlist.sections.map(
        (section, si): Section => (si !== sectionIndex ? section : { ...section, name: newName }),
      ),
    };
    void saveSetlist(updated);
  };

  const handleAnnotationChange = (
    sectionIndex: number,
    songIndex: number,
    newAnnotation: string,
  ): void => {
    const updated: SetlistPutInput = {
      bandId: setlist.bandId,
      setlistId: setlist.setlistId,
      gigMeta: setlist.gigMeta,
      version: setlist.version,
      clientWrittenAt: new Date().toISOString(),
      sections: setlist.sections.map((section, si): Section => {
        if (si !== sectionIndex) return section;
        return {
          ...section,
          songs: section.songs.map((song, ji): SongRef => {
            if (ji !== songIndex) return song;
            // Empty string clears the annotation — store as `undefined`
            // so the field is omitted from the wire payload, matching
            // the SongRefSchema (perGigAnnotation: z.string().optional()).
            const trimmed = newAnnotation;
            const next: SongRef = {
              songId: song.songId,
              titleSnapshot: song.titleSnapshot,
            };
            if (trimmed.length > 0) {
              next.perGigAnnotation = trimmed;
            }
            return next;
          }),
        };
      }),
    };
    void saveSetlist(updated);
  };

  const { venue, date, time } = setlist.gigMeta;
  const dateDisplay = time ? `${formatGigDate(date)} · ${time}` : formatGigDate(date);

  return (
    <section
      aria-labelledby="setlist-overview-heading"
      className="flex flex-col gap-[var(--spacing-section-gap)]"
    >
      {/* Epic 4: <CurrentlyPerformingStrip /> mounts here. */}
      <header className="flex flex-col gap-[calc(var(--spacing-unit)*1)]">
        <h1
          id="setlist-overview-heading"
          className="text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-primary)]"
        >
          {venue}
        </h1>
        <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]">
          {dateDisplay}
        </p>
      </header>

      {setlist.sections.map((section, sectionIndex) => (
        <section
          // Section order is content (positions are stable for the
          // lifetime of one render and the index is the position-of-
          // record). Story 3.6 introduces drag-reorder which will
          // reposition entries — at that point keys may need
          // setlistId-scoped UUIDs, but for read-only display the
          // index key is correct.
          // biome-ignore lint/suspicious/noArrayIndexKey: section order is its identity (AR-23 whole-record PUT)
          key={sectionIndex}
          aria-labelledby={`setlist-section-${sectionIndex}-heading`}
          className="flex flex-col gap-[calc(var(--spacing-unit)*3)]"
        >
          <div id={`setlist-section-${sectionIndex}-heading`}>
            <SectionHeading
              name={section.name}
              songCount={section.songs.length}
              sectionIndex={sectionIndex}
              onRename={handleRename}
            />
          </div>
          <ul className="flex flex-col gap-[calc(var(--spacing-unit)*2)]">
            {section.songs.map((songRef, songIndex) => (
              <SetlistSongRow
                // Same reasoning as section keys — see above.
                // biome-ignore lint/suspicious/noArrayIndexKey: song position within a section is its identity
                key={songIndex}
                songRef={songRef}
                sectionIndex={sectionIndex}
                songIndex={songIndex}
                onNavigate={(songId) => navigate(`/songs/${songId}`)}
                onAnnotationChange={handleAnnotationChange}
              />
            ))}
          </ul>
        </section>
      ))}

      {iphone ? (
        <button
          type="button"
          aria-label={ACTIONS.startPerformance}
          className="fixed inset-x-0 bottom-0 z-40 flex min-h-[64px] items-start justify-center bg-[color:var(--color-accent)] pt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-bg)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 50px)' }}
        >
          {ACTIONS.startPerformance}
        </button>
      ) : null}
    </section>
  );
}
