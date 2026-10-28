import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
import { ChevronLeft } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EditSheet, SheetFrame, useSheetExit } from '../components/edit-sheet.js';
import { Label } from '../components/ui/label.js';
import { NativeSelect } from '../components/ui/native-select.js';
import { Textarea } from '../components/ui/textarea.js';
import { useSetlistMutation } from '../hooks/use-setlist-mutation.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { useSongMutation } from '../hooks/use-song-mutation.js';
import { useSongs } from '../hooks/use-songs.js';
import { formatGigDate } from '../lib/gig-date.js';
import { generateId } from '../lib/id.js';
import { SETLIST_TEXT } from '../lib/microcopy.js';
import {
  type Choice,
  defaultChoice,
  matchKey,
  parseSetlistText,
  resolveDraft,
  type SetlistDraft,
  setlistToText,
} from '../lib/setlist-text.js';

/*
 * Edit a gig's setlist as text (Story 7.10, in a sheet since 7.21), at `/gigs/:setlistId/setlist`.
 * The text round trip lives in `lib/setlist-text.ts`; Save writes the whole
 * record through `useSetlistMutation`, keeping the gig details. The form mounts
 * only once the gig is available and reads it once, so a background refetch
 * never resets what Sandy is typing. Leaving steps back in history when there
 * is history to step back to, as the gig form does.
 *
 * Story 7.25: when lines don't match exactly one song, Save turns the same
 * sheet into a "Check songs" step with one dropdown per distinct line. Nothing
 * is created until that step's Save.
 */

const CHECK_LABEL =
  'text-[length:var(--text-row)] leading-[var(--text-row--line-height)] font-normal';

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

function choiceValue(choice: Choice | undefined): string {
  return choice?.kind === 'song' ? `song:${choice.songId}` : (choice?.kind ?? 'new');
}

