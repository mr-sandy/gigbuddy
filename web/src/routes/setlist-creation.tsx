import {
  ACTIVE_BAND_ID,
  type SetlistPutInput,
  type SongPutInput,
  type SongRef,
} from '@gigbuddy/shared';
import { type JSX, useState } from 'react';
import { useNavigate } from 'react-router';
import { InlineEditField } from '../components/inline-edit-field.js';
import { SectionHeading } from '../components/section-heading.js';
import { SetlistSongRow } from '../components/setlist-song-row.js';
import { SongSearchRow } from '../components/song-search-row.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSongMutation } from '../hooks/use-song-mutation.js';
import { useSongs } from '../hooks/use-songs.js';
import { VALIDATION_MESSAGES } from '../lib/microcopy.js';
import { generateSongId } from '../lib/song-id.js';

/*
 * Setlist creation surface (Story 3.4, FR-6 manual).
 *
 * `/setlists/new` route — Sandy enters Gig metadata (Venue, Date, optional
 * Time), then adds Sections and Song rows. Song rows use a type-ahead
 * picker (`SongSearchRow`) that filters the active Band's Library; if no
 * match is found Sandy can `+ Add to library` to mint a new minimal Song.
 *
 * All draft state is local `useState` — not persisted, not URL-encoded.
 * Navigating away discards silently (per EXPERIENCE.md Voice & Tone: no
 * interruptions). The route is **transient prep**, not a long-lived edit
 * surface (the saved Setlist's edit surface is Story 3.3's overview).
 *
 * Story 3.5 extends this route by mounting a paste input area above the
 * sections UI; that extension does not touch the manual-entry plumbing
 * here.
 *
 * Persistence: Save → `useSetlistMutation().saveSetlist(...)` enqueues a
 * whole-record PUT (AR-23) then navigates to `/setlists/<newId>` (the
 * Setlist overview). `+ Add to library` calls `useSongMutation().saveSong(...)`
 * directly — both writes flow through the outbox.
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
const REMOVE_BUTTON_CLASS =
  'inline-flex min-h-tap min-w-tap items-center justify-center text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-accent)] focus-visible:text-[color:var(--color-accent)]';

export function SetlistCreation(): JSX.Element {
  const navigate = useNavigate();
  const { saveSetlist } = useSetlistMutation();
  const { saveSong } = useSongMutation();
  const songsQuery = useSongs();
  const songs = songsQuery.data ?? [];
  const atmosphere = readAtmosphere();

  const [draft, setDraft] = useState<DraftState>(INITIAL_DRAFT);
  // Per-section "searching" flag — when truthy the section renders a
  // SongSearchRow under its songs. Indexed by section position; cleared on
  // select / cancel / add-new.
  const [searchingSection, setSearchingSection] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

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

  const handleSave = (): void => {
    const errors: ValidationErrors = {};
    const trimmedVenue = draft.venue.trim();
    if (trimmedVenue === '') errors.venue = VALIDATION_MESSAGES.venueRequired;
    if (draft.date === '') errors.date = VALIDATION_MESSAGES.dateRequired;
    if (errors.venue !== undefined || errors.date !== undefined) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    const newSetlistId = generateSongId();
    const input: SetlistPutInput = {
      bandId: ACTIVE_BAND_ID,
      setlistId: newSetlistId,
      gigMeta: {
        venue: trimmedVenue,
        date: draft.date,
        ...(draft.time.trim() === '' ? {} : { time: draft.time }),
      },
      sections: draft.sections,
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    void saveSetlist(input);
    navigate(`/setlists/${newSetlistId}`);
  };

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

      <button type="button" onClick={handleSave} className={SAVE_BUTTON_CLASS}>
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
