import { ACTIVE_BAND_ID, type Song, type SongPutInput } from '@gigbuddy/shared';
import { ChevronLeft } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Textarea } from '../components/ui/textarea.js';
import { useSetlists } from '../hooks/use-setlists.js';
import { useSongMutation } from '../hooks/use-song-mutation.js';
import { useSongOrCached } from '../hooks/use-song-or-cached.js';
import { formatGigDate } from '../lib/gig-date.js';
import { generateId } from '../lib/id.js';
import { SONG_DELETE, SONG_FORM, SONGS } from '../lib/microcopy.js';

/*
 * Add / edit song form (Story 7.6). `/songs/new` adds, `/songs/:songId/edit`
 * edits. Save writes through `useSongMutation` as a whole-record PUT, so the
 * stored performance and practice notes (not shown here) are copied from the
 * song being edited or the PUT would delete them. The form mounts only once
 * the song is available and reads it once, so a background refetch never
 * resets what Sandy is typing. Leaving an edit steps back in history when
 * there is history to step back to, so the song page isn't stacked twice.
 *
 * Editing also offers "Delete song" (Story 7.11) behind a second tap. A song
 * in any setlist can't be deleted: the cached setlists name the gigs up front,
 * and the API's 409 covers anything the cache missed.
 */

const PAIR_GAP = 'mt-[calc(var(--spacing-unit)*4)]';
const FIELD_GAP = 'mt-[var(--spacing-unit)]';
const BODY_PRIMARY =
  'text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-foreground';

export function SongEdit() {
  const { songId } = useParams();
  return songId === undefined ? <SongForm /> : <EditExisting songId={songId} />;
}

function EditExisting({ songId }: { songId: string }) {
  const { song, statusLine } = useSongOrCached(songId);
  if (!song) {
    return (
      <>
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to="/songs">
            <ChevronLeft aria-hidden="true" />
            {SONGS.backToSongs}
          </Link>
        </Button>
        <p
          aria-live="polite"
          className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground"
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
  const canSave = title.trim() !== '';
  const exitTo = initial ? `/songs/${songId}` : '/songs';
  // 'default' means this form is the first page in the history stack.
  const canStepBack = initial !== undefined && location.key !== 'default';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    const trimmedTitle = title.trim();
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
        <Label htmlFor="song-title">{SONG_FORM.title}</Label>
        <Input
          id="song-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={FIELD_GAP}
        />
      </div>

      <div className={PAIR_GAP}>
        <Label htmlFor="song-key">{SONG_FORM.key}</Label>
        <Input
          id="song-key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className={FIELD_GAP}
        />
      </div>

      <div className={PAIR_GAP}>
        <Label htmlFor="song-patch">{SONG_FORM.patch}</Label>
        <Input
          id="song-patch"
          type="text"
          value={patch}
          onChange={(e) => setPatch(e.target.value)}
          className={FIELD_GAP}
        />
      </div>

      <div className={PAIR_GAP}>
        <Label htmlFor="song-chart">{SONG_FORM.chordChart}</Label>
        <Textarea
          id="song-chart"
          rows={12}
          value={chart}
          onChange={(e) => setChart(e.target.value)}
          className={`${FIELD_GAP} resize-y`}
        />
      </div>

      <div className="mt-[calc(var(--spacing-unit)*8)] flex items-center gap-[calc(var(--spacing-unit)*6)]">
        <Button type="submit" disabled={!canSave}>
          {SONG_FORM.save}
        </Button>
        <Button asChild variant="ghost">
          <Link
            replace
            to={exitTo}
            onClick={(e) => {
              if (!canStepBack) return;
              e.preventDefault();
              navigate(-1);
            }}
          >
            {SONG_FORM.cancel}
          </Link>
        </Button>
      </div>

      {initial ? <DeleteSong song={initial} /> : null}
    </form>
  );
}

function DeleteSong({ song }: { song: Song }) {
  const navigate = useNavigate();
  const { deleteSong } = useSongMutation();
  const { data: setlists } = useSetlists();
  const [step, setStep] = useState<'idle' | 'confirm'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const gigs = (setlists ?? []).filter((setlist) =>
    setlist.sections.some((section) => section.songs.some((ref) => ref.songId === song.songId)),
  );

  async function onConfirm() {
    setDeleting(true);
    try {
      const result = await deleteSong(song.songId);
      if (result === 'deleted') {
        navigate('/songs', { replace: true });
        return;
      }
      setMessage(SONG_DELETE.inUseUnknown);
    } catch {
      setMessage(SONG_DELETE.failed);
    }
    setDeleting(false);
    setStep('idle');
  }

  const keep = (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        setStep('idle');
        setMessage(null);
      }}
    >
      {SONG_DELETE.keep}
    </Button>
  );

  return (
    <div className="mt-[calc(var(--spacing-unit)*12)]">
      {step === 'idle' ? (
        <Button
          type="button"
          variant="destructive-outline"
          onClick={() => {
            setMessage(null);
            setStep('confirm');
          }}
        >
          {SONG_DELETE.button}
        </Button>
      ) : gigs.length > 0 ? (
        <>
          <p className={BODY_PRIMARY}>{SONG_DELETE.inUse}</p>
          <ul className={`mt-[var(--spacing-unit)] ${BODY_PRIMARY}`}>
            {gigs.map((gig) => {
              const venue = gig.gigMeta.venue.trim();
              const date = formatGigDate(gig.gigMeta.date);
              return <li key={gig.setlistId}>{venue ? `${venue}, ${date}` : date}</li>;
            })}
          </ul>
          <div className="mt-[calc(var(--spacing-unit)*4)]">{keep}</div>
        </>
      ) : (
        <>
          <p className={BODY_PRIMARY}>{`${SONG_DELETE.confirm} ${song.title}?`}</p>
          <div className="mt-[calc(var(--spacing-unit)*4)] flex flex-wrap items-center gap-[calc(var(--spacing-unit)*6)]">
            <Button type="button" variant="destructive" onClick={onConfirm} disabled={deleting}>
              {SONG_DELETE.yes}
            </Button>
            {keep}
          </div>
        </>
      )}
      {message ? (
        <p role="alert" className={`mt-[var(--spacing-unit)] ${BODY_PRIMARY}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