function SetlistTextForm({ initial }: { initial: Setlist }) {
  const navigate = useNavigate();
  const { saveSetlist } = useSetlistMutation();
  const { saveSong } = useSongMutation();
  const { data: songs, isPending } = useSongs();
  const [text, setText] = useState(() => setlistToText(initial.sections));
  const [step, setStep] = useState<'text' | 'check'>('text');
  const [draft, setDraft] = useState<SetlistDraft>();
  const [choices, setChoices] = useState<Map<string, Choice>>(() => new Map());
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const switched = useRef(false);
  const { setlistId } = initial;
  const exitTo = `/gigs/${setlistId}`;
  const { leave, hasHistory: canStepBack } = useSheetExit(exitTo);
  const venue = initial.gigMeta.venue.trim();
  const date = formatGigDate(initial.gigMeta.date);

  // Switching steps happens inside the open sheet: scroll to the top and put
  // focus on the first control of the step.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.closest('[data-slot="sheet-body"]')?.scrollTo?.({ top: 0 });
    if (step === 'check') body.querySelector('select')?.focus();
    else if (switched.current) body.querySelector('textarea')?.focus();
    switched.current = true;
  }, [step]);

  async function saveSections(sections: SetlistPutInput['sections']) {
    // Built field by field: the API schema is strict, so no spreading `initial`.
    const record: SetlistPutInput = {
      bandId: ACTIVE_BAND_ID,
      setlistId,
      gigMeta: initial.gigMeta,
      sections,
      clientWrittenAt: new Date().toISOString(),
      version: 1,
    };
    await saveSetlist(record);
    if (canStepBack) navigate(-1);
    else navigate(exitTo, { replace: true });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // A second tap while saving would step back twice.
    if (!songs || saving) return;
    if (step === 'text') {
      const next = parseSetlistText(text, songs, initial.sections);
      if (next.pending.length === 0) {
        setSaving(true);
        await saveSections(resolveDraft(next, new Map(), new Map()));
        return;
      }
      // Keep earlier choices for lines still pending, so Back then Save loses none.
      const kept = new Map<string, Choice>();
      for (const p of next.pending) kept.set(p.key, choices.get(p.key) ?? defaultChoice(p));
      setDraft(next);
      setChoices(kept);
      setStep('check');
      return;
    }
    if (!draft) return;
    setSaving(true);
    // Lines whose tidied titles match share one new song.
    const newRefs = new Map<string, { songId: string; titleSnapshot: string }>();
    const byTitle = new Map<string, { songId: string; titleSnapshot: string }>();
    for (const p of draft.pending) {
      if (choices.get(p.key)?.kind !== 'new') continue;
      const titleKey = matchKey(p.newTitle);
      let created = byTitle.get(titleKey);
      // A tidied title that already names a library song reuses it.
      const existing = songs.find((song) => matchKey(song.title) === titleKey);
      if (!created && existing)
        created = { songId: existing.songId, titleSnapshot: existing.title };
      if (!created) {
        const songId = generateId();
        await saveSong({
          bandId: ACTIVE_BAND_ID,
          songId,
          title: p.newTitle,
          clientWrittenAt: new Date().toISOString(),
          version: 1,
        });
        created = { songId, titleSnapshot: p.newTitle };
        byTitle.set(titleKey, created);
      }
      newRefs.set(p.key, created);
    }
    // The setlist is written after the songs, so the outbox sends them first.
    await saveSections(resolveDraft(draft, choices, newRefs));
  }

  const description = venue ? `${venue} · ${date}` : date;

  if (step === 'check' && draft) {
    const matched = draft.sections.reduce(
      (n, section) => n + section.lines.filter((line) => 'ref' in line).length,
      0,
    );
    const library = [...(songs ?? [])].sort((a, b) =>
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
    );
    return (
      <EditSheet
        title={SETLIST_TEXT.checkHeading}
        cancelLabel={SETLIST_TEXT.back}
        cancelIcon={<ChevronLeft aria-hidden="true" />}
        submitLabel={SETLIST_TEXT.save}
        submitDisabled={!songs || saving}
        onCancel={() => setStep('text')}
        onSubmit={onSubmit}
        description={description}
      >
        <div ref={bodyRef} className="mt-[calc(var(--spacing-unit)*4)]">
          <p className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground">
            {SETLIST_TEXT.checkIntro(draft.pending.length, matched)}
          </p>
          {draft.pending.map((p, i) => {
            const id = `check-song-${i}`;
            return (
              <div key={p.key} className="mt-[calc(var(--spacing-unit)*4)]">
                <Label htmlFor={id} className={CHECK_LABEL}>
                  {`“${p.line}”`}
                </Label>
                <NativeSelect
                  id={id}
                  value={choiceValue(choices.get(p.key))}
                  onChange={(e) => {
                    const value = e.target.value;
                    let choice: Choice = { kind: 'new' };
                    if (value === 'out') choice = { kind: 'out' };
                    else if (value.startsWith('song:')) {
                      const songId = value.slice(5);
                      const found = songs?.find((song) => song.songId === songId);
                      if (found) choice = { kind: 'song', songId, title: found.title };
                    }
                    setChoices((current) => new Map(current).set(p.key, choice));
                  }}
                  className="mt-[var(--spacing-unit)]"
                >
                  {p.candidates.map((candidate) => (
                    <option key={candidate.songId} value={`song:${candidate.songId}`}>
                      {SETLIST_TEXT.songWithKey(candidate.title, candidate.key)}
                    </option>
                  ))}
                  {p.guesses[0] ? (
                    <optgroup label={SETLIST_TEXT.bestGuess}>
                      <option value={`song:${p.guesses[0].songId}`}>{p.guesses[0].title}</option>
                    </optgroup>
                  ) : null}
                  {p.guesses.length > 1 ? (
                    <optgroup label={SETLIST_TEXT.otherGuesses}>
                      {p.guesses.slice(1).map((guess) => (
                        <option key={guess.songId} value={`song:${guess.songId}`}>
                          {guess.title}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <option value="new">{SETLIST_TEXT.addNew(p.newTitle)}</option>
                  <option value="out">{SETLIST_TEXT.leaveOut}</option>
                  <optgroup label={SETLIST_TEXT.wholeLibrary}>
                    {library.map((song) => (
                      <option key={song.songId} value={`song:${song.songId}`}>
                        {song.title}
                      </option>
                    ))}
                  </optgroup>
                </NativeSelect>
              </div>
            );
          })}
          {draft.autoMatched.length > 0 ? (
            <div className="mt-[calc(var(--spacing-unit)*6)]">
              <h3 className={CHECK_LABEL}>{SETLIST_TEXT.matchedHeading}</h3>
              <ul className="m-0 mt-[var(--spacing-unit)] list-none p-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground">
                {draft.autoMatched.map((m) => (
                  <li key={m.line}>{SETLIST_TEXT.matchedItem(m.line, m.title)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </EditSheet>
    );
  }

  return (
    <EditSheet
      title={SETLIST_TEXT.heading}
      cancelLabel={SETLIST_TEXT.cancel}
      submitLabel={SETLIST_TEXT.save}
      submitDisabled={!songs || saving}
      onCancel={leave}
      onSubmit={onSubmit}
      description={description}
    >
      <div ref={bodyRef} className="mt-[calc(var(--spacing-unit)*4)]">
        <Label htmlFor="setlist-text">{SETLIST_TEXT.label}</Label>
        <p id="setlist-hint" className={BODY_SECONDARY}>
          {SETLIST_TEXT.hint}
        </p>
        <Textarea
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
      </div>
    </EditSheet>
  );
}
