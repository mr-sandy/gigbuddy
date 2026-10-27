import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
import { ChevronLeft } from 'lucide-react';
import { type FormEvent, type MouseEvent, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { PageHeader } from '../components/page-header.js';
import { PageTitle } from '../components/page-title.js';
import { Button } from '../components/ui/button.js';
import { Label } from '../components/ui/label.js';
import { Textarea } from '../components/ui/textarea.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { useSongs } from '../hooks/use-songs.js';
import { formatGigDate } from '../lib/gig-date.js';
import { GIG_SETLIST, GIGS, SETLIST_TEXT } from '../lib/microcopy.js';
import { parseSetlistText, setlistToText } from '../lib/setlist-text.js';

/*
 * Edit a gig's setlist as text (Story 7.10), at `/gigs/:setlistId/setlist`.
 * The text round trip lives in `lib/setlist-text.ts`; Save writes the whole
 * record through `useSetlistMutation`, keeping the gig details. The form mounts
 * only once the gig is available and reads it once, so a background refetch
 * never resets what Sandy is typing. Leaving steps back in history when there
 * is history to step back to, as the gig form does.
 */

const BODY_SECONDARY =
  'mt-[var(--spacing-unit)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground';

export function SetlistEdit() {
  const { setlistId } = useParams();
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
  const leave = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!canStepBack) return;
    e.preventDefault();
    navigate(-1);
  };
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
      <PageHeader
        left={
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link replace to={exitTo} onClick={leave}>
              <ChevronLeft aria-hidden="true" />
              {GIG_SETLIST.backToGig}
            </Link>
          </Button>
        }
      />
      <PageTitle>{venue || formatGigDate(initial.gigMeta.date)}</PageTitle>

      <div className="mt-[calc(var(--spacing-unit)*4)]">
        <Label htmlFor="setlist-text">{SETLIST_TEXT.label}</Label>
        <p id="setlist-hint" className={BODY_SECONDARY}>
          {SETLIST_TEXT.hint}
        </p>
        <Textarea
          ref={textRef}
          id="setlist-text"
          rows={16}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-describedby="setlist-hint"
          className="mt-[var(--spacing-unit)] resize-y"
        />
        {songs ? null : (
          <p aria-live="polite" className={BODY_SECONDARY}>
            {isPending ? SETLIST_TEXT.songsLoading : SETLIST_TEXT.songsError}
          </p>
        )}
        {problems.length > 0 ? (
          <div
            role="alert"
            className="mt-[var(--spacing-unit)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-foreground"
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
        <Button type="submit" disabled={!songs}>
          {SETLIST_TEXT.save}
        </Button>
        <Button asChild variant="ghost">
          <Link replace to={exitTo} onClick={leave}>
            {SETLIST_TEXT.cancel}
          </Link>
        </Button>
      </div>
    </form>
  );
}
