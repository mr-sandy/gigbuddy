import type { Song, SongRef } from '@gigbuddy/shared';
import { type JSX, useEffect, useRef, useState } from 'react';
import { PASTE_TO_PARSE } from '../lib/microcopy.js';
import type { MatchResult } from '../paste-parse/matcher.js';
import { SongSearchRow } from './song-search-row.js';

/*
 * ParseRowStatus (Story 3.5, UX-DR4 / AC-5 / AC-17). Renders one
 * paste-parsed song row in one of three states — Matched, Fuzzy, or
 * Unknown — with inline resolution actions per state:
 *
 *   - Matched: ✓ glyph + canonical Library title (+ optional "(was: …)"
 *     caption when the canonical differs from what Sandy pasted). No
 *     action buttons; the row is settled.
 *
 *   - Fuzzy: ? glyph + the matcher's top suggestion + two buttons —
 *     `Yes, that one` (accept) and `No — new song` (reject → convert to
 *     Unknown).
 *
 *   - Unknown: + glyph + the normalized title + three buttons —
 *     `+ Add to library` (mint a minimal Song via useSongMutation),
 *     `Pick from library` (open inline type-ahead reusing SongSearchRow
 *     from Story 3.4), and `Discard` (remove this row entirely so it
 *     doesn't block Save).
 *
 * Color is never the sole signal (NFR-19 / UX-DR6): every state pairs a
 * glyph AND a label with the color token. Action buttons all carry
 * visible text — no icon-only controls in this component.
 *
 * Inline title edit (AC-10): the displayed title is wrapped in an
 * `<input aria-label="Song title">`. On blur or Enter, the parent's
 * `onTitleEdit` callback fires with the new string; the parent then
 * re-normalizes and re-runs the matcher, which flows back as a new
 * `result` prop. The input is rendered alongside the glyph/label so
 * Sandy can tap into it inline without a separate "edit" mode.
 */

export type ParseRowStatusProps = {
  result: MatchResult;
  rawTitle: string;
  // The string the parent considers the row's current display title
  // (canonical for Matched; matcher candidate for Fuzzy; normalized for
  // Unknown). Used as the inline-edit field's starting value.
  displayTitle: string;
  songs: Song[];
  onAcceptFuzzy: () => void;
  onRejectFuzzy: () => void;
  onAddToLibrary: () => void;
  onPickFromLibrary: (songRef: SongRef) => void;
  onDiscard: () => void;
  onTitleEdit: (newTitle: string) => void;
};

const GLYPH_BASE_CLASS =
  'inline-flex h-tap w-tap items-center justify-center text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] [font-family:var(--font-mono-slab)]';
const MATCHED_GLYPH_CLASS = `${GLYPH_BASE_CLASS} text-[color:var(--color-accent)]`;
const FUZZY_GLYPH_CLASS = `${GLYPH_BASE_CLASS} text-[color:var(--color-attention-fuzzy)]`;
const UNKNOWN_GLYPH_CLASS = `${GLYPH_BASE_CLASS} text-[color:var(--color-attention-unknown)]`;

const LABEL_CLASS =
  'text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] [font-family:var(--font-mono-slab)] text-[color:var(--color-text-secondary)] uppercase tracking-wide';

const TITLE_INPUT_CLASS =
  'block w-full min-h-tap border-0 bg-transparent p-0 text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)] focus:outline-none focus-visible:[box-shadow:inset_0_-1px_0_0_var(--color-accent)]';

const WAS_CAPTION_CLASS =
  'text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)] [font-family:var(--font-mono-slab)]';

const ACTION_BUTTON_BASE =
  'inline-flex min-h-tap min-w-tap items-center justify-center px-[calc(var(--spacing-unit)*2)] text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] [font-family:var(--font-mono-slab)]';
const ACCENT_ACTION_CLASS = `${ACTION_BUTTON_BASE} text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)] focus-visible:text-[color:var(--color-accent-strong)]`;
const SECONDARY_ACTION_CLASS = `${ACTION_BUTTON_BASE} text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-accent)] focus-visible:text-[color:var(--color-accent)]`;

