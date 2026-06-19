import type { SongRef } from '@gigbuddy/shared';
import { type JSX, useEffect, useRef, useState } from 'react';
import { ACTIONS } from '../lib/microcopy.js';
import { InlineEditField } from './inline-edit-field.js';

/*
 * SetlistSongRow (Story 3.3, FR-11). Renders one song inside a setlist
 * section with an optional per-gig annotation subline. The row owns two
 * platform-divergent behaviours:
 *
 *   - MacBook (practice):
 *       * tap on title → navigates to /songs/:songId via onNavigate
 *       * tap on annotation slot → opens an inline `InlineEditField`
 *         pre-filled with the current annotation; blur commits via
 *         onAnnotationChange(sectionIndex, songIndex, newValue)
 *
 *   - iPhone (performance):
 *       * tap anywhere on the row → opens a bottom-sheet dialog with a
 *         multiline `InlineEditField`; Done commits, × dismisses without
 *         committing. The row does NOT navigate to Song Detail on iPhone
 *         (per AC-10: row-tap is annotation-focused).
 *
 * The annotation persists on the (Setlist, Song) pair embedded in the
 * Setlist record's sections[].songs[] — NOT on the Song record. The
 * parent route owns the whole-record PUT; this component just signals
 * via onAnnotationChange.
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
};

const TITLE_CLASS =
  'text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-primary)]';
const ANNOTATION_CLASS =
  'italic text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] [font-family:var(--font-serif-editorial)] text-[color:var(--color-accent)]';

export function SetlistSongRow({
  songRef,
  sectionIndex,
  songIndex,
  onNavigate,
  onAnnotationChange,
}: SetlistSongRowProps): JSX.Element {
  const atmosphere = readAtmosphere();
  if (atmosphere === 'performance') {
    return (
      <IPhoneRow
        songRef={songRef}
        sectionIndex={sectionIndex}
        songIndex={songIndex}
        onAnnotationChange={onAnnotationChange}
      />
    );
  }
  return (
    <MacBookRow
      songRef={songRef}
      sectionIndex={sectionIndex}
      songIndex={songIndex}
      onNavigate={onNavigate}
      onAnnotationChange={onAnnotationChange}
    />
  );
}

function MacBookRow({
  songRef,
  sectionIndex,
  songIndex,
  onNavigate,
  onAnnotationChange,
}: SetlistSongRowProps): JSX.Element {
  const [editingAnnotation, setEditingAnnotation] = useState(false);
  const annotation = songRef.perGigAnnotation ?? '';
  const hasAnnotation = annotation.trim() !== '';

  const handleCommit = (next: string): void => {
    onAnnotationChange(sectionIndex, songIndex, next);
    setEditingAnnotation(false);
  };

  return (
    <li className="flex min-h-tap flex-col gap-[calc(var(--spacing-unit)*1)] py-[calc(var(--spacing-unit)*2)]">
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
        // AC-7: no visible affordance when no annotation; sr-only preserves AC-9 keyboard access
        <button
          type="button"
          onClick={() => setEditingAnnotation(true)}
          aria-label={`Add per-gig note for ${songRef.titleSnapshot}`}
          className="sr-only"
        />
      )}
    </li>
  );
}

type IPhoneRowProps = Omit<SetlistSongRowProps, 'onNavigate'>;

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
