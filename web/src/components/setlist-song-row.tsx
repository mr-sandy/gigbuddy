import type { SongRef } from '@gigbuddy/shared';
import { type JSX, type DragEvent as ReactDragEvent, useEffect, useRef, useState } from 'react';
import { ACTIONS, DRAG_REORDER } from '../lib/microcopy.js';
import { InlineEditField } from './inline-edit-field.js';

/*
 * SetlistSongRow (Story 3.3, FR-11; Story 3.6, FR-12). Renders one song
 * inside a setlist section with an optional per-gig annotation subline.
 *
 *   - MacBook (practice):
 *       * tap on title → navigates to /songs/:songId via onNavigate
 *       * tap on annotation slot → opens an inline `InlineEditField`
 *         pre-filled with the current annotation; blur commits via
 *         onAnnotationChange(sectionIndex, songIndex, newValue)
 *       * drag handle on the left (revealed on row hover) initiates a
 *         native HTML5 drag (FR-12); a `Move up` / `Move down` button
 *         pair gives screen-reader / keyboard parity
 *
 *   - iPhone (performance):
 *       * tap anywhere on the row → opens a bottom-sheet dialog
 *       * NO drag handle, NO Move up/down buttons, NO `draggable`
 *         attribute on the <li> (AC-7) — performance-mode safety
 *
 * Drag state lives in the parent route (`setlist-overview.tsx`); this
 * component is purely a controlled presenter — it never calls saveSetlist
 * directly (AR-45 hook boundary). All callbacks are optional so the
 * iPhone branch can omit drag wiring entirely.
 *
 * Atmosphere detection reads `document.documentElement.dataset.atmosphere`
 * at render time (same pattern as song-detail.tsx and section-heading.tsx).
 */

function readAtmosphere(): 'practice' | 'performance' {
  if (typeof document === 'undefined') return 'practice';
  return document.documentElement.dataset.atmosphere === 'performance' ? 'performance' : 'practice';
}

export type SetlistSongRowProps = {
  songRef: SongRef;
  sectionIndex: number;
  songIndex: number;
  onNavigate: (songId: string) => void;
  onAnnotationChange: (sectionIndex: number, songIndex: number, newAnnotation: string) => void;
  // Story 3.6 — drag-reorder wiring (MacBook only). All optional so the
  // iPhone branch can omit them safely; MacBook tests can render the row
  // in isolation without parent drag state.
  isDragging?: boolean;
  isDropTargetAbove?: boolean;
  isDropTargetBelow?: boolean;
  isFirstInSection?: boolean;
  isLastInSection?: boolean;
  onDragStart?: (sectionIndex: number, songIndex: number, event: ReactDragEvent) => void;
  onDragOverRow?: (
    sectionIndex: number,
    songIndex: number,
    position: 'above' | 'below',
    event: ReactDragEvent,
  ) => void;
  onDropRow?: (
    sectionIndex: number,
    songIndex: number,
    position: 'above' | 'below',
    event: ReactDragEvent,
  ) => void;
  onDragEnd?: () => void;
  onMoveUp?: (sectionIndex: number, songIndex: number) => void;
  onMoveDown?: (sectionIndex: number, songIndex: number) => void;
};

const TITLE_CLASS =
  'text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-primary)]';
const ANNOTATION_CLASS =
  'italic text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] [font-family:var(--font-serif-editorial)] text-[color:var(--color-accent)]';

export function SetlistSongRow(props: SetlistSongRowProps): JSX.Element {
  const atmosphere = readAtmosphere();
  if (atmosphere === 'performance') {
    return (
      <IPhoneRow
        songRef={props.songRef}
        sectionIndex={props.sectionIndex}
        songIndex={props.songIndex}
        onAnnotationChange={props.onAnnotationChange}
      />
    );
  }
  return <MacBookRow {...props} />;
}