export function ParseRowStatus({
  result,
  rawTitle,
  displayTitle,
  songs,
  onAcceptFuzzy,
  onRejectFuzzy,
  onAddToLibrary,
  onPickFromLibrary,
  onDiscard,
  onTitleEdit,
}: ParseRowStatusProps): JSX.Element {
  const [titleBuffer, setTitleBuffer] = useState(displayTitle);
  const [isPicking, setIsPicking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync local buffer when the displayed title changes from the outside
  // (parent re-renders after match flips, fuzzy-accept commits canonical
  // title, etc.).
  useEffect(() => {
    setTitleBuffer(displayTitle);
  }, [displayTitle]);

  const commitTitle = (): void => {
    if (titleBuffer !== displayTitle) onTitleEdit(titleBuffer);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  const handlePickFromLibrary = (songRef: SongRef): void => {
    setIsPicking(false);
    onPickFromLibrary(songRef);
  };

  const handleCancelPick = (): void => {
    setIsPicking(false);
  };

  // The "(was: …)" caption appears only when the canonical title differs
  // from the raw pasted form. Comparison is case-insensitive on the
  // trimmed strings — Sandy's pasted casing is noise, not signal.
  const showWasCaption =
    result.status === 'matched' &&
    rawTitle.trim().toLowerCase() !== result.song.title.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-[calc(var(--spacing-unit)*1)]">
      <div className="flex items-center gap-[calc(var(--spacing-unit)*2)]">
        {result.status === 'matched' ? (
          <>
            <span aria-hidden="true" className={MATCHED_GLYPH_CLASS}>
              ✓
            </span>
            <span className={LABEL_CLASS}>Matched</span>
          </>
        ) : null}
        {result.status === 'fuzzy' ? (
          <>
            <span aria-hidden="true" className={FUZZY_GLYPH_CLASS}>
              ?
            </span>
            <span className={LABEL_CLASS}>Fuzzy</span>
          </>
        ) : null}
        {result.status === 'unknown' ? (
          <>
            <span aria-hidden="true" className={UNKNOWN_GLYPH_CLASS}>
              +
            </span>
            <span className={LABEL_CLASS}>Unknown</span>
          </>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          aria-label="Song title"
          value={titleBuffer}
          onChange={(e) => setTitleBuffer(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={handleKeyDown}
          className={TITLE_INPUT_CLASS}
        />
      </div>

      {showWasCaption && result.status === 'matched' ? (
        <span className={WAS_CAPTION_CLASS}>
          ({PASTE_TO_PARSE.wasCaution} {rawTitle.trim()})
        </span>
      ) : null}

      {result.status === 'fuzzy' ? (
        <div className="flex flex-wrap gap-[calc(var(--spacing-unit)*2)]">
          <button type="button" onClick={onAcceptFuzzy} className={ACCENT_ACTION_CLASS}>
            {PASTE_TO_PARSE.yesMatch}
          </button>
          <button type="button" onClick={onRejectFuzzy} className={SECONDARY_ACTION_CLASS}>
            {PASTE_TO_PARSE.noNewSong}
          </button>
        </div>
      ) : null}

      {result.status === 'unknown' && !isPicking ? (
        <div className="flex flex-wrap gap-[calc(var(--spacing-unit)*2)]">
          <button type="button" onClick={onAddToLibrary} className={ACCENT_ACTION_CLASS}>
            {PASTE_TO_PARSE.addToLibrary}
          </button>
          <button
            type="button"
            onClick={() => setIsPicking(true)}
            className={SECONDARY_ACTION_CLASS}
          >
            {PASTE_TO_PARSE.pickFromLibrary}
          </button>
          <button type="button" onClick={onDiscard} className={SECONDARY_ACTION_CLASS}>
            {PASTE_TO_PARSE.discard}
          </button>
        </div>
      ) : null}

      {result.status === 'unknown' && isPicking ? (
        <SongSearchRow
          songs={songs}
          onSelect={handlePickFromLibrary}
          onAddNew={noop}
          onCancel={handleCancelPick}
          hideAddNew={true}
        />
      ) : null}
    </div>
  );
}

function noop(): void {}
