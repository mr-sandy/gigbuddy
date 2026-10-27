import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
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
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { formatGigDate } from '../lib/gig-date.js';
import { historyIndex } from '../lib/history-depth.js';
import { generateId } from '../lib/id.js';
import { GIG_DELETE, GIG_FORM } from '../lib/microcopy.js';

/*
 * Add / edit gig sheet (Story 7.9, in a sheet since 7.21). `/gigs/new` adds, `/gigs/:setlistId/edit`
 * edits. Save writes through `useSetlistMutation` as a whole-record PUT, so the
 * stored sections and songs (not shown here) are carried through from the gig
 * being edited or the PUT would delete them. The form mounts only once the gig
 * is available and reads it once, so a background refetch never resets what
 * Sandy is typing. Leaving an edit steps back in history when there is history
 * to step back to, so the gig page isn't stacked twice.
 *
 * Both routes are children of the page they open over (`/gigs`, `/gigs/:setlistId`),
 * so the page stays mounted behind the sheet. Editing also offers "Delete gig"
 * (Story 7.12) in a confirm dialog. The gig and its setlist are one record, so both go.
 */

const PAIR_GAP = 'mt-[calc(var(--spacing-unit)*4)]';
const FIELD_GAP = 'mt-[var(--spacing-unit)]';

export function GigEdit() {
  const { setlistId } = useParams();
  return setlistId === undefined ? <GigForm /> : <EditExisting setlistId={setlistId} />;
}

function EditExisting({ setlistId }: { setlistId: string }) {
  const { setlist, statusLine } = useSetlistOrCached(setlistId);
  const { leave } = useSheetExit(`/gigs/${setlistId}`);
  return (
    <SheetFrame onCancel={leave} described={false}>
      {setlist ? (
        <GigForm key={setlist.setlistId} initial={setlist} />
      ) : (
        <EditSheet
          title={GIG_FORM.editHeading}
          cancelLabel={GIG_FORM.cancel}
          submitLabel={GIG_FORM.save}
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

function GigForm({ initial }: { initial?: Setlist }) {
  const navigate = useNavigate();
  const { saveSetlist } = useSetlistMutation();
  const [newId] = useState(() => generateId());
  const setlistId = initial?.setlistId ?? newId;

  const [venue, setVenue] = useState(initial?.gigMeta.venue ?? '');
  const [date, setDate] = useState(initial?.gigMeta.date ?? '');
  const [time, setTime] = useState(initial?.gigMeta.time ?? '');
  const [saving, setSaving] = useState(false);
  const exitTo = initial ? `/gigs/${setlistId}` : '/gigs';
  const { leave, hasHistory } = useSheetExit(exitTo);
  // After saving a new record, land on its page rather than stepping back.
  const canStepBack = initial !== undefined && hasHistory;
  const venueBlank = venue.trim() === '';
  const dateBlank = date === '';
  const canSave = !venueBlank && !dateBlank;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // A second tap while saving would step back twice.
    if (!canSave || saving) return;
    setSaving(true);
    // Built field by field: the API schema is strict, so no spreading `initial`.
    const record: SetlistPutInput = {
      bandId: ACTIVE_BAND_ID,
      setlistId,
      gigMeta: { venue: venue.trim(), date, ...(time !== '' ? { time } : {}) },
      sections: initial?.sections ?? [],
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    await saveSetlist(record);
    if (canStepBack) navigate(-1);
    else navigate(`/gigs/${setlistId}`, { replace: true });
  }

  return (
    <EditSheet
      title={initial ? GIG_FORM.editHeading : GIG_FORM.addHeading}
      cancelLabel={GIG_FORM.cancel}
      submitLabel={initial ? GIG_FORM.save : GIG_FORM.add}
      submitDisabled={!canSave || saving}
      onCancel={leave}
      onSubmit={onSubmit}
    >
      <div className={PAIR_GAP}>
        <Label htmlFor="gig-venue">{GIG_FORM.venue}</Label>
        <Input
          id="gig-venue"
          type="text"
          required
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className={FIELD_GAP}
        />
      </div>

      <div className={PAIR_GAP}>
        <Label htmlFor="gig-date">{GIG_FORM.date}</Label>
        <Input
          id="gig-date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={FIELD_GAP}
        />
      </div>

      <div className={PAIR_GAP}>
        <Label htmlFor="gig-time">{GIG_FORM.time}</Label>
        <Input
          id="gig-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={FIELD_GAP}
        />
      </div>

      {initial ? <DeleteGig gig={initial} canStepBack={canStepBack} /> : null}
    </EditSheet>
  );
}

function DeleteGig({ gig, canStepBack }: { gig: Setlist; canStepBack: boolean }) {
  const navigate = useNavigate();
  const { deleteSetlist } = useSetlistMutation();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The saved record, not the unsaved form fields.
  const venue = gig.gigMeta.venue.trim();
  const date = formatGigDate(gig.gigMeta.date);

  async function onConfirm() {
    setDeleting(true);
    try {
      await deleteSetlist(gig.setlistId);
      // Story 7.23: step back past the record page when there is history to step into.
      if (canStepBack && historyIndex() >= 2) navigate(-2);
      else navigate('/gigs', { replace: true });
      return;
    } catch {
      setFailed(true);
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
          if (next) setFailed(false);
          setOpen(next);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive-outline">
            <Trash2 aria-hidden="true" />
            {GIG_DELETE.button}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>
            {GIG_DELETE.title(venue ? `${venue}, ${date}` : date)}
          </AlertDialogTitle>
          <AlertDialogDescription>{GIG_DELETE.explain}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={deleting}>
                {GIG_DELETE.keep}
              </Button>
            </AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={onConfirm} disabled={deleting}>
              {GIG_DELETE.yes}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {failed ? (
        <p
          role="alert"
          className="m-0 mt-[var(--spacing-unit)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-foreground"
        >
          {GIG_DELETE.failed}
        </p>
      ) : null}
    </div>
  );
}
