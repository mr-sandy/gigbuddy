import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
import { type FormEvent, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EditSheet, SheetFrame, useSheetExit } from '../components/edit-sheet.js';
import { Label } from '../components/ui/label.js';
import { Textarea } from '../components/ui/textarea.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { useSongs } from '../hooks/use-songs.js';
import { formatGigDate } from '../lib/gig-date.js';
import { SETLIST_TEXT } from '../lib/microcopy.js';
import { parseSetlistText, setlistToText } from '../lib/setlist-text.js';

/*
 * Edit a gig's setlist as text (Story 7.10, in a sheet since 7.21), at `/gigs/:setlistId/setlist`.
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
  const { leave } = useSheetExit(`/gigs/${setlistId}`);
  return (
    <SheetFrame onCancel={leave} described={setlist !== undefined}>
      {setlist ? (
        <SetlistTextForm key={setlist.setlistId} initial={setlist} />
      ) : (
        <EditSheet
          title={SETLIST_TEXT.heading}
          cancelLabel={SETLIST_TEXT.cancel}
          submitLabel={SETLIST_TEXT.save}
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

function SetlistTextForm({ initial }: { initial: Setlist }) {
  const navigate = useNavigate();
  const { saveSetlist } = useSetlistMutation();
  const { data: songs, isPending } = useSongs();
  const [text, setText] = useState(() => setlistToText(initial.sections));
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { setlistId } = initial;
  const exitTo = `/gigs/${setlistId}`;
  const { leave, hasHistory: canStepBack } = useSheetExit(exitTo);
  const venue = initial.gigMeta.venue.trim();
  const date = formatGigDate(initial.gigMeta.date);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // A second tap while saving would step back twice.
    if (!songs || saving) return;
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
    setSaving(true);
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
    <EditSheet
      title={SETLIST_TEXT.heading}
      cancelLabel={SETLIST_TEXT.cancel}
      submitLabel={SETLIST_TEXT.save}
      submitDisabled={!songs || saving}
      onCancel={leave}
      onSubmit={onSubmit}
      description={venue ? `${venue} · ${date}` : date}
    >
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
    </EditSheet>
  );
}
