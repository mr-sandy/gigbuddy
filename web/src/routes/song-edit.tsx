import { ACTIVE_BAND_ID, type Song, type SongPutInput } from '@gigbuddy/shared';
import { type FormEvent, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { useSongMutation } from '../hooks/use-song-mutation.js';
import { useSongOrCached } from '../hooks/use-song-or-cached.js';
import { generateId } from '../lib/id.js';
import { SONG_FORM, SONGS } from '../lib/microcopy.js';

/*
 * Add / edit song form (Story 7.6). `/songs/new` adds, `/songs/:songId/edit`
 * edits. Save writes through `useSongMutation` as a whole-record PUT, so the
 * stored performance and practice notes (not shown here) are copied from the
 * song being edited or the PUT would delete them. The form mounts only once
 * the song is available and reads it once, so a background refetch never
 * resets what Sandy is typing. Leaving an edit steps back in history when
 * there is history to step back to, so the song page isn't stacked twice.
 */

const LINK_CLASS =
  'inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]';
const LABEL_CLASS =
  'block text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-primary)]';
const FIELD_CLASS =
  'mt-[var(--spacing-unit)] box-border w-full rounded-[4px] border border-[color:var(--color-text-secondary)] bg-[color:var(--color-bg)] p-[calc(var(--spacing-unit)*3)] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-[color:var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]';
const PAIR_GAP = 'mt-[calc(var(--spacing-unit)*4)]';

export function SongEdit() {
  const { songId } = useParams();
  return songId === undefined ? <SongForm /> : <EditExisting songId={songId} />;
}

function EditExisting({ songId }: { songId: string }) {
  const { song, statusLine } = useSongOrCached(songId);
  if (!song) {
    return (
      <>
        <Link to="/songs" className={LINK_CLASS}>
          {SONGS.backToSongs}
        </Link>
        <p
          aria-live="polite"
          className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-secondary)]"
        >
          {statusLine}
        </p>
      </>
    );
  }
  return <SongForm key={song.songId} initial={song} />;
}

function SongForm({ initial }: { initial?: Song }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveSong } = useSongMutation();
  const [newId] = useState(() => generateId());
  const songId = initial?.songId ?? newId;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [patch, setPatch] = useState(initial?.patch ?? '');
  const [chart, setChart] = useState(initial?.chordChart ?? '');
  const [titleError, setTitleError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const exitTo = initial ? `/songs/${songId}` : '/songs';
  // 'default' means this form is the first page in the history stack.
  const canStepBack = initial !== undefined && location.key !== 'default';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle === '') {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    setTitleError(false);
    const trimmedKey = key.trim();
    const trimmedPatch = patch.trim();
    // Built field by field: the API schema is strict, so no spreading `initial`.
    const record: SongPutInput = {
      bandId: ACTIVE_BAND_ID,
      songId,
      title: trimmedTitle,
      ...(trimmedKey !== '' ? { key: trimmedKey } : {}),
      ...(trimmedPatch !== '' ? { patch: trimmedPatch } : {}),
      ...(chart.trim() !== '' ? { chordChart: chart } : {}),
      ...(initial?.performanceNotes !== undefined
        ? { performanceNotes: initial.performanceNotes }
        : {}),
      ...(initial?.practiceNotes !== undefined ? { practiceNotes: initial.practiceNotes } : {}),
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    await saveSong(record);
    if (canStepBack) navigate(-1);
    else navigate(`/songs/${songId}`, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageTitle>{initial ? SONG_FORM.editHeading : SONG_FORM.addHeading}</PageTitle>

      <div className={PAIR_GAP}>
        <label htmlFor="song-title" className={LABEL_CLASS}>
          {SONG_FORM.title}
        </label>
        <input
          ref={titleRef}
          id="song-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={titleError || undefined}
          className={FIELD_CLASS}
        />
        {titleError ? (
          <p
            role="alert"
            className="mt-[var(--spacing-unit)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-primary)]"
          >
            {SONG_FORM.titleRequired}
          </p>
        ) : null}
      </div>

      <div className={PAIR_GAP}>
        <label htmlFor="song-key" className={LABEL_CLASS}>
          {SONG_FORM.key}
        </label>
        <input
          id="song-key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className={PAIR_GAP}>
        <label htmlFor="song-patch" className={LABEL_CLASS}>
          {SONG_FORM.patch}
        </label>
        <input
          id="song-patch"
          type="text"
          value={patch}
          onChange={(e) => setPatch(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className={PAIR_GAP}>
        <label htmlFor="song-chart" className={LABEL_CLASS}>
          {SONG_FORM.chordChart}
        </label>
        <textarea
          id="song-chart"
          rows={12}
          value={chart}
          onChange={(e) => setChart(e.target.value)}
          className={`${FIELD_CLASS} resize-y`}
        />
      </div>

      <div className="mt-[calc(var(--spacing-unit)*8)] flex items-center gap-[calc(var(--spacing-unit)*6)]">
        <button
          type="submit"
          className="min-h-tap rounded-[4px] border-2 border-[color:var(--color-text-primary)] bg-transparent px-[calc(var(--spacing-unit)*6)] text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          {SONG_FORM.save}
        </button>
        <Link
          replace
          to={exitTo}
          onClick={(e) => {
            if (!canStepBack) return;
            e.preventDefault();
            navigate(-1);
          }}
          className={LINK_CLASS}
        >
          {SONG_FORM.cancel}
        </Link>
      </div>
    </form>
  );
}
