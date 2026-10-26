import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
import { type FormEvent, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { formatGigDate } from '../lib/gig-date.js';
import { generateId } from '../lib/id.js';
import { GIG_DELETE, GIG_FORM, GIGS } from '../lib/microcopy.js';

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

const LINK_CLASS =
  'inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]';
const LABEL_CLASS =
  'block text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-primary)]';
const FIELD_CLASS =
  'mt-[var(--spacing-unit)] box-border w-full rounded-[4px] border border-[color:var(--color-text-secondary)] bg-[color:var(--color-bg)] p-[calc(var(--spacing-unit)*3)] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-[color:var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]';
const TAP_FIELD_CLASS = `${FIELD_CLASS} min-h-tap`;
const PAIR_GAP = 'mt-[calc(var(--spacing-unit)*4)]';
const BUTTON_CLASS =
  'min-h-tap rounded-[4px] border-2 border-[color:var(--color-text-primary)] bg-transparent px-[calc(var(--spacing-unit)*6)] text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]';
const BODY_PRIMARY =
  'text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-primary)]';

export function GigEdit() {
  const { setlistId } = useParams();
  return setlistId === undefined ? <GigForm /> : <EditExisting setlistId={setlistId} />;
}

function EditExisting({ setlistId }: { setlistId: string }) {
  const { setlist, statusLine } = useSetlistOrCached(setlistId);
  if (!setlist) {
    return (
      <>
        <Link to="/gigs" className={LINK_CLASS}>
          {GIGS.backToGigs}
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
  const [showRequired, setShowRequired] = useState(false);
  const venueRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const exitTo = initial ? `/gigs/${setlistId}` : '/gigs';
  // 'default' means this form is the first page in the history stack.
  const canStepBack = initial !== undefined && location.key !== 'default';
  const venueBlank = venue.trim() === '';
  const dateBlank = date === '';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (venueBlank || dateBlank) {
      setShowRequired(true);
      (venueBlank ? venueRef : dateRef).current?.focus();
      return;
    }
    setShowRequired(false);
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
      <PageTitle>{initial ? GIG_FORM.editHeading : GIG_FORM.addHeading}</PageTitle>

      <div className={PAIR_GAP}>
        <label htmlFor="gig-venue" className={LABEL_CLASS}>
          {GIG_FORM.venue}
        </label>
        <input
          ref={venueRef}
          id="gig-venue"
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          aria-invalid={(showRequired && venueBlank) || undefined}
          className={FIELD_CLASS}
        />
      </div>

      <div className={PAIR_GAP}>
        <label htmlFor="gig-date" className={LABEL_CLASS}>
          {GIG_FORM.date}
        </label>
        <input
          ref={dateRef}
          id="gig-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={(showRequired && dateBlank) || undefined}
          className={TAP_FIELD_CLASS}
        />
        {showRequired ? (
          <p
            role="alert"
            className="mt-[var(--spacing-unit)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-primary)]"
          >
            {GIG_FORM.required}
          </p>
        ) : null}
      </div>

      <div className={PAIR_GAP}>
        <label htmlFor="gig-time" className={LABEL_CLASS}>
          {GIG_FORM.time}
        </label>
        <input
          id="gig-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={TAP_FIELD_CLASS}
        />
      </div>

      <div className="mt-[calc(var(--spacing-unit)*8)] flex items-center gap-[calc(var(--spacing-unit)*6)]">
        <button type="submit" className={BUTTON_CLASS}>
          {GIG_FORM.save}
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
          {GIG_FORM.cancel}
        </Link>
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
            <button type="button" onClick={onConfirm} disabled={deleting} className={BUTTON_CLASS}>
              {GIG_DELETE.yes}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className={BUTTON_CLASS}
            >
              {GIG_DELETE.keep}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setConfirming(true);
          }}
          className={BUTTON_CLASS}
        >
          {GIG_DELETE.button}
        </button>
      )}
      {failed ? (
        <p role="alert" className={`mt-[var(--spacing-unit)] ${BODY_PRIMARY}`}>
          {GIG_DELETE.failed}
        </p>
      ) : null}
    </div>
  );
}
