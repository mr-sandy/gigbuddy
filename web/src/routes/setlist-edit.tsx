import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
import { type FormEvent, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { useSongs } from '../hooks/use-songs.js';
import { formatGigDate } from '../lib/gig-date.js';
import { GIGS, SETLIST_TEXT } from '../lib/microcopy.js';
import { parseSetlistText, setlistToText } from '../lib/setlist-text.js';

/*
 * Edit a gig's setlist as text (Story 7.10), at `/gigs/:setlistId/setlist`.
 * The text round trip lives in `lib/setlist-text.ts`; Save writes the whole
 * record through `useSetlistMutation`, keeping the gig details. The form mounts
 * only once the gig is available and reads it once, so a background refetch
 * never resets what Sandy is typing. Leaving steps back in history when there
 * is history to step back to, as the gig form does.
 */

const LINK_CLASS =
  'inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]';
const LABEL_CLASS =
  'block text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-primary)]';
const FIELD_CLASS =
  'mt-[var(--spacing-unit)] box-border w-full rounded-[4px] border border-[color:var(--color-text-secondary)] bg-[color:var(--color-bg)] p-[calc(var(--spacing-unit)*3)] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-[color:var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]';
const BODY_SECONDARY =
  'mt-[var(--spacing-unit)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-secondary)]';

export function SetlistEdit() {
  const { setlistId } = useParams();
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
  return <SetlistTextForm key={setlist.setlistId} initial={setlist} />;
}

function SetlistTextForm({ initial }: { initial: Setlist }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveSetlist } = useSetlistMutation();
  const { data: songs, isPending } = useSongs();
  const [text, setText] = useState(() => setlistToText(initial.sections));
  const [problems, setProblems] = useState<string[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { setlistId } = initial;
  const exitTo = `/gigs/${setlistId}`;
  // 'default' means this form is the first page in the history stack.
  const canStepBack = location.key !== 'default';
  const venue = initial.gigMeta.venue.trim();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!songs) return;
    const result = parseSetlistText(text, songs, initial.sections);
    if (!result.ok) {
      setProblems([
        ...result.notInLibrary.map((line) => `${SETLIST_TEXT.notInLibrary} ${line}`),
        ...result.ambiguous.map((line) => `${SETLIST_TEXT.ambiguous} ${line}`),
      ]);
      textRef.current?.focus();
      return;
    }
    setProblems([]);
    // Built field by field: the API schema is strict, so no spreading `initial`.
    const record: SetlistPutInput = {
      bandId: ACTIVE_BAND_ID,
      setlistId,
      gigMeta: initial.gigMeta,
      sections: result.sections,
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    await saveSetlist(record);
    if (canStepBack) navigate(-1);
    else navigate(exitTo, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageTitle>{venue || formatGigDate(initial.gigMeta.date)}</PageTitle>

      <div className="mt-[calc(var(--spacing-unit)*4)]">
        <label htmlFor="setlist-text" className={LABEL_CLASS}>
          {SETLIST_TEXT.label}
        </label>
        <p id="setlist-hint" className={BODY_SECONDARY}>
          {SETLIST_TEXT.hint}
        </p>
        <textarea
          ref={textRef}
          id="setlist-text"
          rows={16}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-describedby="setlist-hint"
          className={`${FIELD_CLASS} resize-y`}
        />
        {songs ? null : (
          <p aria-live="polite" className={BODY_SECONDARY}>
            {isPending ? SETLIST_TEXT.songsLoading : SETLIST_TEXT.songsError}
          </p>
        )}
        {problems.length > 0 ? (
          <div
            role="alert"
            className="mt-[var(--spacing-unit)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-primary)]"
          >
            {problems.map((problem, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list of messages
              <p key={i} className="m-0">
                {problem}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-[calc(var(--spacing-unit)*8)] flex items-center gap-[calc(var(--spacing-unit)*6)]">
        <button
          type="submit"
          disabled={!songs}
          className="min-h-tap rounded-[4px] border-2 border-[color:var(--color-text-primary)] bg-transparent px-[calc(var(--spacing-unit)*6)] text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] disabled:opacity-50"
        >
          {SETLIST_TEXT.save}
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
          {SETLIST_TEXT.cancel}
        </Link>
      </div>
    </form>
  );
}
