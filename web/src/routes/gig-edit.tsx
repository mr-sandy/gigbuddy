import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
import { ChevronLeft } from 'lucide-react';
import { type FormEvent, type MouseEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { PageHeader } from '../components/page-header.js';
import { PageTitle } from '../components/page-title.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { formatGigDate } from '../lib/gig-date.js';
import { generateId } from '../lib/id.js';
import { GIG_DELETE, GIG_FORM, GIG_SETLIST, GIGS } from '../lib/microcopy.js';

/*
 * Add / edit gig form (Story 7.9). `/gigs/new` adds, `/gigs/:setlistId/edit`
 * edits. Save writes through `useSetlistMutation` as a whole-record PUT, so the
 * stored sections and songs (not shown here) are carried through from the gig
 * being edited or the PUT would delete them. The form mounts only once the gig
 * is available and reads it once, so a background refetch never resets what
 * Sandy is typing. Leaving an edit steps back in history when there is history
 * to step back to, so the gig page isn't stacked twice.
 *
 * Editing also offers "Delete gig" (Story 7.12) behind a second tap. The gig
 * and its setlist are one record, so both go.
 */

const PAIR_GAP = 'mt-[calc(var(--spacing-unit)*4)]';
const FIELD_GAP = 'mt-[var(--spacing-unit)]';
const BODY_PRIMARY =
  'text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-foreground';

export function GigEdit() {
  const { setlistId } = useParams();
  return setlistId === undefined ? <GigForm /> : <EditExisting setlistId={setlistId} />;
}

function EditExisting({ setlistId }: { setlistId: string }) {
  const { setlist, statusLine } = useSetlistOrCached(setlistId);
  if (!setlist) {
    return (
      <>
        <PageHeader
          left={
            <Button asChild variant="ghost" className="text-muted-foreground">
              <Link to="/gigs">
                <ChevronLeft aria-hidden="true" />
                {GIGS.backToGigs}
              </Link>
            </Button>
          }
        />
        <p
          aria-live="polite"
          className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground"
        >
          {statusLine}
        </p>
      </>
    );
  }
  return <GigForm key={setlist.setlistId} initial={setlist} />;
}

function GigForm({ initial }: { initial?: Setlist }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveSetlist } = useSetlistMutation();
  const [newId] = useState(() => generateId());
  const setlistId = initial?.setlistId ?? newId;

  const [venue, setVenue] = useState(initial?.gigMeta.venue ?? '');
  const [date, setDate] = useState(initial?.gigMeta.date ?? '');
  const [time, setTime] = useState(initial?.gigMeta.time ?? '');
  const exitTo = initial ? `/gigs/${setlistId}` : '/gigs';
  // 'default' means this form is the first page in the history stack.
  const hasHistory = location.key !== 'default';
  // After saving a new record, land on its page rather than stepping back.
  const canStepBack = initial !== undefined && hasHistory;
  const leave = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!hasHistory) return;
    e.preventDefault();
    navigate(-1);
  };
  const venueBlank = venue.trim() === '';
  const dateBlank = date === '';
  const canSave = !venueBlank && !dateBlank;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
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
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        left={
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link replace to={exitTo} onClick={leave}>
              <ChevronLeft aria-hidden="true" />
              {initial ? GIG_SETLIST.backToGig : GIGS.backToGigs}
            </Link>
          </Button>
        }
      />
      <PageTitle>{initial ? GIG_FORM.editHeading : GIG_FORM.addHeading}</PageTitle>

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

      <div className="mt-[calc(var(--spacing-unit)*8)] flex items-center gap-[calc(var(--spacing-unit)*6)]">
        <Button type="submit" disabled={!canSave}>
          {GIG_FORM.save}
        </Button>
        <Button asChild variant="ghost">
          <Link replace to={exitTo} onClick={leave}>
            {GIG_FORM.cancel}
          </Link>
        </Button>
      </div>

      {initial ? <DeleteGig gig={initial} /> : null}
    </form>
  );
}

function DeleteGig({ gig }: { gig: Setlist }) {
  const navigate = useNavigate();
  const { deleteSetlist } = useSetlistMutation();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The saved record, not the unsaved form fields.
  const venue = gig.gigMeta.venue.trim();
  const date = formatGigDate(gig.gigMeta.date);

  async function onConfirm() {
    setDeleting(true);
    try {
      await deleteSetlist(gig.setlistId);
      navigate('/gigs', { replace: true });
      return;
    } catch {
      setFailed(true);
    }
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <div className="mt-[calc(var(--spacing-unit)*12)]">
      {confirming ? (
        <>
          <p className={BODY_PRIMARY}>
            {`${GIG_DELETE.confirm} ${venue ? `${venue}, ${date}` : date}?`}
          </p>
          <div className="mt-[calc(var(--spacing-unit)*4)] flex flex-wrap items-center gap-[calc(var(--spacing-unit)*6)]">
            <Button type="button" variant="destructive" onClick={onConfirm} disabled={deleting}>
              {GIG_DELETE.yes}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              {GIG_DELETE.keep}
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="destructive-outline"
          onClick={() => {
            setFailed(false);
            setConfirming(true);
          }}
        >
          {GIG_DELETE.button}
        </Button>
      )}
      {failed ? (
        <p role="alert" className={`mt-[var(--spacing-unit)] ${BODY_PRIMARY}`}>
          {GIG_DELETE.failed}
        </p>
      ) : null}
    </div>
  );
}
