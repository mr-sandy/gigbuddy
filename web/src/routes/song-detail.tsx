import { ACTIVE_BAND_ID, type Song, type SongPutInput } from '@gigbuddy/shared';
import type { JSX, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChordChart } from '../components/chord-chart.js';
import { InlineEditField } from '../components/inline-edit-field.js';
import { useSong } from '../hooks/use-song.js';
import { useSongMutation } from '../hooks/use-song-mutation.js';
import { readAtmosphere } from '../lib/atmosphere.js';
import { generateId } from '../lib/id.js';
import { ACTIONS, EMPTY_STATES, FIELD_LABELS } from '../lib/microcopy.js';

/*
 * Song Detail surface (FR-1, FR-2, FR-3, FR-5).
 *
 * Two mounts share this file:
 *   - /songs/new       → CreateBranch (Title-required minted record)
 *   - /songs/:songId   → EditBranch (load + edit existing record)
 *
 * Field commits run through `useDebouncedFire` (200ms per NFR-4). The
 * edit branch accumulates field changes into `pendingRef` so cross-field
 * rapid blurs all land in the same eventual save — without this, a fast
 * Title-then-Key blur sequence would lose the Title change because the
 * second commit's record-snapshot doesn't yet contain the optimistic
 * Title update.
 *
 * Atmosphere is read once at mount from
 * `document.documentElement.dataset.atmosphere` (architecture.md "Theme
 * atmosphere") — the route never re-evaluates because the document-level
 * attribute is fixed at boot by `applyBootAtmosphere()`.
 */

const DEBOUNCE_MS = 200;

function useDebouncedFire<Args extends unknown[]>(
  fn: (...args: Args) => void | Promise<void>,
  delay = DEBOUNCE_MS,
): (...args: Args) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  return useCallback(
    (...args: Args) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void fnRef.current(...args);
        timerRef.current = null;
      }, delay);
    },
    [delay],
  );
}

function songToPutInput(song: Song): SongPutInput {
  return {
    bandId: song.bandId,
    songId: song.songId,
    title: song.title,
    key: song.key || undefined,
    patch: song.patch || undefined,
    chordChart: song.chordChart || undefined,
    performanceNotes: song.performanceNotes || undefined,
    practiceNotes: song.practiceNotes || undefined,
    clientWrittenAt: song.clientWrittenAt,
    version: song.version,
  };
}

const TITLE_FIELD_CLASS =
  'text-[length:var(--text-perf-title)] leading-[var(--text-perf-title--line-height)]';
const MONO_FIELD_CLASS =
  '[font-family:var(--font-mono-slab)] text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)]';
const CHORD_INPUT_CLASS =
  '[font-family:var(--font-mono-slab)] text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)]';

export function SongDetail(): JSX.Element {
  const { songId } = useParams<{ songId: string }>();
  return songId === undefined ? <CreateBranch /> : <EditBranch songId={songId} />;
}

