import {
  ACTIVE_BAND_ID,
  type SetlistPutInput,
  type SongPutInput,
  type SongRef,
} from '@gigbuddy/shared';
import { type JSX, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { InlineEditField } from '../components/inline-edit-field.js';
import { ParseRowStatus } from '../components/parse-row-status.js';
import { SectionHeading } from '../components/section-heading.js';
import { SetlistSongRow } from '../components/setlist-song-row.js';
import { SongSearchRow } from '../components/song-search-row.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSongMutation } from '../hooks/use-song-mutation.js';
import { useSongs } from '../hooks/use-songs.js';
import { PASTE_TO_PARSE, VALIDATION_MESSAGES } from '../lib/microcopy.js';
import { generateSongId } from '../lib/song-id.js';
import { type MatchResult, matchNormalizedTitle, matchRows } from '../paste-parse/matcher.js';
import { extractDisplayTitle, normalizeTitle } from '../paste-parse/normalize.js';
import { type ParseResult, parseSetlist } from '../paste-parse/parser.js';

/*
 * Setlist creation surface (Story 3.4 manual entry + Story 3.5 paste-to-
 * parse).
 *
 * `/setlists/new` route — Sandy enters Gig metadata (Venue, Date, optional
 * Time). Story 3.5 mounts a `<textarea>` paste area above the manual
 * sections; pasting plain text triggers `parseSetlist` + `matchRows` to
 * surface per-row Matched / Fuzzy / Unknown decisions inline. Sandy
 * resolves each row via single-tap actions on the row — `Yes, that one`
 * (Fuzzy), `+ Add to library` / `Pick from library` / `Discard`
 * (Unknown).
 *
 * The paste flow's parsed sections are held in transient state separate
 * from `draft.sections` (which holds Story 3.4 manual additions). On
 * Save, both are merged into the SetlistPutInput's `sections` array in
 * order: parsed first, then manual.
 *
 * Save is disabled while any Fuzzy or Unknown row remains. `Discard`
 * removes a row entirely so document-title junk doesn't block the save.
 *
 * All draft state is local `useState` — not persisted, not URL-encoded.
 * Navigating away discards silently (per EXPERIENCE.md Voice & Tone: no
 * interruptions).
 */

type DraftSection = {
  name: string;
  songs: SongRef[];
};

type DraftState = {
  venue: string;
  date: string; // YYYY-MM-DD, empty until set
  time: string; // HH:MM, empty if not set
  sections: DraftSection[];
};

type ValidationErrors = {
  venue?: string;
  date?: string;
};

/*
 * RowState — per-row state for the paste flow. `parsedRow` carries the
 * original `raw` + `normalized` strings; `match` is the current verdict
 * (mutates as Sandy resolves the row); `displayTitle` is what the
 * ParseRowStatus shows in its inline edit field; `sectionIndex` pins the
 * row to its parsed Section so Save can rebuild `DraftSection[]` in
 * order.
 */
type RowState = {
  sectionIndex: number;
  raw: string;
  normalized: string;
  displayTitle: string;
  match: MatchResult;
};

function readAtmosphere(): 'practice' | 'performance' {
  if (typeof document === 'undefined') return 'practice';
  return document.documentElement.dataset.atmosphere === 'performance' ? 'performance' : 'practice';
}

const INITIAL_DRAFT: DraftState = {
  venue: '',
  date: '',
  time: '',
  sections: [],
};

const FIELD_LABEL_CLASS =
  'text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]';
const NATIVE_INPUT_CLASS =
  'block w-full min-h-tap border-0 bg-transparent p-0 text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-mono-slab)] focus:outline-none focus-visible:[box-shadow:inset_0_-1px_0_0_var(--color-accent)]';
const VALIDATION_MSG_CLASS =
  'text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-attention-unknown)]';
const SECONDARY_BUTTON_CLASS =
  'inline-flex min-h-tap items-center self-start py-[calc(var(--spacing-unit)*2)] text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)] focus-visible:text-[color:var(--color-accent-strong)]';
const SAVE_BUTTON_CLASS =
  'inline-flex min-h-tap items-center self-start rounded-[var(--radius-button)] bg-[color:var(--color-accent)] px-[var(--spacing-card-pad)] py-[calc(var(--spacing-unit)*2)] text-[color:var(--color-bg)] font-[family-name:var(--font-serif-editorial)] text-[length:var(--text-practice-body)]';
const SAVE_BUTTON_DISABLED_CLASS = `${SAVE_BUTTON_CLASS} opacity-50 cursor-not-allowed`;
const REMOVE_BUTTON_CLASS =
  'inline-flex min-h-tap min-w-tap items-center justify-center text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-accent)] focus-visible:text-[color:var(--color-accent)]';
const PASTE_TEXTAREA_CLASS =
  'block w-full min-h-[calc(var(--spacing-tap)*3)] border-[1px] border-[color:var(--color-text-secondary)] bg-transparent p-[calc(var(--spacing-unit)*2)] text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-mono-slab)] focus:outline-none focus-visible:border-[color:var(--color-accent)]';
const PASTE_EMPTY_CLASS =
  'text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)] [font-family:var(--font-mono-slab)]';
const PARSE_SECTION_LABEL_CLASS =
  'text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-secondary)] uppercase tracking-wide [font-variant-caps:small-caps]';

export function SetlistCreation(): JSX.Element {
  const navigate = useNavigate();
  const { saveSetlist } = useSetlistMutation();
  const { saveSong } = useSongMutation();
  const songsQuery = useSongs();
  const songs = useMemo(() => songsQuery.data ?? [], [songsQuery.data]);
  const atmosphere = readAtmosphere();

  const [draft, setDraft] = useState<DraftState>(INITIAL_DRAFT);
  // Per-section "searching" flag — when truthy the section renders a
  // SongSearchRow under its songs. Indexed by section position; cleared on
  // select / cancel / add-new.
  const [searchingSection, setSearchingSection] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Story 3.5 — paste-to-parse transient state.
  const [pasteText, setPasteText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult>({ sections: [] });
  const [rowStates, setRowStates] = useState<RowState[]>([]);

  const handleVenueCommit = (next: string): void => {
    setDraft((d) => ({ ...d, venue: next }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setDraft((d) => ({ ...d, date: e.target.value }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setDraft((d) => ({ ...d, time: e.target.value }));
  };

  const handleAddSection = (): void => {
    setDraft((d) => {
      const nextIndex = d.sections.length + 1;
      return {
        ...d,
        sections: [...d.sections, { name: `Set ${nextIndex}`, songs: [] }],
      };
    });
  };

  const handleRenameSection = (sectionIndex: number, newName: string): void => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) => (i === sectionIndex ? { ...s, name: newName } : s)),
    }));
  };

  const handleAddSongClick = (sectionIndex: number | 'auto'): void => {
    if (sectionIndex === 'auto') {
      // Default Set 1 auto-create when no sections exist (AC-6).
      setDraft((d) => {
        if (d.sections.length > 0) return d;
        return { ...d, sections: [{ name: 'Set 1', songs: [] }] };
      });
      setSearchingSection(0);
      return;
    }
    setSearchingSection(sectionIndex);
  };

  const handleSelectSong = (sectionIndex: number, songRef: SongRef): void => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) =>
        i === sectionIndex ? { ...s, songs: [...s.songs, songRef] } : s,
      ),
    }));
    setSearchingSection(null);
  };

  const handleAddNewSong = (sectionIndex: number, title: string): void => {
    const newSongId = generateSongId();
    const record: SongPutInput = {
      bandId: ACTIVE_BAND_ID,
      songId: newSongId,
      title,
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    void saveSong(record);
    handleSelectSong(sectionIndex, { songId: newSongId, titleSnapshot: title });
  };

  const handleCancelSearch = (): void => {
    setSearchingSection(null);
  };

  const handleRemoveSong = (sectionIndex: number, songIndex: number): void => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) => {
        if (i !== sectionIndex) return s;
        return { ...s, songs: s.songs.filter((_, j) => j !== songIndex) };
      }),
    }));
  };

  // ---- Paste-to-parse handlers (Story 3.5) -----------------------------

  const recomputeFromText = (text: string): void => {
    const parsed = parseSetlist(text);
    setParseResult(parsed);
    const flatRows: { sectionIndex: number; raw: string; normalized: string }[] = [];
    parsed.sections.forEach((sec, sectionIndex) => {
      for (const row of sec.rows) {
        flatRows.push({ sectionIndex, raw: row.raw, normalized: row.normalized });
      }
    });
    const matched = matchRows(
      flatRows.map((r) => ({ raw: r.raw, normalized: r.normalized })),
      songs,
    );
    const next: RowState[] = flatRows.map((r, i) => {
      const result = matched[i] ?? { status: 'unknown' as const };
      // For Unknown rows, use the human-readable cleaned form (not the
      // normalized/lowercased key) so that "Add to library" writes a
      // proper title like "Mas Que Nada", not "mas que nada".
      const displayTitle =
        result.status === 'matched' || result.status === 'fuzzy'
          ? result.song.title
          : extractDisplayTitle(r.raw);
      return {
        sectionIndex: r.sectionIndex,
        raw: r.raw,
        normalized: r.normalized,
        displayTitle,
        match: result,
      };
    });
    setRowStates(next);
  };

  const handlePasteTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const text = e.target.value;
    setPasteText(text);
    // Only re-parse when no rows have been generated yet, or when the textarea
    // is cleared back to empty. Once Sandy starts resolving rows, subsequent
    // textarea keystrokes must NOT clobber her Fuzzy/Unknown decisions (AC-6/8/12).
    // To start over Sandy clears the textarea first.
    if (rowStates.length === 0 || text === '') {
      recomputeFromText(text);
    }
  };

  const updateRow = (index: number, patch: Partial<RowState>): void => {
    setRowStates((prev) => prev.map((rs, i) => (i === index ? { ...rs, ...patch } : rs)));
  };

  const handleAcceptFuzzy = (index: number): void => {
    setRowStates((prev) =>
      prev.map((rs, i) => {
        if (i !== index) return rs;
        if (rs.match.status !== 'fuzzy') return rs;
        return {
          ...rs,
          match: { status: 'matched', song: rs.match.song },
          displayTitle: rs.match.song.title,
        };
      }),
    );
  };

  const handleRejectFuzzy = (index: number): void => {
    setRowStates((prev) =>
      prev.map((rs, i) => {
        if (i !== index) return rs;
        return {
          ...rs,
          match: { status: 'unknown' },
          displayTitle: rs.normalized,
        };
      }),
    );
  };

  const handleAddToLibrary = (index: number): void => {
    const rs = rowStates[index];
    if (!rs) return;
    const newSongId = generateSongId();
    const title = rs.displayTitle;
    const record: SongPutInput = {
      bandId: ACTIVE_BAND_ID,
      songId: newSongId,
      title,
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    void saveSong(record);
    // Synthesize a Song-shaped object so the row's MatchResult holds a
    // real Song reference. The displayTitle becomes the canonical title.
    const synthesizedSong = {
      bandId: ACTIVE_BAND_ID,
      songId: newSongId,
      title,
      clientWrittenAt: record.clientWrittenAt,
      serverReceivedAt: record.clientWrittenAt,
      version: 1 as const,
    };
    updateRow(index, {
      match: { status: 'matched', song: synthesizedSong },
      displayTitle: title,
    });
  };

  const handlePickFromLibrary = (index: number, songRef: SongRef): void => {
    // Re-synthesize a Song from the canonical Library entry so downstream
    // code that reads `match.song.title` stays consistent.
    const lib = songs.find((s) => s.songId === songRef.songId);
    const fallbackSong = {
      bandId: ACTIVE_BAND_ID,
      songId: songRef.songId,
      title: songRef.titleSnapshot,
      clientWrittenAt: new Date().toISOString(),
      serverReceivedAt: new Date().toISOString(),
      version: 1 as const,
    };
    const song = lib ?? fallbackSong;
    updateRow(index, {
      match: { status: 'matched', song },
      displayTitle: song.title,
    });
  };

  const handleDiscard = (index: number): void => {
    setRowStates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTitleEdit = (index: number, newTitle: string): void => {
    const normalized = normalizeTitle(newTitle);
    const match = matchNormalizedTitle(normalized, songs);
    const displayTitle =
      match.status === 'matched' || match.status === 'fuzzy' ? match.song.title : normalized;
    updateRow(index, { normalized, displayTitle, match });
  };

  // ---- Save ------------------------------------------------------------

  const hasPendingRows = rowStates.some(
    (rs) => rs.match.status === 'fuzzy' || rs.match.status === 'unknown',
  );

  const handleSave = (): void => {
    if (hasPendingRows) return;
    const errors: ValidationErrors = {};
    const trimmedVenue = draft.venue.trim();
    if (trimmedVenue === '') errors.venue = VALIDATION_MESSAGES.venueRequired;
    if (draft.date === '') errors.date = VALIDATION_MESSAGES.dateRequired;
    if (errors.venue !== undefined || errors.date !== undefined) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    // Rebuild parsed sections from rowStates so Discarded rows are
    // excluded. Sections with zero rows after rebuild are still emitted
    // (an empty Setlist remains valid per FR-6 / AC-13).
    const parsedSections: DraftSection[] = parseResult.sections.map((sec, sectionIndex) => ({
      name: sec.name,
      songs: rowStates
        .filter((rs) => rs.sectionIndex === sectionIndex && rs.match.status === 'matched')
        .map((rs) => {
          if (rs.match.status !== 'matched') {
            // Unreachable — the filter above already proves the
            // discriminant. Repeat the check here so TypeScript narrows
            // the union without an explicit assertion.
            throw new Error('unreachable');
          }
          return {
            songId: rs.match.song.songId,
            titleSnapshot: rs.match.song.title,
          };
        }),
    }));
    // Drop parsed sections that ended up entirely empty due to Discards
    // ONLY if the section was implicit (had no headers in input). Per
    // AC-13, "Only headers, no songs" still emits zero-row sections.
    // V1 keeps it simple: emit every parsed section regardless. Sandy can
    // edit on the overview if he wants to delete a leftover section.

    const merged: DraftSection[] = [...parsedSections, ...draft.sections];

    const newSetlistId = generateSongId();
    const input: SetlistPutInput = {
      bandId: ACTIVE_BAND_ID,
      setlistId: newSetlistId,
      gigMeta: {
        venue: trimmedVenue,
        date: draft.date,
        ...(draft.time.trim() === '' ? {} : { time: draft.time }),
      },
      sections: merged,
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    void saveSetlist(input);
    navigate(`/setlists/${newSetlistId}`);
  };

  // Group rowStates by sectionIndex for rendering — preserves the parsed
  // section order and the row-position keys needed for stable React lists.
  const groupedRowStates: { sectionName: string; rows: { rs: RowState; flatIndex: number }[] }[] =
    useMemo(() => {
      const result = parseResult.sections.map((sec) => ({
        sectionName: sec.name,
        rows: [] as { rs: RowState; flatIndex: number }[],
      }));
      rowStates.forEach((rs, flatIndex) => {
        const bucket = result[rs.sectionIndex];
        if (bucket !== undefined) bucket.rows.push({ rs, flatIndex });
      });
      return result;
    }, [parseResult, rowStates]);

  return (
    <section
      aria-labelledby="setlist-creation-heading"
      className="flex flex-col gap-[var(--spacing-section-gap)]"
    >
      <h1 id="setlist-creation-heading" className="sr-only">
        New setlist
      </h1>

      <header className="flex flex-col gap-[var(--spacing-section-gap)]">
        <FieldRow label="Venue">
          <InlineEditField
            value={draft.venue}
            onCommit={handleVenueCommit}
            ariaLabel="Venue"
            placeholder="Venue"
          />
          {validationErrors.venue !== undefined ? (
            <p className={VALIDATION_MSG_CLASS}>{validationErrors.venue}</p>
          ) : null}
        </FieldRow>
        <FieldRow label="Date">
          <input
            type="date"
            aria-label="Date"
            value={draft.date}
            onChange={handleDateChange}
            className={NATIVE_INPUT_CLASS}
          />
          {validationErrors.date !== undefined ? (
            <p className={VALIDATION_MSG_CLASS}>{validationErrors.date}</p>
          ) : null}
        </FieldRow>
        <FieldRow label="Time (optional)">
          <input
            type="time"
            aria-label="Time (optional)"
            value={draft.time}
            onChange={handleTimeChange}
            placeholder="HH:MM"
            className={NATIVE_INPUT_CLASS}
          />
        </FieldRow>
      </header>

      <div className="flex flex-col gap-[calc(var(--spacing-unit)*3)]">
        <textarea
          aria-label="Paste setlist"
          value={pasteText}
          onChange={handlePasteTextChange}
          placeholder={PASTE_TO_PARSE.placeholder}
          rows={6}
          className={PASTE_TEXTAREA_CLASS}
        />
        <div aria-live="polite" className="flex flex-col gap-[var(--spacing-section-gap)]">
          {rowStates.length === 0 ? (
            <p className={PASTE_EMPTY_CLASS}>{PASTE_TO_PARSE.emptyResult}</p>
          ) : (
            groupedRowStates.map((group, sectionIndex) => (
              // Parsed-section position is identity; rows are keyed by
              // position within the section list (same AR-23 reasoning as
              // the manual sections below).
              // biome-ignore lint/suspicious/noArrayIndexKey: parsed section order is its identity
              <div key={sectionIndex} className="flex flex-col gap-[calc(var(--spacing-unit)*2)]">
                <span className={PARSE_SECTION_LABEL_CLASS}>{group.sectionName}</span>
                {group.rows.map(({ rs, flatIndex }) => (
                  <ParseRowStatus
                    key={flatIndex}
                    result={rs.match}
                    rawTitle={rs.raw}
                    displayTitle={rs.displayTitle}
                    songs={songs}
                    onAcceptFuzzy={() => handleAcceptFuzzy(flatIndex)}
                    onRejectFuzzy={() => handleRejectFuzzy(flatIndex)}
                    onAddToLibrary={() => handleAddToLibrary(flatIndex)}
                    onPickFromLibrary={(ref) => handlePickFromLibrary(flatIndex, ref)}
                    onDiscard={() => handleDiscard(flatIndex)}
                    onTitleEdit={(t) => handleTitleEdit(flatIndex, t)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {draft.sections.map((section, sectionIndex) => (
        <section
          // Section position is identity in the draft (mirrors Story 3.3's
          // overview keying — see setlist-overview.tsx for the rationale).
          // biome-ignore lint/suspicious/noArrayIndexKey: section order is its identity (AR-23 whole-record PUT)
          key={sectionIndex}
          aria-labelledby={`draft-section-${sectionIndex}-heading`}
          className="flex flex-col gap-[calc(var(--spacing-unit)*3)]"
        >
          <div id={`draft-section-${sectionIndex}-heading`}>
            <SectionHeading
              name={section.name}
              songCount={section.songs.length}
              sectionIndex={sectionIndex}
              onRename={handleRenameSection}
            />
          </div>
          <ul className="flex flex-col gap-[calc(var(--spacing-unit)*2)]">
            {section.songs.map((songRef, songIndex) => (
              <li
                // Position-of-record key — same reasoning as overview.
                // biome-ignore lint/suspicious/noArrayIndexKey: song position within a section is its identity
                key={songIndex}
                className="flex items-center gap-[calc(var(--spacing-unit)*2)]"
              >
                <div className="flex-1">
                  <SetlistSongRow
                    songRef={songRef}
                    sectionIndex={sectionIndex}
                    songIndex={songIndex}
                    onNavigate={noop}
                    onAnnotationChange={noop}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${songRef.titleSnapshot}`}
                  onClick={() => handleRemoveSong(sectionIndex, songIndex)}
                  className={REMOVE_BUTTON_CLASS}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {searchingSection === sectionIndex ? (
            <SongSearchRow
              songs={songs}
              onSelect={(songRef) => handleSelectSong(sectionIndex, songRef)}
              onAddNew={(title) => handleAddNewSong(sectionIndex, title)}
              onCancel={handleCancelSearch}
            />
          ) : (
            <button
              type="button"
              onClick={() => handleAddSongClick(sectionIndex)}
              className={SECONDARY_BUTTON_CLASS}
            >
              + Add song
            </button>
          )}
        </section>
      ))}

      {draft.sections.length === 0 ? (
        <button
          type="button"
          onClick={() => handleAddSongClick('auto')}
          className={SECONDARY_BUTTON_CLASS}
        >
          + Add song
        </button>
      ) : null}

      <button type="button" onClick={handleAddSection} className={SECONDARY_BUTTON_CLASS}>
        + Add section
      </button>

      <button
        type="button"
        onClick={hasPendingRows ? undefined : handleSave}
        aria-disabled={hasPendingRows}
        className={hasPendingRows ? SAVE_BUTTON_DISABLED_CLASS : SAVE_BUTTON_CLASS}
      >
        Save
      </button>

      {/* Atmosphere is read at render time so the SectionHeading inside this
          tree can apply its platform-aware behaviour. The value isn't used
          directly here — it's a hook into the render path so the static-vs-
          editable decision is made on the same tick the route renders. */}
      <span data-atmosphere={atmosphere} className="sr-only" />
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-[calc(var(--spacing-unit)*1)]">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {children}
    </div>
  );
}

function noop(): void {}