function MacBookRow({
  songRef,
  sectionIndex,
  songIndex,
  onNavigate,
  onAnnotationChange,
  isDragging,
  isDropTargetAbove,
  isDropTargetBelow,
  isFirstInSection,
  isLastInSection,
  onDragStart,
  onDragOverRow,
  onDropRow,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}: SetlistSongRowProps): JSX.Element {
  const [editingAnnotation, setEditingAnnotation] = useState(false);
  const annotation = songRef.perGigAnnotation ?? '';
  const hasAnnotation = annotation.trim() !== '';

  const handleCommit = (next: string): void => {
    onAnnotationChange(sectionIndex, songIndex, next);
    setEditingAnnotation(false);
  };

  // Whether this row participates in native HTML5 drag. The row is only
  // draggable when the parent has wired the drag callbacks; standalone
  // renders (some tests) leave drag handlers undefined.
  const dragEnabled = onDragStart !== undefined && onDropRow !== undefined;

  const handleDragStart = (event: ReactDragEvent): void => {
    if (!onDragStart) return;
    // Mark the move semantics (browsers show a "move" cursor instead of
    // "copy"). The actual identity travels through component state in
    // the parent, not through dataTransfer — but we set a minimal
    // payload so Firefox treats the drag as valid.
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${sectionIndex}:${songIndex}`);
    onDragStart(sectionIndex, songIndex, event);
  };

  const handleDragOver = (event: ReactDragEvent): void => {
    if (!onDragOverRow) return;
    // Required to permit a drop (preventDefault flips dropEffect on).
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const position: 'above' | 'below' =
      event.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    onDragOverRow(sectionIndex, songIndex, position, event);
  };

  const handleDrop = (event: ReactDragEvent): void => {
    if (!onDropRow) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const position: 'above' | 'below' =
      event.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    onDropRow(sectionIndex, songIndex, position, event);
  };

  const handleDragEnd = (): void => {
    onDragEnd?.();
  };

  // Lift effect while THIS row is the source. Card shadow + slight
  // opacity keeps the original slot legible. Reduced-motion honored by
  // the global `transition-duration: 0ms` rule in globals.css.
  const liClasses = [
    'group relative flex min-h-tap flex-col gap-[calc(var(--spacing-unit)*1)] py-[calc(var(--spacing-unit)*2)] pl-[calc(var(--spacing-unit)*5)]',
    'transition-shadow duration-150',
    isDragging ? 'opacity-60 shadow-[var(--shadow-card)]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Drop-zone highlight rendered as accent-colored bar at top or bottom
  // of the row. Position is determined by the parent via the
  // isDropTargetAbove / isDropTargetBelow flags so the parent can
  // disambiguate "above row N" from "below row N-1" cleanly.
  const dropBarTop = isDropTargetAbove
    ? 'before:absolute before:left-0 before:right-0 before:top-0 before:h-[2px] before:bg-[color:var(--color-accent)] before:content-[""]'
    : '';
  const dropBarBottom = isDropTargetBelow
    ? 'after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:bg-[color:var(--color-accent)] after:content-[""]'
    : '';

  return (
    <li
      className={`${liClasses} ${dropBarTop} ${dropBarBottom}`.trim()}
      draggable={dragEnabled || undefined}
      onDragStart={dragEnabled ? handleDragStart : undefined}
      onDragOver={dragEnabled ? handleDragOver : undefined}
      onDrop={dragEnabled ? handleDrop : undefined}
      onDragEnd={dragEnabled ? handleDragEnd : undefined}
    >
      {dragEnabled ? (
        <span className="pointer-events-none absolute left-0 top-0 flex h-full items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {/* Drag handle: a non-interactive label for the <li>'s draggable
              affordance. Native HTML5 DnD initiates on mousedown of the
              <li> itself; the handle exists to surface the affordance
              visually and to host the aria-label / Move up-down buttons.
              We mark the handle aria-hidden because the <li>'s combined
              keyboard buttons provide the screen-reader path. */}
          <span
            role="img"
            aria-label={DRAG_REORDER.handleLabel(songRef.titleSnapshot)}
            className="pointer-events-auto flex min-h-tap min-w-[calc(var(--spacing-unit)*5)] cursor-grab items-center justify-center text-[color:var(--color-text-secondary)] active:cursor-grabbing"
          >
            <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
              <title>{DRAG_REORDER.handleLabel(songRef.titleSnapshot)}</title>
              <circle cx="3" cy="4" r="1.5" fill="currentColor" />
              <circle cx="9" cy="4" r="1.5" fill="currentColor" />
              <circle cx="3" cy="8" r="1.5" fill="currentColor" />
              <circle cx="9" cy="8" r="1.5" fill="currentColor" />
              <circle cx="3" cy="12" r="1.5" fill="currentColor" />
              <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </span>
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onNavigate(songRef.songId)}
        className={`text-left ${TITLE_CLASS} hover:underline focus-visible:underline decoration-[color:var(--color-accent)]`}
      >
        {songRef.titleSnapshot}
      </button>

      {editingAnnotation ? (
        <InlineEditField
          value={annotation}
          onCommit={handleCommit}
          ariaLabel={`Per-gig note for ${songRef.titleSnapshot}`}
          inputClassName={ANNOTATION_CLASS}
          autoFocus
          multiline
        />
      ) : hasAnnotation ? (
        <button
          type="button"
          onClick={() => setEditingAnnotation(true)}
          aria-label={`Edit per-gig note for ${songRef.titleSnapshot}`}
          className={`text-left ${ANNOTATION_CLASS}`}
        >
          {annotation}
        </button>
      ) : (
        // AC-7 (Story 3.3): no visible affordance when no annotation;
        // sr-only preserves AC-9 keyboard access.
        <button
          type="button"
          onClick={() => setEditingAnnotation(true)}
          aria-label={`Add per-gig note for ${songRef.titleSnapshot}`}
          className="sr-only"
        />
      )}

      {onMoveUp !== undefined && onMoveDown !== undefined ? (
        <div className="absolute right-0 top-0 flex h-full items-center gap-[calc(var(--spacing-unit)*1)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            aria-label={DRAG_REORDER.moveUp}
            aria-disabled={isFirstInSection ? true : undefined}
            disabled={isFirstInSection}
            onClick={isFirstInSection ? undefined : () => onMoveUp(sectionIndex, songIndex)}
            className="flex min-h-tap min-w-tap items-center justify-center text-[color:var(--color-text-secondary)] disabled:opacity-40"
          >
            <span aria-hidden="true">▲</span>
          </button>
          <button
            type="button"
            aria-label={DRAG_REORDER.moveDown}
            aria-disabled={isLastInSection ? true : undefined}
            disabled={isLastInSection}
            onClick={isLastInSection ? undefined : () => onMoveDown(sectionIndex, songIndex)}
            className="flex min-h-tap min-w-tap items-center justify-center text-[color:var(--color-text-secondary)] disabled:opacity-40"
          >
            <span aria-hidden="true">▼</span>
          </button>
        </div>
      ) : null}
    </li>
  );
}

type IPhoneRowProps = Pick<
  SetlistSongRowProps,
  'songRef' | 'sectionIndex' | 'songIndex' | 'onAnnotationChange'
>;

function IPhoneRow({
  songRef,
  sectionIndex,
  songIndex,
  onAnnotationChange,
}: IPhoneRowProps): JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false);
  const annotation = songRef.perGigAnnotation ?? '';
  const hasAnnotation = annotation.trim() !== '';

  const handleDone = (next: string): void => {
    onAnnotationChange(sectionIndex, songIndex, next);
    setSheetOpen(false);
  };

  // AC-7: NOT draggable. NO drag handle. NO Move up/down. Performance-mode
  // safety — the row is purely an annotation-edit affordance on iPhone.
  return (
    <li>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={`Edit per-gig note for ${songRef.titleSnapshot}`}
        className="flex min-h-tap w-full flex-col gap-[calc(var(--spacing-unit)*1)] py-[calc(var(--spacing-unit)*2)] text-left"
      >
        <span className={TITLE_CLASS}>{songRef.titleSnapshot}</span>
        {hasAnnotation ? <span className={ANNOTATION_CLASS}>{annotation}</span> : null}
      </button>
      {sheetOpen ? (
        <AnnotationSheet
          title={songRef.titleSnapshot}
          initialValue={annotation}
          onDone={handleDone}
          onDismiss={() => setSheetOpen(false)}
        />
      ) : null}
    </li>
  );
}

type AnnotationSheetProps = {
  title: string;
  initialValue: string;
  onDone: (next: string) => void;
  onDismiss: () => void;
};

/*
 * Bottom-sheet dialog for the iPhone annotation flow. The local buffer
 * lives here (not in the InlineEditField) so the `Done` button can commit
 * the current text — the InlineEditField commit-on-blur path is
 * intentionally NOT used in this branch (Done is the commit action, blur
 * is not).
 */
function AnnotationSheet({
  title,
  initialValue,
  onDone,
  onDismiss,
}: AnnotationSheetProps): JSX.Element {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Per-gig note for ${title}`}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-[calc(var(--spacing-unit)*3)] rounded-t-[var(--radius-card)] bg-[color:var(--color-surface)] p-[var(--spacing-card-pad)] shadow-[var(--shadow-card)]"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--spacing-card-pad))' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-primary)]">
          {title}
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex min-h-tap min-w-tap items-center justify-center text-[color:var(--color-text-secondary)]"
        >
          ×
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Per-gig note text for ${title}`}
        rows={3}
        className="w-full resize-none border-0 bg-transparent p-0 text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)] focus:outline-none focus-visible:[box-shadow:inset_0_-1px_0_0_var(--color-accent)]"
      />
      <button
        type="button"
        onClick={() => onDone(value)}
        className="flex min-h-tap w-full items-center justify-center rounded-[var(--radius-button)] bg-[color:var(--color-accent)] px-[var(--spacing-card-pad)] py-[calc(var(--spacing-unit)*2)] text-[color:var(--color-bg)] font-[family-name:var(--font-serif-editorial)] text-[length:var(--text-practice-body)]"
      >
        {ACTIONS.done}
      </button>
    </div>
  );
}