function CreateBranch(): JSX.Element {
  const navigate = useNavigate();
  const [draftSongId] = useState(() => generateId());
  const { saveSong } = useSongMutation();

  const debouncedCreate = useDebouncedFire<[string]>(async (title) => {
    const record: SongPutInput = {
      bandId: ACTIVE_BAND_ID,
      songId: draftSongId,
      title,
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    await saveSong(record);
  });

  const handleTitleCommit = (next: string): void => {
    if (next.trim() === '') return;
    debouncedCreate(next);
    navigate(`/songs/${draftSongId}`, { replace: true });
  };

  return (
    <section
      aria-labelledby="song-detail-heading"
      className="flex flex-col gap-[var(--spacing-section-gap)]"
    >
      <h1 id="song-detail-heading" className="sr-only">
        New song
      </h1>
      <InlineEditField
        value=""
        onCommit={handleTitleCommit}
        ariaLabel={FIELD_LABELS.title}
        placeholder={FIELD_LABELS.title}
        autoFocus
        inputClassName={TITLE_FIELD_CLASS}
      />
      <FieldRow label={FIELD_LABELS.key}>
        <InlineEditField
          value=""
          onCommit={noop}
          ariaLabel={FIELD_LABELS.key}
          disabled
          inputClassName={MONO_FIELD_CLASS}
        />
      </FieldRow>
      <FieldRow label={FIELD_LABELS.patch}>
        <InlineEditField
          value=""
          onCommit={noop}
          ariaLabel={FIELD_LABELS.patch}
          disabled
          inputClassName={MONO_FIELD_CLASS}
        />
      </FieldRow>
      <FieldRow label={FIELD_LABELS.chordChart}>
        <InlineEditField
          value=""
          onCommit={noop}
          ariaLabel={FIELD_LABELS.chordChart}
          disabled
          multiline
          inputClassName={CHORD_INPUT_CLASS}
        />
      </FieldRow>
      <FieldRow label={FIELD_LABELS.performanceNotes}>
        <InlineEditField
          value=""
          onCommit={noop}
          ariaLabel={FIELD_LABELS.performanceNotes}
          disabled
          multiline
        />
      </FieldRow>
      <FieldRow label={FIELD_LABELS.practiceNotes}>
        <InlineEditField
          value=""
          onCommit={noop}
          ariaLabel={FIELD_LABELS.practiceNotes}
          disabled
          multiline
        />
      </FieldRow>
    </section>
  );
}

function EditBranch({ songId }: { songId: string }): JSX.Element {
  const { data } = useSong(songId);
  const { saveSong } = useSongMutation();
  const atmosphere = useMemo(() => readAtmosphere(), []);
  const urlsTappable = atmosphere === 'practice';

  const dataRef = useRef<Song | null>(data ?? null);
  dataRef.current = data ?? null;
  const pendingRef = useRef<Partial<Song>>({});

  const debouncedSave = useDebouncedFire<[]>(() => {
    const current = dataRef.current;
    if (!current) {
      pendingRef.current = {};
      return;
    }
    const merged: Song = { ...current, ...pendingRef.current };
    pendingRef.current = {};
    const record: SongPutInput = {
      ...songToPutInput(merged),
      clientWrittenAt: new Date().toISOString(),
    };
    void saveSong(record);
  });

  const commitField = (partial: Partial<Song>): void => {
    pendingRef.current = { ...pendingRef.current, ...partial };
    debouncedSave();
  };

  if (data === undefined) {
    // `enabled: true` (songId is non-null) means useQuery is fetching;
    // `isLoading` would be true here in practice. Branch on the data
    // identity directly so type-narrowing flows to the render block.
    return <p className="sr-only">Loading song.</p>;
  }

  if (data === null) {
    return (
      <section
        aria-labelledby="song-not-found"
        className="flex flex-col gap-[var(--spacing-section-gap)]"
      >
        <p
          id="song-not-found"
          className="text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-primary)]"
        >
          {EMPTY_STATES.songNotFound}
        </p>
        <Link
          to="/library"
          className="inline-flex min-h-tap items-center text-[length:var(--text-practice-body)] text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)] focus-visible:text-[color:var(--color-accent-strong)]"
        >
          {ACTIONS.backToLibrary}
        </Link>
      </section>
    );
  }

  const chordChart = data.chordChart ?? '';

  return (
    <section
      aria-labelledby="song-detail-heading"
      className="flex flex-col gap-[var(--spacing-section-gap)]"
    >
      <h1 id="song-detail-heading" className="sr-only">
        {data.title || 'Song detail'}
      </h1>
      <InlineEditField
        value={data.title}
        onCommit={(next) => commitField({ title: next })}
        ariaLabel={FIELD_LABELS.title}
        inputClassName={TITLE_FIELD_CLASS}
      />
      <FieldRow label={FIELD_LABELS.key}>
        <InlineEditField
          value={data.key ?? ''}
          onCommit={(next) => commitField({ key: next })}
          ariaLabel={FIELD_LABELS.key}
          inputClassName={MONO_FIELD_CLASS}
        />
      </FieldRow>
      <FieldRow label={FIELD_LABELS.patch}>
        <InlineEditField
          value={data.patch ?? ''}
          onCommit={(next) => commitField({ patch: next })}
          ariaLabel={FIELD_LABELS.patch}
          inputClassName={MONO_FIELD_CLASS}
        />
      </FieldRow>
      <FieldRow label={FIELD_LABELS.chordChart}>
        <InlineEditField
          value={chordChart}
          onCommit={(next) => commitField({ chordChart: next })}
          ariaLabel={FIELD_LABELS.chordChart}
          multiline
          inputClassName={CHORD_INPUT_CLASS}
        />
        {chordChart.trim() !== '' && <ChordChart text={chordChart} urlsTappable={urlsTappable} />}
      </FieldRow>
      <FieldRow label={FIELD_LABELS.performanceNotes}>
        <InlineEditField
          value={data.performanceNotes ?? ''}
          onCommit={(next) => commitField({ performanceNotes: next })}
          ariaLabel={FIELD_LABELS.performanceNotes}
          multiline
        />
      </FieldRow>
      <FieldRow label={FIELD_LABELS.practiceNotes}>
        <InlineEditField
          value={data.practiceNotes ?? ''}
          onCommit={(next) => commitField({ practiceNotes: next })}
          ariaLabel={FIELD_LABELS.practiceNotes}
          multiline
        />
      </FieldRow>
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-[calc(var(--spacing-unit)*1)]">
      <span className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function noop(): void {}
