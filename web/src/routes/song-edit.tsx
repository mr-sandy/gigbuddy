import { ACTIVE_BAND_ID, type Song, type SongPutInput } from '@gigbuddy/shared';
import { Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EditSheet, SheetFrame, useSheetExit } from '../components/edit-sheet.js';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Textarea } from '../components/ui/textarea.js';
import { useSetlists } from '../hooks/use-setlists.js';
import { useSongMutation } from '../hooks/use-song-mutation.js';
import { useSongOrCached } from '../hooks/use-song-or-cached.js';
import { formatGigDate } from '../lib/gig-date.js';
import { generateId } from '../lib/id.js';
import { SONG_DELETE, SONG_FORM } from '../lib/microcopy.js';

/*
 * Add / edit song sheet (Story 7.6, in a sheet since 7.21). `/songs/new` adds, `/songs/:songId/edit`
 * edits. Save writes through `useSongMutation` as a whole-record PUT, so the
 * stored performance and practice notes (not shown here) are copied from the
 * song being edited or the PUT would delete them. The form mounts only once
 * the song is available and reads it once, so a background refetch never
 * resets what Sandy is typing. Leaving an edit steps back in history when
 * there is history to step back to, so the song page isn't stacked twice.
 *
 * Both routes are children of the page they open over (`/songs`, `/songs/:songId`),
 * so the page stays mounted behind the sheet. Editing also offers "Delete song"
 * (Story 7.11) in a confirm dialog. A song in any setlist can't be deleted: the
 * cached setlists name the gigs up front, and the API's 409 covers anything the
 * cache missed.
 */

const PAIR_GAP = 'mt-[calc(var(--spacing-unit)*4)]';
const FIELD_GAP = 'mt-[var(--spacing-unit)]';

export function SongEdit() {
  const { songId } = useParams();
  return songId === undefined ? <SongForm /> : <EditExisting songId={songId} />;
}

function EditExisting({ songId }: { songId: string }) {
  const { song, statusLine } = useSongOrCached(songId);
  const { leave } = useSheetExit(`/songs/${songId}`);
  return (
    <SheetFrame onCancel={leave} described={false}>
      {song ? (
        <SongForm key={song.songId} initial={song} />
      ) : (
        <EditSheet
          title={SONG_FORM.editHeading}
          cancelLabel={SONG_FORM.cancel}
          submitLabel={SONG_FORM.save}
          submitDisabled
          onCancel={leave}
        >
          <p
            aria-live="polite"
            className="m-0 mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground"
          >
            {statusLine}
          </p>
        </EditSheet>
      )}
    </SheetFrame>
  );
}

function SongForm({ initial }: { initial?: Song }) {
  const navigate = useNavigate();
  const { saveSong } = useSongMutation();
  const [newId] = useState(() => generateId());
  const songId = initial?.songId ?? newId;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [patch, setPatch] = useState(initial?.patch ?? '');
  const [chart, setChart] = useState(initial?.chordChart ?? '');
  const [saving, setSaving] = useState(false);
  const canSave = title.trim() !== '';
  const exitTo = initial ? `/songs/${songId}` : '/songs';
  const { leave, hasHistory } = useSheetExit(exitTo);
  // After saving a new record, land on its page rather than stepping back.
  const canStepBack = initial !== undefined && hasHistory;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // A second tap while saving would step back twice.
    if (!canSave || saving) return;
    setSaving(true);
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
    <EditSheet
      title={initial ? SONG_FORM.editHeading : SONG_FORM.addHeading}
      cancelLabel={SONG_FORM.cancel}
      submitLabel={initial ? SONG_FORM.save : SONG_FORM.add}
      submitDisabled={!canSave || saving}
      onCancel={leave}
      onSubmit={onSubmit}
    >
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

      {initial ? <DeleteSong song={initial} /> : null}
    </EditSheet>
  );
}

function DeleteSong({ song }: { song: Song }) {
  const navigate = useNavigate();
  const { deleteSong } = useSongMutation();
  const { data: setlists } = useSetlists();
  const [open, setOpen] = useState(false);
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
    setOpen(false);
  }

  return (
    <div className="mt-[var(--spacing-section-gap)] border-t border-border pt-[var(--spacing-section-gap)]">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && deleting) return;
          if (next) setMessage(null);
          setOpen(next);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive-outline">
            <Trash2 aria-hidden="true" />
            {SONG_DELETE.button}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          {gigs.length > 0 ? (
            <>
              <AlertDialogTitle>{SONG_DELETE.inUseTitle(song.title)}</AlertDialogTitle>
              <AlertDialogDescription>{SONG_DELETE.inUse}</AlertDialogDescription>
              <ul className="m-0 mt-[var(--spacing-unit)] list-none p-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-foreground">
                {gigs.map((gig) => {
                  const venue = gig.gigMeta.venue.trim();
                  const date = formatGigDate(gig.gigMeta.date);
                  return <li key={gig.setlistId}>{venue ? `${venue}, ${date}` : date}</li>;
                })}
              </ul>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline">
                    {SONG_DELETE.ok}
                  </Button>
                </AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogTitle>{SONG_DELETE.title(song.title)}</AlertDialogTitle>
              <AlertDialogDescription>{SONG_DELETE.explain}</AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline" disabled={deleting}>
                    {SONG_DELETE.keep}
                  </Button>
                </AlertDialogCancel>
                <Button type="button" variant="destructive" onClick={onConfirm} disabled={deleting}>
                  {SONG_DELETE.yes}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
      {message ? (
        <p
          role="alert"
          className="m-0 mt-[var(--spacing-unit)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-foreground"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
