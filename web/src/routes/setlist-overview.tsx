import type { Section, SetlistPutInput, SongRef } from '@gigbuddy/shared';
import { type JSX, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { SectionHeading } from '../components/section-heading.js';
import { SetlistSongRow } from '../components/setlist-song-row.js';
import { useSetlist } from '../hooks/use-setlist.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { formatGigDate } from '../lib/gig-date.js';
import { ACTIONS, EMPTY_STATES } from '../lib/microcopy.js';
import { isIPhone } from '../lib/platform.js';

/*
 * Setlist overview surface (Story 3.3, FR-13 / FR-10 / FR-11; Story 3.6
 * adds drag-reorder on MacBook).
 *
 * The route renders one Setlist: gig metadata header, then each
 * section with an inline-editable heading (MacBook) and a list of
 * SetlistSongRow rows. Per-gig annotations, section renames, and
 * drag-reorder all flow through `useSetlistMutation()` as whole-record
 * PUTs (AR-23): the route deep-copies the cached setlist and replaces
 * only the affected field/position, never sending a partial update.
 *
 * Drag-reorder (FR-12, MacBook only):
 *   - Drag state lives here (parent) because cross-section drops need to
 *     see both sections simultaneously, and the whole `SetlistPutInput`
 *     is built here regardless.
 *   - The native HTML5 DnD events fire on each row. The midpoint of the
 *     row determines whether the drop target is "above" or "below".
 *   - On a valid drop, `handleReorder` deep-copies `sections`, splices
 *     the song out of its source, inserts at the target (accounting for
 *     same-section index shift), and calls `saveSetlist`.
 *   - An invalid drop fires `dragend` without a preceding `drop` — the
 *     drag state is cleared but no save is enqueued; the browser handles
 *     the visual snap-back of the drag image.
 *
 * Keyboard parity: the `Move up` / `Move down` buttons on each row call
 * the same `handleReorder` (within-section only — WCAG 1.3.3 doesn't
 * require cross-section keyboard parity).
 *
 * Atmosphere is fixed at boot — the route doesn't read it; each
 * component decides its own platform-aware behaviour. The
 * iPhone-only `Start performance ›` CTA is rendered inert in Epic 3;
 * Epic 4 wires the actual entry handler.
 */
type DragState = {
  sourceSectionIndex: number;
  sourceSongIndex: number;
} | null;

type DropTarget = {
  sectionIndex: number;
  songIndex: number;
  position: 'above' | 'below';
} | null;

export function SetlistOverview(): JSX.Element {
  const { setlistId } = useParams<{ setlistId: string }>();
  const { data: setlist, isLoading } = useSetlist(setlistId ?? null);
  const { saveSetlist } = useSetlistMutation();
  const navigate = useNavigate();
  const iphone = isIPhone();
  const [dragState, setDragState] = useState<DragState>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

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

  /*
   * handleReorder — the only path that writes a reordered Setlist.
   *
   * Deep-copies `setlist.sections` via structuredClone so the TanStack
   * Query cache reference is never mutated (the hook's optimistic write
   * is what updates the cache atomically). Builds a full SetlistPutInput
   * (AR-23: whole-record PUT) with a fresh `clientWrittenAt` LWW stamp.
   *
   * Index math: when the source and target are in the same section,
   * removing the source shifts later indices down by one — the target
   * index is adjusted accordingly.
   */
  const handleReorder = (
    from: { sectionIndex: number; songIndex: number },
    to: { sectionIndex: number; songIndex: number; position: 'above' | 'below' },
  ): void => {
    if (from.sectionIndex === to.sectionIndex && from.songIndex === to.songIndex) {
      // Dropped on itself — no-op.
      return;
    }

    const sections: Section[] = structuredClone(setlist.sections);
    const sourceSection = sections[from.sectionIndex];
    if (!sourceSection) return;
    const [movedSong] = sourceSection.songs.splice(from.songIndex, 1);
    if (movedSong === undefined) return;

    let targetIndex = to.position === 'above' ? to.songIndex : to.songIndex + 1;
    if (from.sectionIndex === to.sectionIndex && from.songIndex < targetIndex) {
      // Source removal shifted later indices down by one.
      targetIndex -= 1;
    }

    const targetSection = sections[to.sectionIndex];
    if (!targetSection) return;
    // Clamp to valid bounds (an extra safeguard against drop math edge
    // cases when target section length changes mid-drag — keep within
    // [0, length]).
    targetIndex = Math.max(0, Math.min(targetIndex, targetSection.songs.length));
    targetSection.songs.splice(targetIndex, 0, movedSong);

    const updated: SetlistPutInput = {
      bandId: setlist.bandId,
      setlistId: setlist.setlistId,
      gigMeta: setlist.gigMeta,
      version: setlist.version,
      clientWrittenAt: new Date().toISOString(),
      sections,
    };
    void saveSetlist(updated);
  };

  const handleDragStart = (sectionIndex: number, songIndex: number): void => {
    setDragState({ sourceSectionIndex: sectionIndex, sourceSongIndex: songIndex });
    setDropTarget(null);
  };

  const handleDragOverRow = (
    sectionIndex: number,
    songIndex: number,
    position: 'above' | 'below',
  ): void => {
    // Only update if the new target differs from current — avoids extra
    // renders on every pointer move within the same half-row.
    if (
      dropTarget?.sectionIndex === sectionIndex &&
      dropTarget?.songIndex === songIndex &&
      dropTarget?.position === position
    ) {
      return;
    }
    setDropTarget({ sectionIndex, songIndex, position });
  };

  const handleDropRow = (
    sectionIndex: number,
    songIndex: number,
    position: 'above' | 'below',
  ): void => {
    if (!dragState) return;
    handleReorder(
      { sectionIndex: dragState.sourceSectionIndex, songIndex: dragState.sourceSongIndex },
      { sectionIndex, songIndex, position },
    );
    setDragState(null);
    setDropTarget(null);
  };

  const handleDragEnd = (): void => {
    // Fires for both successful and invalid drops. Clearing state here
    // guarantees no stale highlight or lifted row persists after the
    // browser snaps the drag image back on an invalid drop.
    setDragState(null);
    setDropTarget(null);
  };

  const handleMoveUp = (sectionIndex: number, songIndex: number): void => {
    if (songIndex <= 0) return;
    handleReorder(
      { sectionIndex, songIndex },
      { sectionIndex, songIndex: songIndex - 1, position: 'above' },
    );
  };

  const handleMoveDown = (sectionIndex: number, songIndex: number): void => {
    const section = setlist.sections[sectionIndex];
    if (!section || songIndex >= section.songs.length - 1) return;
    handleReorder(
      { sectionIndex, songIndex },
      { sectionIndex, songIndex: songIndex + 1, position: 'below' },
    );
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
          // record).
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
            {section.songs.map((songRef, songIndex) => {
              const isThisRowDragging =
                dragState?.sourceSectionIndex === sectionIndex &&
                dragState?.sourceSongIndex === songIndex;
              const isThisRowDropAbove =
                dropTarget?.sectionIndex === sectionIndex &&
                dropTarget?.songIndex === songIndex &&
                dropTarget?.position === 'above';
              const isThisRowDropBelow =
                dropTarget?.sectionIndex === sectionIndex &&
                dropTarget?.songIndex === songIndex &&
                dropTarget?.position === 'below';
              // Drag-reorder props are wired on MacBook only (FR-12;
              // AC-7 requires NO drag handle, NO Move up/down, NO
              // draggable attribute on iPhone). Build the optional
              // props as a spreadable object so `exactOptionalPropertyTypes`
              // sees them as omitted on iPhone rather than as `undefined`.
              const dragProps = iphone
                ? {}
                : {
                    onDragStart: handleDragStart,
                    onDragOverRow: handleDragOverRow,
                    onDropRow: handleDropRow,
                    onDragEnd: handleDragEnd,
                    onMoveUp: handleMoveUp,
                    onMoveDown: handleMoveDown,
                  };
              return (
                <SetlistSongRow
                  // Same reasoning as section keys — see above.
                  // biome-ignore lint/suspicious/noArrayIndexKey: song position within a section is its identity
                  key={songIndex}
                  songRef={songRef}
                  sectionIndex={sectionIndex}
                  songIndex={songIndex}
                  onNavigate={(songId) => navigate(`/songs/${songId}`)}
                  onAnnotationChange={handleAnnotationChange}
                  isDragging={isThisRowDragging}
                  isDropTargetAbove={isThisRowDropAbove}
                  isDropTargetBelow={isThisRowDropBelow}
                  isFirstInSection={songIndex === 0}
                  isLastInSection={songIndex === section.songs.length - 1}
                  {...dragProps}
                />
              );
            })}
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
