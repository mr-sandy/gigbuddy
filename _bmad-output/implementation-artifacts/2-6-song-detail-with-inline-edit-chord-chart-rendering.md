---
baseline_commit: 7c7cb5b
builds_on: 2-5-library-list-surface
---

# Story 2.6: Song Detail with inline edit + chord chart rendering (FR-1, FR-2, FR-3, FR-5)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want a single Song Detail surface that serves both create and edit, with field-by-field inline editing, debounced silent save, and chord-chart rendering per the V1 floor,
so that I can capture careful notes on every Song without modal ceremony and without losing what I just typed.

## Acceptance Criteria

**AC-1 — `web/src/api/songs.ts` exposes `getSong(songId)` and `putSong(input)` over `apiFetch` with the right envelopes**

**Given** `web/src/api/songs.ts` (UPDATE)
**When** reviewed
**Then** it adds `async function getSong(songId: string): Promise<Song | null>` that calls `apiFetch('/api/v1/songs/<songId>', { method: 'GET', schema: GetSongResponseSchema })` where `GetSongResponseSchema = z.discriminatedUnion('status', [OkResponseSchema(SongSchema), ErrorResponseSchema])`; on `status === 'ok'` returns `data.data`; on `status === 'error'` with `error.code === 'NOT_FOUND'` returns `null`; any other error envelope or non-2xx status throws (TanStack Query retry layer handles it)
**And** it adds `async function putSong(input: SongPutInput): Promise<{ kind: 'applied'; data: Song } | { kind: 'dropped-as-stale'; currentState: Song }>` that calls `apiFetch('/api/v1/songs/<input.songId>', { method: 'PUT', body: input, schema: PutResponseSchema })` where `PutResponseSchema = z.discriminatedUnion('status', [AppliedResponseSchema(SongSchema), DroppedAsStaleResponseSchema(SongSchema), ErrorResponseSchema])`; on `status === 'applied'` returns `{ kind: 'applied', data }`; on `status === 'dropped-as-stale'` returns `{ kind: 'dropped-as-stale', currentState }`; any other envelope or non-2xx throws
**And** both functions reuse the existing `listSongs()` import structure: schemas composed at the call site, no new shared exports, errors propagate to callers
**And** the file's leading comment is updated to acknowledge Story 2.6 now owns the read-single + write paths (so the file is no longer "list only")
**And** `web/src/api/songs.test.ts` (UPDATE) gains cases for `getSong`: a 200 ok envelope returns the unwrapped `Song`; a 404 with `error.code = 'NOT_FOUND'` returns `null`; a malformed envelope throws; the call uses the GET method against `/api/v1/songs/<songId>` with no body
**And** the same test file gains cases for `putSong`: a 200 applied envelope returns `{ kind: 'applied', data }`; a 200 dropped-as-stale envelope returns `{ kind: 'dropped-as-stale', currentState }`; the PUT body is the input verbatim; a 400 error envelope throws

**AC-2 — `web/src/hooks/use-song.ts` is a TanStack Query hook keyed on `['song', bandId, songId]`**

**Given** `web/src/hooks/use-song.ts` (NEW)
**When** reviewed
**Then** it exports `function useSong(songId: string | null): UseQueryResult<Song | null, Error>` calling `useQuery({ queryKey: ['song', ACTIVE_BAND_ID, songId], queryFn: () => getSong(songId!), enabled: songId !== null })`
**And** the `null` arm is for the `/songs/new` route — the hook is mounted on the route but the route has no songId yet; the hook returns `data: undefined, isLoading: false, isFetching: false` while disabled
**And** the queryKey shape matches the flusher's `queryKeyForSong(bandId, songId)` (`web/src/sync/flusher.ts:36-38`) exactly — three elements, `['song', bandId, songId]`. **Do NOT use `['song', songId]` or `['songs', bandId, songId]`** — those break the flusher's invalidation
**And** no per-call `staleTime`, `gcTime`, or `refetchOnWindowFocus` overrides are set — defaults from the SyncProvider's QueryClient apply (gcTime: Infinity, staleTime: 0)
**And** the hook does NOT pass `select`, `placeholderData`, or `initialData`; the queryFn returns the `Song | null` shape directly
**And** the hook imports `ACTIVE_BAND_ID` from `@gigbuddy/shared` (NOT from `web/src/lib/band.ts` per the Story 2.4 / 2.5 contract); `getSong` from `../api/songs.js`; `useQuery` from `@tanstack/react-query`
**And** `web/src/hooks/use-song.test.tsx` (NEW) covers: the hook resolves to a Song on success; the queryKey is `['song', ACTIVE_BAND_ID, songId]` (assert via `queryClient.getQueryData(['song', ACTIVE_BAND_ID, songId])` after resolution); a 404 resolves to `data: null` (not an error — the API call resolves successfully with `null` per AC-1); `enabled: false` when `songId === null` (the hook does NOT fire `getSong`)
**And** tests use a fresh `QueryClient` per case with `retry: false` (mirrors `web/src/hooks/use-songs.test.tsx`'s pattern); do NOT touch the singleton from `sync/query-client.tsx`

**AC-3 — `web/src/lib/song-id.ts` exports `generateSongId()` (NanoID, 16-char URL-safe) matching AR-47**

**Given** `web/src/lib/song-id.ts` (NEW)
**When** reviewed
**Then** it exports `function generateSongId(): string` returning a 16-char URL-safe NanoID using `customAlphabet` from `nanoid` with the same alphabet constant (`'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'`) as `web/src/sync/outbox.ts:21-22` — extracted into the song-id module so the outbox and the song-id generator share one source of truth
**And** the alphabet constant is exported from `web/src/lib/song-id.ts` as `URL_SAFE_ALPHABET` so `web/src/sync/outbox.ts` can import it from `../lib/song-id.js` (UPDATE outbox.ts to import the constant — DO NOT duplicate the literal)
**And** `web/src/lib/song-id.test.ts` (NEW) asserts: a generated id has length 16; every character is in the URL-safe alphabet; two consecutive calls produce different ids (no statistical bound — just `id1 !== id2`)
**And** the file is the ONLY song-id producer in the codebase — the song-detail route imports `generateSongId()` for the `/songs/new` flow (AC-7); future stories that need server-side song-id generation (none in V1) would add their own equivalent under `api/` or `infra/`

**AC-4 — `web/src/hooks/use-song-mutation.ts` enqueues a whole-record PUT to the outbox and updates both per-song and list caches optimistically**

**Given** `web/src/hooks/use-song-mutation.ts` (NEW)
**When** reviewed
**Then** it exports `function useSongMutation(): { saveSong: (record: SongPutInput) => Promise<void> }` returning a stable callback (memoized via `useCallback`) — NOT a `useMutation` from TanStack Query, because the outbox owns the network round-trip and retry semantics (not TanStack)
**And** `saveSong(record)`:
  1. Optimistically writes the per-song cache: `queryClient.setQueryData(['song', record.bandId, record.songId], record)` — the cached shape is the same `SongPutInput` shape minus `serverReceivedAt`; for the cache, fabricate `serverReceivedAt` as the current ISO timestamp so the cached value matches the `SongSchema` (the cache holds full `Song`s, not `SongPutInput`s)
  2. Optimistically merges the per-song record into the list cache: `queryClient.setQueryData(['songs', record.bandId], (current: Song[] | undefined) => mergeSongIntoList(current ?? [], optimisticSong))` where `mergeSongIntoList` replaces an existing entry by `songId` or inserts in alphabetical order by title (`localeCompare` with `'en'` + `sensitivity: 'base'` — matches the server's sort in `api/src/routes/songs.ts:6-8`)
  3. Enqueues the outbox PUT: `await enqueue({ recordKey: songRecordKey(record.bandId, record.songId), payload: record, clientWrittenAt: record.clientWrittenAt })`
  4. Kicks the flusher: `await flushOnce()` — non-blocking; failures are owned by the flusher's retry path; the function does not throw
**And** the hook imports: `queryClient` from `../sync/query-client.js` (the singleton — not the React-context-resolved client; the optimistic writes must reach the same store the SyncProvider exposes); `enqueue` from `../sync/outbox.js`; `flushOnce` from `../sync/flusher.js`; `songRecordKey` from `../sync/record-key.js`
**And** the hook does NOT use `useQueryClient()` from `@tanstack/react-query` — using the singleton directly avoids a context dependency that breaks the "callable from any component" contract (this matches the flusher's existing pattern of holding a module-scope `queryClientRef`)
**And** `mergeSongIntoList` is a pure helper exported alongside the hook for testability; it preserves the server's alphabetical contract on optimistic inserts so the list re-renders in the right order without a refetch
**And** `web/src/hooks/use-song-mutation.test.tsx` (NEW) covers:
  - enqueueing a new song: outbox now contains one pending entry with the correct `recordKey`, `payload`, `clientWrittenAt`; per-song cache holds the new record; list cache holds the new record at the correct alphabetical position
  - enqueueing an edit (existing song): outbox coalesces; per-song cache is updated; list cache replaces the matching entry by `songId` (the title may differ — alphabetical re-sort happens)
  - `mergeSongIntoList` cases: empty list + new song → length 1; existing list + new title sorts correctly; existing list + same songId replaces (does NOT duplicate)
**And** tests `import 'fake-indexeddb/auto';` at the top, mirror `web/src/sync/outbox.test.ts`'s setup pattern, and use `__resetOutboxForTests()` in `beforeEach`. The flusher's `flushOnce` is stubbed (`vi.mock('../sync/flusher.js', () => ({ flushOnce: vi.fn().mockResolvedValue('flushed') }))`) — the hook test exercises the enqueue + cache write contract; the flusher contract is exercised by `flusher.test.ts`
**And** the hook does NOT export a "saveSongAndWait" variant — saves are silent and optimistic per FR-2; the UI never blocks on the network round-trip

**AC-5 — `web/src/components/inline-edit-field.tsx` is a stateless inline-edit primitive (no edit-mode toggle, no save button)**

**Given** `web/src/components/inline-edit-field.tsx` (NEW)
**When** reviewed
**Then** it exports `function InlineEditField(props: { value: string; onCommit: (next: string) => void; multiline?: boolean; ariaLabel: string; placeholder?: string; className?: string; inputClassName?: string; autoFocus?: boolean; disabled?: boolean; }): JSX.Element`
**And** the component is a controlled-by-prop, locally-buffered editor:
  - It receives the canonical `value` via props; it maintains `local: string` via `useState(value)` for in-progress typing
  - **External `value` change syncs the local buffer:** a `useEffect(() => setLocal(value), [value])` resets `local` whenever the `value` prop changes (the stale-write replacement in AC-7 mutates the cache to `currentState`, which flows back through `value` — without this sync, the field would keep showing Sandy's superseded text). The sync fires even while the field is focused; the rare typing-during-stale-write case is acceptable (the banner makes the situation clear and Sandy can re-type)
  - The display state renders the local buffer in a `<span>` (or a render-into-place input) — visually flat, no border (per UX-DR4 / DESIGN.md `Inline edit field`)
  - On focus, the field becomes editable (an `<input>` for single-line; a `<textarea>` for `multiline`). A thin `accent` underline appears in Practice; in Performance it appears as an accent color shift on the active line (use `focus-visible:[box-shadow:_0_1px_0_0_var(--color-accent)]` or equivalent token-based treatment — do NOT inline hex)
  - On blur, the component fires `onCommit(local)` IFF `local !== value`. No commit on identical input. The commit fires synchronously inside the blur handler — the **debounce lives in the route** (AC-7's wrap), not in the field itself
  - When `disabled === true`, the field renders the display state and ignores click/focus events; typing is impossible and `onCommit` never fires. AC-7's `/songs/new` flow uses this to lock the non-Title fields until Title commits
**And** `multiline === true` renders a `<textarea>` that grows vertically with content (`rows={1}` + a `useLayoutEffect` that resizes to `scrollHeight` on input — keep it simple, no auto-resize library)
**And** the field's input element receives `aria-label={ariaLabel}` so screen readers announce the field's purpose (matches UX-DR6 — accessibility primitives line; visible labels in the route mean the field's accessible name overrides the visible label only when supplied, but the visible label is rendered SEPARATELY by the route as a hint for sighted users — see AC-7's spec)
**And** the field renders the editorial serif face by default (`var(--font-serif-editorial)`); for `chordChart` / `key` / `patch` fields the route applies a `className` override using `var(--font-mono-slab)` (see AC-7)
**And** the field satisfies `min-h-tap` (tap target 44pt) — on iPhone in particular this matters; do NOT replace tap height with raw pixels
**And** there is NO save button, NO "edit" toggle, NO check / x affordances, NO loading spinner, NO success indicator (per FR-2 / EXPERIENCE.md State Patterns "Save in progress | Silent. No indicator.")
**And** clicking/tapping the display state moves focus into the underlying input WITHOUT a re-render flash (use a single conditional render or a render-into-place pattern; whichever is simpler — pick the simpler one)
**And** `web/src/components/inline-edit-field.test.tsx` (NEW) covers:
  - renders the `value` prop in the display state
  - clicking the field focuses the input
  - typing updates the local buffer (assert via `screen.getByRole('textbox').value`)
  - blur fires `onCommit` with the typed value
  - blur does NOT fire `onCommit` when the local buffer equals the original `value` (no-op blur)
  - `value` prop change after mount updates the local buffer (re-render with a different `value`; assert the input reflects the new value without typing — proves the external-sync effect)
  - `multiline === true` renders a `<textarea>` not an `<input>` (assert via tag name)
  - `aria-label` is on the editor element (assert via `getByLabelText(ariaLabel)`)
  - `placeholder` renders when the local buffer is empty (assert via `getByPlaceholderText`)
  - `disabled === true` ignores click/focus — assert `userEvent.click(field)` followed by `userEvent.type(field, 'x')` does NOT change the displayed text and does NOT fire `onCommit`
**And** the component does NOT add a debounce timer of its own — that's the route's responsibility per AC-7

**AC-6 — `web/src/components/chord-chart.tsx` renders the V1 chord-chart floor per UX-DR5**

**Given** `web/src/components/chord-chart.tsx` (NEW)
**When** reviewed
**Then** it exports `function ChordChart(props: { text: string; urlsTappable: boolean }): JSX.Element`
**And** the component renders `props.text` line by line:
  - Lines matching `^\s*\{[^}]*\}\s*$` (a single curly-brace-wrapped token on its own line, possibly with surrounding whitespace) render as **section breaks** — visually centered, smaller mono caps, with vertical breathing space. The display strips the `{` and `}` braces; the rendered text is the inner content (e.g., `{Verse 1}` renders as `VERSE 1`)
  - Blank lines (zero non-whitespace characters) render as visible vertical breathing space — preserve them; do NOT collapse consecutive blank lines into a single gap (architecture's "blank lines preserved" rule applies literally)
  - All other lines render as monospace text at `--text-perf-chord` size with `font-family: var(--font-mono-slab)` — generous line-height (`var(--text-perf-chord--line-height)`)
**And** when `urlsTappable === true`, URLs inside non-section lines are wrapped in `<a href="...">` rendered in the `accent` color; the URL detection uses a simple regex (`https?:\/\/\S+`) — V1 floor, not a fully-RFC-compliant URL parser. Captured URLs render with `target="_blank"` and `rel="noopener noreferrer"`
**And** when `urlsTappable === false`, URLs render as plain inert text (NO anchor tag, NO color shift) — Performance atmosphere matches FR-5 / UX-DR5
**And** the route (AC-7) passes `urlsTappable={atmosphere === 'practice'}`. Atmosphere detection in the route: read `document.documentElement.dataset.atmosphere` (set at boot by `applyBootAtmosphere()`) inside a `useMemo`; that is the single source of truth per architecture.md "Theme atmosphere" — do NOT use `isIPhone()` as a proxy for atmosphere (the relationship is set at boot, not on a per-render check)
**And** if `text` is empty (zero characters or only whitespace), the component renders nothing — no `<pre>`-style empty box, no placeholder. The "honest-empty" rule from EXPERIENCE.md State Patterns applies
**And** `web/src/components/chord-chart.test.tsx` (NEW) covers:
  - plain monospace lines render as text
  - blank lines preserved (two `\n\n\n` → two visible blank gaps, not one)
  - `{Verse 1}` on its own line renders as a section-break element with inner text `Verse 1` (or `VERSE 1` after CSS — assert the structural class/role, not the post-transform text if it's done with `text-transform: uppercase` in CSS)
  - `https://example.com` in a content line renders as an `<a>` when `urlsTappable=true`, and as plain text (no `<a>`) when `urlsTappable=false`
  - empty / whitespace-only `text` renders nothing visible
  - mixed input: section + content + blank + URL renders correctly in order

**AC-7 — `web/src/routes/song-detail.tsx` is the single Song Detail surface, mounted at both `/songs/new` and `/songs/:songId`**

**Given** `web/src/routes/song-detail.tsx` (NEW) registered in `web/src/router.tsx` (UPDATE)
**When** the user navigates to `/songs/new`
**Then** the route generates a draft `songId` (via `generateSongId()` — AC-3) using `useState(generateSongId())` so the id is stable across re-renders inside this mount
**And** the surface renders all FR-5 fields as `<InlineEditField>` instances, each empty, with the Title field auto-focused (per AC; use `autoFocus` on the field)
**And** Title is required to create the Song (FR-5 / AC) — when the user types a non-empty Title and blurs:
  1. A debounced commit fires within 200ms (per NFR-4) — use a `useDebouncedCommit` wrapper that the field's `onCommit` callback flows into. The 200ms timer starts on the LATEST blur/keystroke commit; rapid blurs collapse into one save
  2. The route invokes `saveSong(record)` from `useSongMutation()` (AC-4) with the whole-record body. The record is built from local component state (one `useState` per field) — `bandId: ACTIVE_BAND_ID`, `songId: <draftSongId>`, `title: <typed>`, all other fields empty strings or `undefined`, `clientWrittenAt: new Date().toISOString()`, `version: 1`
  3. The route navigates to `/songs/:newSongId` via `useNavigate()` from `react-router` (`navigate(\`/songs/\${draftSongId}\`, { replace: true })`) so the back button doesn't return to `/songs/new`
**And** if the user blurs the Title field WITHOUT typing anything (the local buffer is empty), the route does NOT create a Song and does NOT navigate — the URL remains `/songs/new`. (Per FR-5: Title is required.)
**And** if the user types a non-empty Title and then erases it before blur (so the commit value is empty string), the route does NOT save and does NOT navigate
**And** other fields (Key, Patch, Chord chart, Performance notes, Practice notes) are DISABLED until a Title has been committed (set the `<InlineEditField>` `disabled` prop OR conditionally render them). After Title commits, the route is now on `/songs/:newSongId` and the per-field saves work normally

**Given** the user navigates to `/songs/:songId`
**When** the route loads
**Then** it calls `useSong(songId)` (AC-2) and consumes `{ data, isLoading, error }`
**And** while `data === undefined` AND `isLoading === true` the route renders a minimal sr-only loading announcement (parallel to the Library route's pattern — `<p className="sr-only">Loading song.</p>`); no visible flash for sighted users
**And** when `data === null` (the song does not exist — 404 path), the route renders the locked copy `Song not found.` (NEW entry in `microcopy.ts` — see AC-8) plus a `<Link to="/library">` reading `Back to library` (NEW entry in `microcopy.ts`). No `404` HTTP code surfacing — Sandy sees the human copy
**And** when `data` is a `Song`, the route renders:
  - The Title field: `<InlineEditField multiline={false} value={data.title} ariaLabel="Title" autoFocus={false} />` in the **editorial serif face at `perf-title` size** (the visible label for sighted users is omitted because the field IS the title — placement at the top of the surface is the affordance). On commit (debounced 200ms blur), build a record `{ ...data, title: <next>, clientWrittenAt: new Date().toISOString() }` and invoke `saveSong(record)`
  - The Key field: `<InlineEditField multiline={false} value={data.key ?? ''} ariaLabel="Key" />` in the **mono-slab face at `perf-meta` size** (or whichever size the design rendered for key/patch — the mono treatment is the contract; pick a tier that visually pairs with title). Field's visible above-input label `Key` is rendered separately as a small `text-secondary` label per UX-DR4's "Inline edit field" semantics (the label sits above the field; the field's `aria-label` matches)
  - The Patch field: same as Key but `ariaLabel="Patch"`; label `Patch`; in mono-slab
  - The Chord chart field: `<InlineEditField multiline={true} value={data.chordChart ?? ''} ariaLabel="Chord chart" />` in the **mono-slab face at `perf-body` or `perf-chord` size** (the editing pane uses a smaller, comfortable monospace; the chord-chart RENDER preview lives below — see next bullet). Above the field, a visible label `Chord chart`. **Below** the field, render the `<ChordChart text={data.chordChart ?? ''} urlsTappable={atmosphere === 'practice'} />` (AC-6) as a live preview — so Sandy sees what the parsing produces. Show the preview only when `data.chordChart` is non-empty
  - The Performance notes field: `<InlineEditField multiline={true} value={data.performanceNotes ?? ''} ariaLabel="Performance notes" />` with visible label `Performance notes`; editorial serif body
  - The Practice notes field: `<InlineEditField multiline={true} value={data.practiceNotes ?? ''} ariaLabel="Practice notes" />` with visible label `Practice notes`; editorial serif body
**And** the surface renders ALL SIX fields on both MacBook (Practice atmosphere) and iPhone (Performance atmosphere) — per AC: "Practice notes and Performance notes are BOTH visible (this is the editing surface, not the Performance Card)"
**And** the surface does NOT render a per-gig annotation field — those live on Setlist Overview / Performance Card (Stories 3.3 / 4.x); Song Detail edits the canonical Song record only
**And** the surface does NOT render a "Save" button, a "Saved at" timestamp, a "Discard changes" button, or any state indicator — per FR-2 saves are silent

**Given** any field commit (debounced 200ms blur) on `/songs/:songId`
**When** `saveSong(record)` is invoked
**Then** the record's `clientWrittenAt` is `new Date().toISOString()` (generated at commit time, NOT at field-focus time)
**And** the displayed value stays optimistic (per FR-30) regardless of network state — the route reads `data` from `useSong(songId)` which the hook keeps fresh from the optimistic cache write done by `useSongMutation` (AC-4)
**And** no toast, no banner, no spinner appears — saves are silent (per FR-2)

**Given** the outbox returns `dropped-as-stale` for a Song write
**When** the response arrives
**Then** the flusher updates the per-song cache to `currentState` (per `web/src/sync/flusher.ts:160-164`) and sets the global stale notice (per `web/src/sync/stale-notice-store.ts`) — both already wired in Story 2.4
**And** on MacBook (Practice atmosphere, not Performance Mode), the `<StaleWriteBanner>` mounted in `<AuthenticatedShell>` renders the locked banner `Your earlier edit was superseded.` — no Story-2.6 banner work needed; it already works
**And** on iPhone outside Performance Mode, the same banner shows (per Story 2.4 / FR-30; the banner is suppressed only when `isIPhone() && performanceActive`)
**And** the displayed value in the route updates to `currentState` because the route re-reads `useSong(songId)` whose cache the flusher just replaced

**Given** the user types in a field, then blurs, then types again before the 200ms debounce fires
**When** the second blur happens within the window
**Then** the debouncer collapses both blurs into a single `saveSong` call with the latest value
**And** the outbox's coalesce rule (Story 2.4 AC-4) additionally guarantees the in-flight + pending invariant — at most one queued PUT per `recordKey` after coalesce

**AC-8 — Locked microcopy: `Song not found.`, `Back to library`, and labels for each field**

**Given** `web/src/lib/microcopy.ts` (UPDATE)
**When** reviewed
**Then** the file APPENDS to the existing `EMPTY_STATES`:
```ts
export const EMPTY_STATES = {
  noUpcomingGigs: 'No upcoming gigs.',
  noSongsInLibrary: 'No songs in this library yet.',
  songNotFound: 'Song not found.',
} as const;
```
**And** APPENDS to the existing `ACTIONS`:
```ts
export const ACTIONS = {
  newSong: '+ New song',
  backToLibrary: 'Back to library',
} as const;
```
**And** NEW top-level constant for field labels (since LABELS is a new locked surface, distinct from EMPTY_STATES / BANNERS / ACTIONS):
```ts
export const FIELD_LABELS = {
  title: 'Title',
  key: 'Key',
  patch: 'Patch',
  chordChart: 'Chord chart',
  performanceNotes: 'Performance notes',
  practiceNotes: 'Practice notes',
} as const;
```
**And** the file header comment is UPDATED to list `FIELD_LABELS` as the fourth locked surface (alongside `EMPTY_STATES`, `BANNERS`, `ACTIONS`)
**And** all five strings follow UX-DR7 voice & tone: short, no exclamation, no emoji, no encouragement (verified by inspection — all pass)
**And** all six field labels are consumed by `song-detail.tsx` as visible above-field labels (per AC-7); the `<InlineEditField>` `aria-label` prop ALSO uses these constants — visible and accessible names match (per UX-DR6)
**And** the existing `BANNERS` constant is unchanged

**AC-9 — Route registration in `web/src/router.tsx`: `/songs/new` and `/songs/:songId` siblings of `/library`**

**Given** `web/src/router.tsx` (UPDATE)
**When** reviewed
**Then** the existing `children` array under the authenticated `/` route gains two new entries:
```ts
{ path: 'songs/new', element: <SongDetail /> },
{ path: 'songs/:songId', element: <SongDetail /> },
```
mounted **inside** `<AuthenticatedShell />` so the route inherits the chrome (TopNav on MacBook / BottomTabs on iPhone) and the auth gate via `<RequireAuth>` (no separate redirect logic needed)
**And** the order is: `songs/new` BEFORE `songs/:songId` — React Router 7 prefers static paths over dynamic params, but listing the static path first preserves the contract under any future re-ordering
**And** `SongDetail` is imported from `./routes/song-detail.js`
**And** existing routes (`/`, `/library`, `/login`, `/install-instructions`) are unchanged
**And** the route does NOT add a separate `/library/songs/:songId` namespace — Song Detail is reachable from the Library list AND (in Epic 3) from Setlist Overview rows; the URL is `/songs/:songId` from any source per EXPERIENCE.md routing rules ("Tap a song row from any source always lands on song detail.")

**AC-10 — Song Detail tests cover the user-visible flow end-to-end (load, edit, create, 404, stale)**

**Given** `web/src/routes/song-detail.test.tsx` (NEW)
**When** the test suite is exercised
**Then** it proves the user-visible behaviors:
  - **Loads an existing song:** mock `useSong` to return `{ data: <song>, isLoading: false }`; render `<SongDetail />` inside `<MemoryRouter initialEntries={['/songs/abc']}>` with a `<Routes><Route path="/songs/:songId" element={<SongDetail />} /></Routes>` wrapping; assert all FR-5 fields render with the song's values; assert the Chord chart preview renders when `chordChart` is set
  - **Edits a single field:** mock `useSong` + spy on `saveSong` (via `vi.mock` of `../hooks/use-song-mutation.js`); type into the Title field; blur; advance timers 200ms; assert `saveSong` was called exactly once with `{ ...song, title: 'new title', clientWrittenAt: <ISO> }`. Use `vi.useFakeTimers()` for the debounce window
  - **Rapid edits coalesce to one save:** type, blur, type again, blur again all within 200ms; advance timers; assert `saveSong` was called exactly once with the LATEST value
  - **404 path:** mock `useSong` to return `{ data: null, isLoading: false }`; assert `EMPTY_STATES.songNotFound` renders; assert the `Back to library` link points to `/library`
  - **`/songs/new` create flow:** render `<SongDetail />` at `/songs/new`; assert the Title field has `autoFocus`; assert the other fields are DISABLED (or not rendered — pick one and assert); type a title; blur; advance timers 200ms; assert `saveSong` was called with `{ bandId: ACTIVE_BAND_ID, songId: <generated>, title: <typed>, clientWrittenAt: <ISO>, version: 1 }` (assert songId is a 16-char URL-safe string via `.toMatch(/^[A-Za-z0-9_-]{16}$/)`); assert `useNavigate`'s mock was called with `(\`/songs/\${songId}\`, { replace: true })` — install a `useNavigate` mock via `vi.mock('react-router', ...)` that exposes the call args
  - **Empty title on /songs/new does NOT create:** focus the Title field, blur without typing; advance timers 200ms; assert `saveSong` was NOT called; assert `useNavigate`'s mock was NOT called
  - **Loading state:** mock `useSong` to return `{ data: undefined, isLoading: true }`; assert the sr-only `Loading song.` message renders; assert no field renders
**And** tests use `userEvent` from `@testing-library/user-event` for focus / type / blur (the events propagate through the InlineEditField correctly only with userEvent, NOT `fireEvent`)
**And** the test file follows the hoisted-mock pattern from `web/src/routes/library.test.tsx`:
```ts
const { useSongMock, saveSongMock, navigateMock } = vi.hoisted(() => ({
  useSongMock: vi.fn(),
  saveSongMock: vi.fn().mockResolvedValue(undefined),
  navigateMock: vi.fn(),
}));
vi.mock('../hooks/use-song.js', () => ({ useSong: useSongMock }));
vi.mock('../hooks/use-song-mutation.js', () => ({ useSongMutation: () => ({ saveSong: saveSongMock }) }));
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});
```
**And** the test does NOT exercise the outbox / flusher / SyncProvider — those are covered by the existing suites in `web/src/sync/*.test.ts`. The Song Detail route's tests prove the route ↔ field ↔ mutation hook contract; the hook's internal contract is proven by `use-song-mutation.test.tsx` (AC-4)

**AC-11 — `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build:web` all green; no incidental version bumps; no new deps required**

**Given** the implementation complete
**When** the verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages — the new files (`song-detail.tsx`, `inline-edit-field.tsx`, `chord-chart.tsx`, `use-song.ts`, `use-song-mutation.ts`, `song-id.ts`, updated `songs.ts` / `microcopy.ts` / `router.tsx` / `outbox.ts`) compile under `strict: true` + `noUncheckedIndexedAccess: true` + `exactOptionalPropertyTypes: true`
**And** `pnpm lint` is green via Biome — kebab-case filenames; camelCase identifiers; React Router 7 imports from `react-router` not `react-router-dom`; no `// biome-ignore` directives beyond patterns already in the repo
**And** `pnpm test` is green — the new test cases pass; no regressions in the existing 161 web tests / 73 api tests baseline (Story 2.5's exit count)
**And** `pnpm build:web` is green; bundle size growth is bounded by new app code only (estimated +3–5 KB raw — no new dependencies)
**And** `web/package.json`, `api/package.json`, `shared/package.json`, `infra/package.json`, `e2e/package.json` are unchanged. **`nanoid` is already a dependency** (Story 2.4); the song-id module uses the existing import
**And** `pnpm-lock.yaml` is unchanged (no new packages)

**AC-12 — Sandy's on-device proof: create a song, edit it, see the list update, render a chord chart**

**Given** the implementation deployed to `https://gig.cormie.com`
**When** Sandy verifies on MacBook Safari (Practice atmosphere) and iPhone PWA (Performance atmosphere)
**Then** the following human-driven path is exercised end-to-end (unchecked checkbox per Epic 1 retro Lesson #1):
  - **MacBook create flow:** open `/library`; tap `+ New song`; URL is `/songs/new`; Title field is focused; type `Black Orpheus`; click outside the field; URL changes to `/songs/<generated-id>`; the Library list (open it in another tab or navigate back) now shows `Black Orpheus` in alphabetical order
  - **MacBook edit flow:** open the new song; click into Key; type `Dm`; click outside; reload the page; Key still says `Dm` (the write persisted via the outbox → server → cache reload)
  - **MacBook chord chart:** paste this into the Chord chart field:
    ```
    {Verse}
    Dm     A7     Dm
    Dm     A7     Dm

    {Chorus}
    F      C/E    Dm
    https://www.youtube.com/watch?v=2QbITp7TVgU
    ```
    blur; below the field, the rendered chord chart shows `Verse` and `Chorus` as visual section breaks, the chord lines as mono text, the blank line as a vertical gap, and the URL as a tappable link (clicking opens YouTube in a new tab — `target="_blank"`)
  - **iPhone PWA chord chart:** open the same Song; the same chord chart renders with `Verse` / `Chorus` section breaks AND the URL as INERT TEXT (no underline, no color shift, no anchor — tapping does nothing). This proves the atmosphere-based `urlsTappable` toggle is wired correctly
  - **Stale-write proof:** on MacBook, edit Performance notes; in DevTools → Network throttle to "Offline"; edit the same field again with a different value; un-throttle to "Online"; the outbox flushes; expect: no banner (the second edit is newer than what the server has, so it's `applied`, not `dropped-as-stale`). To force `dropped-as-stale`, hand-edit DDB to set a `clientWrittenAt` newer than your test edit, then edit on the client. The banner `Your earlier edit was superseded.` appears at the top of the page; the field's value updates to the server's `currentState`
  - **Empty-title guard:** on `/songs/new`, click Title without typing, then click elsewhere; URL stays at `/songs/new`; no Song appears in Library; no network call fires (verify via Network tab — no `PUT /api/v1/songs/...` request)

## Tasks / Subtasks

- [x] **Task 1 — `web/src/lib/song-id.ts` + alphabet extraction** (AC: 3)
  - [x] Create `web/src/lib/song-id.ts` exporting `URL_SAFE_ALPHABET` constant and `generateSongId()` function
  - [x] Update `web/src/sync/outbox.ts` to import `URL_SAFE_ALPHABET` from `../lib/song-id.js` (instead of declaring the constant locally) — one source of truth
  - [x] Confirm `web/src/sync/outbox.test.ts` still passes (the import path change should be transparent to the tests)
  - [x] Create `web/src/lib/song-id.test.ts` covering AC-3's three assertions (length, alphabet, uniqueness)

- [x] **Task 2 — Extend `web/src/api/songs.ts` with `getSong()` and `putSong()`** (AC: 1)
  - [x] Update `web/src/api/songs.ts` to add `getSong(songId)` and `putSong(input)`. Reference shape:
    ```ts
    import {
      AppliedResponseSchema,
      DroppedAsStaleResponseSchema,
      ErrorResponseSchema,
      OkResponseSchema,
      type Song,
      SongSchema,
      type SongPutInput,
    } from '@gigbuddy/shared';
    import { z } from 'zod';
    import { apiFetch } from './client.js';

    const GetSongResponseSchema = z.discriminatedUnion('status', [
      OkResponseSchema(SongSchema),
      ErrorResponseSchema,
    ]);

    const PutSongResponseSchema = z.discriminatedUnion('status', [
      AppliedResponseSchema(SongSchema),
      DroppedAsStaleResponseSchema(SongSchema),
      ErrorResponseSchema,
    ]);

    export async function getSong(songId: string): Promise<Song | null> {
      const response = await apiFetch(`/api/v1/songs/${songId}`, {
        method: 'GET',
        schema: GetSongResponseSchema,
      });
      if (response.data.status === 'ok') return response.data.data;
      if (response.data.status === 'error' && response.data.error.code === 'NOT_FOUND') return null;
      throw new Error(`getSong: unexpected envelope status ${response.data.status}`);
    }

    export async function putSong(
      input: SongPutInput,
    ): Promise<
      | { kind: 'applied'; data: Song }
      | { kind: 'dropped-as-stale'; currentState: Song }
    > {
      const response = await apiFetch(`/api/v1/songs/${input.songId}`, {
        method: 'PUT',
        body: input,
        schema: PutSongResponseSchema,
      });
      if (response.data.status === 'applied') return { kind: 'applied', data: response.data.data };
      if (response.data.status === 'dropped-as-stale') {
        return { kind: 'dropped-as-stale', currentState: response.data.currentState };
      }
      throw new Error(`putSong: error envelope ${response.data.error.code}`);
    }
    ```
  - [x] Update the file's leading comment so future agents see "this is the read+write surface, not just list"
  - [x] Update `web/src/api/songs.test.ts` to add the new cases per AC-1 (4 for getSong, 3 for putSong)

- [x] **Task 3 — `web/src/hooks/use-song.ts` TanStack Query per-song hook** (AC: 2)
  - [x] Create `web/src/hooks/use-song.ts`:
    ```ts
    import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
    import { type UseQueryResult, useQuery } from '@tanstack/react-query';
    import { getSong } from '../api/songs.js';

    export function useSong(songId: string | null): UseQueryResult<Song | null, Error> {
      return useQuery({
        queryKey: ['song', ACTIVE_BAND_ID, songId],
        queryFn: () => getSong(songId as string),
        enabled: songId !== null,
      });
    }
    ```
  - [x] Create `web/src/hooks/use-song.test.tsx` covering AC-2 (resolves to Song; queryKey shape; 404 → `null`; `enabled: false` on `songId === null`)
  - [x] Use a fresh QueryClient per test, `retry: false`. Wrap with `<QueryClientProvider client={qc}>` for `renderHook`

- [x] **Task 4 — `web/src/hooks/use-song-mutation.ts` outbox-wired mutation hook + `mergeSongIntoList`** (AC: 4)
  - [x] Create `web/src/hooks/use-song-mutation.ts`:
    ```ts
    import type { Song, SongPutInput } from '@gigbuddy/shared';
    import { useCallback } from 'react';
    import { queryClient } from '../sync/query-client.js';
    import { flushOnce } from '../sync/flusher.js';
    import { enqueue } from '../sync/outbox.js';
    import { songRecordKey } from '../sync/record-key.js';

    export function mergeSongIntoList(current: Song[], next: Song): Song[] {
      const filtered = current.filter((s) => s.songId !== next.songId);
      const inserted = [...filtered, next];
      return inserted.sort((a, b) =>
        a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
      );
    }

    export function useSongMutation(): { saveSong: (record: SongPutInput) => Promise<void> } {
      const saveSong = useCallback(async (record: SongPutInput): Promise<void> => {
        const optimistic: Song = { ...record, serverReceivedAt: new Date().toISOString() };
        queryClient.setQueryData(['song', record.bandId, record.songId], optimistic);
        queryClient.setQueryData<Song[]>(['songs', record.bandId], (current) =>
          mergeSongIntoList(current ?? [], optimistic),
        );
        await enqueue({
          recordKey: songRecordKey(record.bandId, record.songId),
          payload: record,
          clientWrittenAt: record.clientWrittenAt,
        });
        void flushOnce();
      }, []);
      return { saveSong };
    }
    ```
  - [x] Create `web/src/hooks/use-song-mutation.test.tsx` covering AC-4's three cases (new song; edit; `mergeSongIntoList` cases). Mirror the `outbox.test.ts` setup pattern (`import 'fake-indexeddb/auto';` + `__resetOutboxForTests` in `beforeEach`). Stub `flushOnce` via `vi.mock('../sync/flusher.js', ...)`

- [x] **Task 5 — `web/src/components/inline-edit-field.tsx`** (AC: 5)
  - [x] Create the component per AC-5. Locally buffered editor; commits on blur if value changed; supports `multiline`; respects `aria-label`; satisfies `min-h-tap`
  - [x] Use Tailwind v4 utility tokens for visual treatment — `focus-visible:[box-shadow:_0_1px_0_0_var(--color-accent)]` or equivalent; do NOT inline hex
  - [x] Create `web/src/components/inline-edit-field.test.tsx` covering AC-5's eight cases. Use `@testing-library/user-event` for focus/type/blur

- [x] **Task 6 — `web/src/components/chord-chart.tsx`** (AC: 6)
  - [x] Create the component per AC-6. Section breaks for `{...}` lines; preserved blank lines; URL detection only when `urlsTappable === true`; honest-empty for empty input
  - [x] Use `text-transform: uppercase` (Tailwind `uppercase` utility) for section-break headings — the underlying text is unchanged; CSS applies the visual transform
  - [x] Create `web/src/components/chord-chart.test.tsx` covering AC-6's six cases

- [x] **Task 7 — `web/src/routes/song-detail.tsx` (the route) + microcopy update** (AC: 7, 8)
  - [x] Update `web/src/lib/microcopy.ts` per AC-8 (`EMPTY_STATES.songNotFound`, `ACTIONS.backToLibrary`, `FIELD_LABELS` constant, header comment)
  - [x] Create `web/src/routes/song-detail.tsx`. The route uses `useParams()` from `react-router` to read `songId`; when `songId === undefined` (route is `/songs/new`), the route generates a draft id via `generateSongId()` and treats the route as create-mode
  - [x] Implement the debounce primitive: a `useDebouncedCommit({ delay: 200 })` hook that returns `(record: SongPutInput) => void`. Each call resets a `setTimeout`; on fire, invokes `saveSong(record)`. On unmount, clear the pending timer. Implementation:
    ```ts
    function useDebouncedCommit(
      saveSong: (r: SongPutInput) => Promise<void>,
      delay = 200,
    ): (record: SongPutInput) => void {
      const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
      return useCallback((record) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void saveSong(record);
          timerRef.current = null;
        }, delay);
      }, [saveSong, delay]);
    }
    ```
  - [x] On `/songs/new`: generate `draftSongId` once via `useState(() => generateSongId())`. Render Title field auto-focused. When Title commits non-empty, build the record, debounce-save, then `navigate(\`/songs/\${draftSongId}\`, { replace: true })`. Other fields disabled until commit
  - [x] On `/songs/:songId`: render all six fields per AC-7. Each field's commit invokes the debounced save with the whole record (existing `data` from `useSong` + the changed field + fresh `clientWrittenAt`). The ChordChart preview renders below the Chord chart field
  - [x] Read atmosphere via `document.documentElement.dataset.atmosphere` inside `useMemo(() => ..., [])` — computed once at mount; atmosphere is fixed for the session per architecture
  - [x] 404 path: `data === null && !isLoading` → render `EMPTY_STATES.songNotFound` + `<Link to="/library">{ACTIONS.backToLibrary}</Link>`
  - [x] Loading path: `data === undefined && isLoading` → `<p className="sr-only">Loading song.</p>`

- [x] **Task 8 — Register the routes in `web/src/router.tsx`** (AC: 9)
  - [x] Import `SongDetail` from `./routes/song-detail.js`
  - [x] Add the two child entries under the authenticated root: `{ path: 'songs/new', element: <SongDetail /> }` and `{ path: 'songs/:songId', element: <SongDetail /> }`. Order: `songs/new` first, then `songs/:songId`
  - [x] Confirm `/library` Link → `/songs/<id>` still resolves now that the route exists (Story 2.5 emits the links; this task makes the destination real)

- [x] **Task 9 — `web/src/routes/song-detail.test.tsx`** (AC: 10)
  - [x] Implement the seven test cases from AC-10 using the hoisted-mock pattern. (Switched from fake timers + `advanceTimersByTime` to real timers + `waitFor` — fake timers deadlocked userEvent's internal awaits; the 200ms debounce window is short enough that real-timer waits keep the suite fast.)
  - [x] Wrap renders in `<MemoryRouter initialEntries={[...]}>`; use a `<Routes>` table internally because `<SongDetail>` reads `useParams()`

- [x] **Task 10 — Verification pass + manual smoke** (AC: 11, 12)
  - [x] `pnpm typecheck` green across all packages
  - [x] `pnpm lint` green via Biome (one `useExhaustiveDependencies` biome-ignore on InlineEditField's resize effect — `local` is a DOM-flow trigger Biome can't statically see)
  - [x] `pnpm test` green — actual delta: +45 tests (songs.test.ts +7, use-song.test.tsx +4, use-song-mutation.test.tsx +5, inline-edit-field.test.tsx +10, chord-chart.test.tsx +8, song-detail.test.tsx +8, song-id.test.ts +3, outbox.test.ts unchanged). Web suite: 161 → 206. API suite: 73 unchanged.
  - [x] `pnpm build:web` green; no new dependencies
  - [x] **Do NOT** add new dependencies — confirmed (`pnpm-lock.yaml` and all `package.json` files unchanged)
  - [x] **Do NOT** modify Workbox runtime caching — confirmed (vite.config.ts untouched)
  - [x] **Do NOT** modify the flusher — confirmed (`web/src/sync/flusher.ts` untouched)

- [ ] **Task 11 — Human-required manual smoke** (AC: 12)
  - [ ] (Sandy) After merge + deploy, exercise AC-12's six scenarios on MacBook Safari and on iPhone PWA. Verify the listed observable behavior for each. Per Epic 1 retro Lesson #1 — this is an explicit unchecked human task

### Review Findings

- [x] [Review][Patch] **`navigate` fires inside the 200ms debounce, not immediately on title commit** [`web/src/routes/song-detail.tsx:96-106`] — Fixed: moved `navigate(...)` out of `debouncedCreate` and into `handleTitleCommit` so it fires synchronously on blur. Only `saveSong` remains debounced.
- [x] [Review][Patch] **Optional fields committed as empty string instead of `undefined`** [`web/src/routes/song-detail.tsx:64-77`] — Fixed: `songToPutInput` now applies `|| undefined` to all optional string fields (`key`, `patch`, `chordChart`, `performanceNotes`, `practiceNotes`) so clearing a field sends `undefined` (omitted in JSON) not `''`.

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Deviations require updating that document, not the implementation.

Story 2.6 closes out Epic 2's user-visible scope. It lands:
- The **Song Detail surface** (FR-3): one route at `/songs/:songId` + `/songs/new`, view-and-edit on the same page.
- **Inline edit** (FR-2): the `InlineEditField` primitive used by all fields. Debounced silent save (NFR-4 — 200ms).
- **Chord chart V1 floor** (FR-5 / UX-DR5): the `ChordChart` component that parses `{...}` lines as section breaks, preserves blank lines, makes URLs tappable in Practice and inert in Performance.
- **Create-a-Song** (FR-1): `+ New song` (from Story 2.5) → `/songs/new` → Title-required create flow.
- **Whole-record write path** (AR-23 / FR-32): `useSongMutation` enqueues a whole-record PUT to the outbox; the existing flusher (Story 2.4) drains it.

**Hard rules from the architecture:**

- **AR-23 (architecture.md line 151):** whole-record PUT semantics. Every field commit on Song Detail sends the COMPLETE Song record (every field), not a partial. The mutation hook builds the record from the latest `data` + the changed field + a fresh `clientWrittenAt`. LWW comparison happens server-side on `clientWrittenAt`.
- **AR-26 (architecture.md line 156):** GET `/api/v1/songs/:songId` is NetworkFirst via the SW prefix rule. Offline reads fall back to the SW cache and then to the TanStack persister cache (Story 2.4). Story 2.6 does NOT touch the SW config.
- **AR-28 (architecture.md line 160):** Performance Mode rules. While `performanceActive === true`: no banners, no toasts, no auth redirects. Story 2.6 surfaces saves via the existing `StaleWriteBanner` which already honours AR-28. No new banner work.
- **AR-39 (architecture.md line 177):** errors during the save path propagate through the outbox's retry layer; persistent failure does NOT surface a banner in Story 2.6 (deferred polish per architecture.md line 292). The `dropped-as-stale` banner is the only LWW-related surface.
- **AR-45 (architecture.md line 185):** UI consumes hooks; never imports `sync/outbox.ts` directly. **The mutation hook is the legal seam.** `song-detail.tsx` imports `useSongMutation()` — it does NOT import `enqueue` or `flushOnce` directly.
- **AR-47 (architecture.md line 189):** NanoID 16-char URL-safe IDs. New songIds are generated at the route via `generateSongId()` (AC-3) — same alphabet as the outbox's entry IDs (the constant is now shared via `web/src/lib/song-id.ts`).
- **FR-2 (PRD §4.1):** silent debounced save. **NO save button, NO "saving…" indicator, NO success toast, NO checkmark.** Saves are invisible. The displayed value stays optimistic until acknowledged.
- **FR-5 (PRD §4.1):** Title is required. All other fields optional. Performance Mode (Story 4.x) displays Performance + Practice fields per the surface table; Song Detail is the EDIT surface and displays BOTH note fields always (FR-5 acceptance + AC-7 here).
- **UX-DR4 (epics.md line 202):** the `InlineEditField` is one of the 12 named components. No visible border in display state; accent underline on focus in Practice / accent glow in Performance. Story 2.6 lands the component.
- **UX-DR5 (epics.md line 204):** the `ChordChart` V1 floor. Monospaced text run; `{...}` lines as section breaks; blank lines preserved; URLs tappable in Practice only.
- **UX-DR6 (epics.md line 206):** accessibility primitives — `aria-label` matches visible label; tap-targets ≥ 44pt; focus order = DOM order; `prefers-reduced-motion` enforced globally (Story 1.2). The `InlineEditField` carries `aria-label`; the route renders visible labels above the fields.
- **UX-DR7 (epics.md line 208):** voice & tone — `Song not found.`, `Back to library`, and all field labels follow the locked-string contract via `microcopy.ts`. No exclamation, no emoji, no encouragement.
- **CLAUDE.md boundaries:**
  - `web` ↔ `api`: HTTP only via `/api/v1/*` — Story 2.6 adds `GET /api/v1/songs/:songId` and `PUT /api/v1/songs/:songId` to the client's outbound surface. Both endpoints already exist from Story 2.3. No new server work.
  - `web` ↔ `shared`: types + Zod schemas only. Story 2.6 imports `Song`, `SongSchema`, `SongPutInput`, `OkResponseSchema`, `AppliedResponseSchema`, `DroppedAsStaleResponseSchema`, `ErrorResponseSchema`, `ACTIVE_BAND_ID` from `@gigbuddy/shared`. No new shared exports.
  - React Router 7: import from `react-router`, NOT `react-router-dom`. Use `useParams`, `useNavigate`, `Link`, `MemoryRouter` (tests).

**Patterns to reuse:**

- **Hoisted vi.mock factory** (`web/src/components/reauth-banner.test.tsx`, `web/src/routes/library.test.tsx`): use `vi.hoisted` + `vi.mock` for the route tests so `useSong`, `useSongMutation`, and `useNavigate` are mockable per-case.
- **Fresh QueryClient per test** (`web/src/sync/flusher.test.ts`, `web/src/hooks/use-songs.test.tsx`): construct a `new QueryClient({ defaultOptions: { queries: { retry: false } } })` per hook-test case; do NOT reuse the singleton from `sync/query-client.tsx` (it has the IDB persister attached and pollutes unrelated tests).
- **Outbox + flusher singleton imports** (`web/src/sync/flusher.ts:64-68`): the mutation hook holds NO module-scope state of its own; it imports `queryClient` from `sync/query-client.js` for the optimistic writes. This mirrors the flusher's `queryClientRef` pattern (the flusher sets it from outside; the hook reads it directly because it imports the module that owns it).
- **`apiFetch` envelope schemas composed at the call site** (`web/src/api/songs.ts:16-22`, `web/src/sync/flusher.ts:57-61`): Story 2.6 follows — `GetSongResponseSchema` and `PutSongResponseSchema` are composed inside `web/src/api/songs.ts`. No new shared exports.
- **`<Link>` for navigation** (architecture.md line 1031): URL is the truth. The 404 fallback's `Back to library` is a `<Link>` not an imperative `useNavigate()` call.
- **`min-h-tap` tokens** (architecture.md line 830): every tappable element. The `InlineEditField` carries `min-h-tap` on its editor element.

### Library and framework requirements (do NOT substitute)

- **`react` (^19.0.0)** — already installed. `useState`, `useRef`, `useEffect`, `useCallback`, `useMemo`, `useLayoutEffect`. No new APIs needed.
- **`react-router` (^7.0.0)** — already installed. `useParams`, `useNavigate`, `Link`, `MemoryRouter`, `Routes`, `Route`. Do NOT import from `react-router-dom`.
- **`@tanstack/react-query` (^5.59.0 resolved 5.101.0)** — already installed. `useQuery`, `UseQueryResult`. The hook contract returns `UseQueryResult<Song | null, Error>`.
- **`nanoid` (^5.1.11)** — already installed (Story 2.4). `customAlphabet` is the canonical entry point; same alphabet as the outbox via the new shared `URL_SAFE_ALPHABET` constant.
- **`zod` (^3.23.0)** — already installed. `z.discriminatedUnion('status', [...])` for the response envelopes; `z.infer<typeof Schema>` for types.
- **`@gigbuddy/shared`** — already wired. `Song`, `SongSchema`, `SongPutInput`, `ACTIVE_BAND_ID`, `OkResponseSchema`, `AppliedResponseSchema`, `DroppedAsStaleResponseSchema`, `ErrorResponseSchema`.
- **`@testing-library/react` (^16.1.0)** — already installed. `render`, `renderHook`, `screen`, `waitFor`, `act`. The `renderHook` API requires a wrapper for hooks that need a Provider (the QueryClient wrapper in `use-song.test.tsx` and `use-song-mutation.test.tsx`).
- **`@testing-library/user-event` (^14.5.0)** — already installed. **REQUIRED for `inline-edit-field.test.tsx` and `song-detail.test.tsx`** — `fireEvent` does not propagate focus / blur events through React's synthetic event system reliably enough for the InlineEditField's commit-on-blur contract. Use `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` to make userEvent advance fake timers.
- **`fake-indexeddb` (^6.2.5 devDep)** — already installed. Required for `use-song-mutation.test.tsx`. Mirror `outbox.test.ts`'s `import 'fake-indexeddb/auto';` pattern.
- **NO new dependencies.** If you reach for one, the task is already solved by the above. Specifically: no debounce library (the 9-line `useDebouncedCommit` is sufficient), no URL-parsing library (a simple regex is the V1 floor per UX-DR5), no auto-resize-textarea library (a `useLayoutEffect` + `scrollHeight` is sufficient).
- **NO new shared exports.** All schemas are already in `@gigbuddy/shared`. Envelopes compose at the call site per Story 2.4 / 2.5 precedent.

### What this story does NOT include (anti-scope-creep)

These appear nearby in the architecture/epics but are owned by other stories. **Do not scaffold:**

- **Setlist Overview surface** (FR-13, Story 3.3): the per-Setlist prep view. Out of scope.
- **Per-gig annotation field on Song Detail** (FR-11, Story 3.3 + 4.x): annotations are attached to (Setlist, Song) pairs, NEVER to the Song record. Song Detail edits the canonical Song only.
- **Performance Card surface** (FR-15–FR-22, Stories 4.x): the iPhone-only single-song view with the three-region layout. Story 2.6's ChordChart is reused there but the layout is owned by Epic 4.
- **Performance Mode entry** (FR-15, Story 4.1): the `Start performance ›` CTA. Out of scope.
- **Aspirational chord-glyph card grid** (UX-DR5 aspiration): explicitly out of V1 floor. The component renders monospaced text only.
- **Search / filter on Song Detail** (V2): no search affordance.
- **Delete a Song** (V2): no delete affordance. The architecture documents only PUT in V1 (`OutboxEntry.op: 'PUT'`).
- **Versioned history of a Song's edits** (V2): no diff view, no "undo". The architecture's record shape carries `version: 1` but does not track history.
- **Image / file attachments on a Song** (V2): no upload affordance.
- **Multi-band switcher in the Library or Song Detail header** (V2): `ACTIVE_BAND_ID` is fixed for V1; the Band label is passive (FR-26).
- **Persistent-failure banner on save** (architecture.md line 292): deferred polish. Story 2.4's `StaleWriteBanner` is the ONLY banner Story 2.6 surfaces; persistent 5xx failures stay in the outbox and retry per its own backoff.
- **Optimistic conflict-resolution UI** (FR-32 explicitly forbids): no "your changes will overwrite the server" prompt; LWW handles it silently.
- **`maxAge: Infinity` on `PersistQueryClientProvider` `persistOptions`** (deferred-work.md line 89): the 24h persister default still applies. Sandy's iPhone PWA users (Sandy himself) will see an empty cache after 24h of no opens; the next open re-fetches. This is acknowledged tech debt; Story 2.6 does NOT fix it (a one-line follow-up in a polish pass).
- **List-fetch persistent-failure banner**: deferred polish.
- **Skeleton loaders / shimmer placeholders**: V1 floor is the sr-only loading text.
- **Mobile-specific tap-and-hold to enter edit mode**: there is NO edit mode (per FR-2 / UX-DR4). Tap-to-focus is the only interaction.
- **Animations on field focus**: a static accent underline is the V1 treatment. No transition longer than 150ms anywhere on the surface.

If you find yourself wanting to scaffold any of the above, **don't**.

### Existing files this story modifies — current state and what changes

#### `web/src/api/songs.ts` (Task 2)

**Current state (Story 2.5 baseline, commit `7c7cb5b`):** Exports `listSongs(): Promise<Song[]>` only. Reads `GET /api/v1/songs` and unwraps the `ok` envelope. The file's leading comment notes "Story 2.6 will add `getSong(songId)` here."

**This story changes:** Adds `getSong(songId)` and `putSong(input)` per AC-1. Adds two new local schema constants (`GetSongResponseSchema`, `PutSongResponseSchema`) composed at the call site. Updates the leading comment to reflect the file's expanded surface.

**Must preserve:** `listSongs()` as-is. The `import` block (only widen the import; don't drop anything).

#### `web/src/api/songs.test.ts` (Task 2)

**Current state:** Three test cases covering `listSongs`'s contract.

**This story changes:** Adds ~7 cases (4 for `getSong`, 3 for `putSong`). Reuses the `fetchMock` + `jsonRes` helpers already in the file.

**Must preserve:** The existing 3 `listSongs` cases verbatim. The `beforeEach` / `afterEach` setup.

#### `web/src/sync/outbox.ts` (Task 1)

**Current state:** Exports `enqueue`, `peek`, `markInFlight`, `markPending`, `remove`, `listAll`, plus the `OutboxEntry` type. Declares a module-local `URL_SAFE_ALPHABET` constant at line 21. Uses `customAlphabet(URL_SAFE_ALPHABET, 16)` to generate entry IDs.

**This story changes:** REMOVE the local `URL_SAFE_ALPHABET` declaration and `import { URL_SAFE_ALPHABET } from '../lib/song-id.js';` instead. Everything else stays identical. The `newId` function still uses `customAlphabet(URL_SAFE_ALPHABET, 16)` — only the source of the constant moves.

**Must preserve:** The `OutboxEntry` type shape (architecture-locked). The coalesce semantics. All exported function signatures. The `__resetOutboxForTests` test-only helper.

#### `web/src/lib/microcopy.ts` (Task 7)

**Current state (Story 2.5 baseline):** Exports `EMPTY_STATES`, `BANNERS`, `ACTIONS` as `as const` objects. Header comment lists three locked surfaces.

**This story changes:** Appends `EMPTY_STATES.songNotFound: 'Song not found.'`. Appends `ACTIONS.backToLibrary: 'Back to library'`. Adds NEW `FIELD_LABELS` top-level constant. Updates the header comment to list FIELD_LABELS as the fourth locked surface. **All existing constants and string values are preserved verbatim.**

**Must preserve:** Every existing key + value. The header comment's voice-and-tone rules.

#### `web/src/router.tsx` (Task 8)

**Current state:** Registers `/login`, `/` (with `<RequireAuth>` + `<AuthenticatedShell>`), `/` → `<Home>`, `/library` → `<Library>`.

**This story changes:** Adds two new children under the authenticated root: `{ path: 'songs/new', element: <SongDetail /> }` and `{ path: 'songs/:songId', element: <SongDetail /> }`. Adds the `<SongDetail>` import.

**Must preserve:** `<RequireAuth>` semantics. The existing routes and their components. The `<AuthenticatedShell>` wrapping pattern.

### Existing files this story DOES NOT touch (regression safety)

- `web/src/sync/flusher.ts` — the flusher's per-record invalidation pattern (line 157) is correct as-is. The mutation hook's optimistic write to the list cache handles the list-refresh contract without a flusher change. Touching the flusher would couple Story 2.6 to the sync layer's internal contract; the hook is the legal seam (AR-45).
- `web/src/sync/query-client.tsx` — singleton remains as-is. The mutation hook imports it directly.
- `web/src/sync/persist.ts`, `web/src/sync/sync-wiring.tsx`, `web/src/sync/stale-notice-store.ts`, `web/src/sync/stale-write-banner.tsx` — all Story 2.4 work. The stale-write surface already does what AC-7's stale path requires. No changes.
- `web/src/sync/record-key.ts` — `songRecordKey()` is already exported and consumed by the mutation hook.
- `web/src/routes/library.tsx` — Story 2.5 emits the `<Link to="/songs/${songId}">` and `<Link to="/songs/new">` already. Both destinations come alive once Story 2.6's routes are registered (Task 8). The Library route does NOT change.
- `web/src/routes/library.test.tsx` — the tests assert links exist with the right hrefs; that contract holds. No changes.
- `web/src/hooks/use-songs.ts` — the list hook is read-only. Story 2.6's mutation hook touches the same cache key (`['songs', bandId]`) via `setQueryData`; the read hook re-renders naturally on cache change. No hook changes.
- `web/src/components/library-song-row.tsx` — title-only row. The Song's title may change via Song Detail edits; the optimistic-write path updates the list cache including the renamed title; the row re-renders. No row changes.
- `web/src/components/bottom-tabs.tsx`, `web/src/components/top-nav.tsx`, `web/src/routes/authenticated-shell.tsx` — chrome is unchanged. The Song Detail route inherits TopNav (MacBook) and BottomTabs (iPhone) via the shell.
- `web/src/api/client.ts` — the fetch wrapper is unchanged. Story 2.6 uses it for both `getSong` and `putSong`.
- `api/**` — Story 2.3 already shipped both `GET /api/v1/songs/:songId` and `PUT /api/v1/songs/:songId` with the canonical envelope shapes (`OkResponseSchema` / `AppliedResponseSchema` / `DroppedAsStaleResponseSchema` / `ErrorResponseSchema`). Story 2.6 is web-only.
- `shared/**` — schemas already in place. No new exports.
- `infra/**`, `e2e/**` — no changes. E2E coverage of the create + edit + chord chart flows is deferred to a later pass.
- `web/vite.config.ts` — no SW changes. `GET /api/v1/songs/*` already NetworkFirst (Story 2.1).
- `web/src/main.tsx`, `web/src/app-bootstrap.tsx` — boot sequence is unchanged.
- `web/src/styles/*` — no token additions. The Song Detail route uses existing tokens.
- `web/src/performance/*`, `web/src/lib/error-reporter.ts`, `web/src/lib/atmosphere.ts`, `web/src/lib/platform.ts`, `web/src/lib/band.ts` — all unchanged.
- `web/src/auth/*` — unchanged. The Song Detail route is protected by `<RequireAuth>` via the shell.

### Previous story intelligence (relevant per-story learnings)

From the **Epic 1 retrospective** (`_bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md`):

- **Lesson #1 — Human-required steps must be explicit unchecked task checkboxes.** Task 11 captures Sandy's on-device proof. Unchecked until verified post-deploy.
- **Lesson #3 — New files / directories add to Biome + tsconfig in the same commit.** Story 2.6 adds files in `web/src/{hooks,components,routes,lib}/` — all directories already exist and are covered by `web/src/**` Biome globs and `web/tsconfig.json` `include` paths. **No tsconfig / Biome changes required.**
- **Lesson #4 — End-to-end behavioral paths need integration test coverage.** Story 2.6's `song-detail.test.tsx` covers the route-level behavioral path (create / edit / 404 / stale). The mutation hook's outbox + cache contract is covered in `use-song-mutation.test.tsx`.

From **Story 2.5** (commit `7c7cb5b`, status `done`):

- **Library tap → `/songs/:songId` is wired** via `<LibrarySongRow>`. Story 2.6 lands the destination. The Library list re-renders when its cache changes (proven by Story 2.5's AC-8 cache-invalidation test) — Story 2.6's optimistic `setQueryData(['songs', bandId], ...)` triggers exactly that path.
- **`+ New song` link emits `<Link to="/songs/new">`** from the Library page chrome. Story 2.6 registers `/songs/new` and lands the create flow.
- **`web/src/api/songs.ts` already exists** with `listSongs()`. Story 2.6 extends it — does NOT rewrite.
- **Hoisted `useSongsMock` pattern** lives in `library.test.tsx`. Mirror it in `song-detail.test.tsx` for `useSong`, `useSongMutation`, `useNavigate`.

From **Story 2.4** (commit `29be85b`, status `done`):

- **QueryClient is a singleton in `web/src/sync/query-client.tsx`** with IDB persister attached. The mutation hook imports it directly — do NOT use `useQueryClient()` from `@tanstack/react-query`, which resolves via React context and complicates non-React consumers.
- **Outbox `enqueue`, `peek`, `markInFlight`, `markPending`, `remove`, `listAll`** are the canonical API. The mutation hook uses `enqueue` only. The flusher (Story 2.4) drains.
- **`flushOnce()`** is the cycle primitive. The mutation hook fires it AFTER the enqueue so the flusher runs immediately on a tab that's foreground + online — the user sees nothing, but the network round-trip happens.
- **Stale-write banner subsystem** is mounted globally. The flusher writes `setStaleNotice(...)` on `dropped-as-stale`; the banner renders. Story 2.6 does NOT add its own banner.
- **`URL_SAFE_ALPHABET` constant** lives at `outbox.ts:21`. Story 2.6 extracts it into `web/src/lib/song-id.ts` so the song-id generator and the outbox share one source of truth.
- **`fake-indexeddb/auto`** import is required at the top of any test file that touches the outbox. Mirror in `use-song-mutation.test.tsx`.

From **Story 2.3** (commit `b06aea0`, status `done`):

- **`GET /api/v1/songs/:songId`** returns `{ status: 'ok', data: Song }` on success, or `{ status: 'error', error: { code: 'NOT_FOUND', message: ... } }` with HTTP 404 when the song doesn't exist. Story 2.6's `getSong()` handles both branches.
- **`PUT /api/v1/songs/:songId`** returns `{ status: 'applied', data: Song }` on success, `{ status: 'dropped-as-stale', currentState: Song }` on LWW-stale, or `{ status: 'error', ... }` with HTTP 400 on validation. Story 2.6's `putSong()` handles all three branches.
- **`SongPutInputSchema`** in `shared/src/schemas/song.ts` is `SongSchema.omit({ serverReceivedAt: true }).strict()`. The mutation hook builds its payload to match this shape exactly.
- **`x-server-now` header** on every response (Story 2.4 fetch wrapper handles it). Story 2.6 doesn't touch the wrapper.
- **`SongSchema.title` allows empty string** (deferred validation per Story 2.3 review notes). Story 2.6 enforces non-empty Title at the FORM layer (AC-7 — empty Title on `/songs/new` does NOT create). The server still accepts empty Title; the client just doesn't send it.

From **Story 1.5** (commit `2a7d4ae`, status `done`):

- **`<AuthenticatedShell>`** wraps every authenticated route, including `/songs/*`. Sandy stays inside the shell — TopNav (MacBook) / BottomTabs (iPhone) chrome is always visible (outside Performance Mode). Story 2.6 does NOT modify the shell.
- **`<RequireAuth>`** redirects unauthenticated visitors to `/login`. The Song Detail route inherits this protection automatically.

From **Story 1.2** (`_bmad-output/implementation-artifacts/1-2-design-system-foundation-tokens-typography-atmospheres.md`):

- **Type scale** is in `tokens.css`. Story 2.6 uses: `--text-perf-title` (Title field on Song Detail), `--text-perf-meta` (Key, Patch), `--text-perf-chord` (ChordChart render), `--text-perf-body` (Performance/Practice notes), `--text-practice-body` (MacBook body text).
- **Font families** are `--font-serif-editorial` (Title, notes) and `--font-mono-slab` (Key, Patch, ChordChart, chord-chart edit field).
- **`--spacing-tap`** is `44px`. Tailwind generates `min-h-tap`, `min-w-tap`. Use on every tappable element including each `<InlineEditField>`.
- **`prefers-reduced-motion`** is enforced globally (Story 1.2). Any focus-state animation is automatically zeroed.

### Implementation patterns reused from architecture

- **TanStack Query for server data** (architecture.md line 720): `useSong(songId)` follows the same pattern as `useSongs()` — `useQuery` keyed on a stable cache namespace.
- **Optimistic writes via the mutation hook** (architecture.md lines 590–623 + AR-45): `useSongMutation` does optimistic `setQueryData` for BOTH `['song', bandId, songId]` and `['songs', bandId]`, then enqueues the outbox PUT. The flusher (Story 2.4) handles network → server → response.
- **Whole-record PUT** (architecture.md line 300, AR-23): every save sends the complete record, not a partial. The mutation hook builds the payload from the latest `useSong` data + the changed field.
- **CSS variables for atmosphere** (architecture.md lines 731–738): components consume `var(--color-*)`, `var(--text-*)`, `var(--font-*)`, never hex values or px literals. The atmosphere is fixed at boot via `applyBootAtmosphere()`.
- **Composed Zod envelope at the call site** (Story 2.4 + 2.5 precedent): `GetSongResponseSchema` and `PutSongResponseSchema` are composed inside `web/src/api/songs.ts`. No new shared exports.
- **`min-h-tap` tokens on tappable elements** (architecture.md line 830): every `<InlineEditField>` editor element, the `Back to library` link, all field labels (if interactive).
- **Hoisted vi.mock factories** (`web/src/routes/library.test.tsx`): mirror the pattern for `song-detail.test.tsx`'s `useSong` / `useSongMutation` / `useNavigate` mocks.
- **Fresh QueryClient per hook test** (`web/src/sync/flusher.test.ts`, `web/src/hooks/use-songs.test.tsx`): no singleton pollution.

### Latest tech information (versions verified at story-write time, 2026-06-18)

- **`@tanstack/react-query` 5.101.0** — `useQuery`'s `enabled` flag is stable and is the canonical way to gate queryFn execution. With `enabled: false` the hook returns `data: undefined, isLoading: false, isFetching: false`.
- **`react-router` 7.x** — `useNavigate()` returns a stable function reference; `navigate(path, { replace: true })` is the canonical replace-history call. `useParams<{ songId?: string }>()` returns an object whose `songId` is `string | undefined`.
- **React 19.x** — `useTransition`, `useDeferredValue` are NOT needed (the debounce primitive is a plain `setTimeout`). `useCallback`, `useMemo`, `useRef`, `useLayoutEffect` are sufficient.
- **`zod` 3.23.x** — `z.discriminatedUnion('status', [...])` is stable; the schemas inside the union must each carry a literal `status` field. Both response envelopes do.
- **TypeScript 5.6 strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`** — the new code must pass under all three. Key pitfalls: `useParams<{ songId?: string }>` returns `songId: string | undefined` (handle the undefined arm); `useSong(songId)` accepts `string | null` so the route must coerce `undefined → null` before passing.
- **`nanoid` 5.x** — `customAlphabet(alphabet, size)` is the canonical factory. Pure-ESM; matches the workspace's `"type": "module"`.

### Files this story creates

- `web/src/lib/song-id.ts` — `URL_SAFE_ALPHABET`, `generateSongId()`
- `web/src/lib/song-id.test.ts`
- `web/src/hooks/use-song.ts` — `useSong(songId)`
- `web/src/hooks/use-song.test.tsx`
- `web/src/hooks/use-song-mutation.ts` — `useSongMutation()`, `mergeSongIntoList`
- `web/src/hooks/use-song-mutation.test.tsx`
- `web/src/components/inline-edit-field.tsx` — `<InlineEditField>`
- `web/src/components/inline-edit-field.test.tsx`
- `web/src/components/chord-chart.tsx` — `<ChordChart>`
- `web/src/components/chord-chart.test.tsx`
- `web/src/routes/song-detail.tsx` — `<SongDetail>`
- `web/src/routes/song-detail.test.tsx`

### Files this story modifies

- `web/src/api/songs.ts` — adds `getSong()` and `putSong()`; updates the file's leading comment
- `web/src/api/songs.test.ts` — adds ~7 cases (4 for `getSong`, 3 for `putSong`)
- `web/src/sync/outbox.ts` — imports `URL_SAFE_ALPHABET` from `../lib/song-id.js` instead of declaring locally
- `web/src/lib/microcopy.ts` — appends `EMPTY_STATES.songNotFound`, `ACTIONS.backToLibrary`, new `FIELD_LABELS` constant; updates the file header
- `web/src/router.tsx` — registers `/songs/new` and `/songs/:songId`

### Files this story deletes

None.

### Project Structure Notes

- **Aligned with the architecture's directory tree** (architecture.md lines 877–914):
  - `web/src/routes/song-detail.tsx` — present at line 866 (`song-detail.tsx # Song detail (FR-3)`). Story 2.6 lands the file.
  - `web/src/components/inline-edit.tsx` — listed at line 873 (`inline-edit.tsx`). Story 2.6 names the file `inline-edit-field.tsx` instead — the architecture uses the shorter form but the component named per UX-DR4 is `InlineEditField`, so the kebab-case filename matches the component name verbatim. **Architecture deviation acknowledged:** this is a one-character difference (`inline-edit.tsx` → `inline-edit-field.tsx`); if a future cleanup pass wants to consolidate, the dev agent should flag it in their notes. The architecture document is not updated for this micro-rename.
  - `web/src/components/chord-chart.tsx` — NEW file. Architecture does not enumerate it explicitly (the component is part of UX-DR4 / UX-DR5). Naming matches the kebab-case convention.
  - `web/src/hooks/use-song.ts` — present at line 903 (`use-song.ts`). Story 2.6 lands the file (singular form per architecture).
  - `web/src/hooks/use-song-mutation.ts` — NEW file. Architecture's hooks list at lines 903–907 enumerates `use-song`, `use-setlist`, `use-tonight-gig`, `use-outbox-status`, `use-performance-active`; the mutation hook is implied by the AR-45 "via hooks" rule but not enumerated. Adding it is consistent with the architecture's pattern (one hook per concern).
  - `web/src/lib/song-id.ts` — NEW file. Architecture's lib list at lines 911–914 enumerates `nanoid.ts`, `iso-date.ts`, `platform.ts`. The `song-id` module is the project-specific wrapper around `nanoid` — it carries the shared alphabet constant and the generator. Adding it is consistent.

- **New files in subdirectories:**
  - `web/src/hooks/` already exists (Story 1.5, 2.5). No new directory.
  - `web/src/components/` already exists. No new directory.
  - `web/src/routes/` already exists. No new directory.
  - `web/src/lib/` already exists. No new directory.

- **No Biome / tsconfig changes required** — all new files live under already-covered globs (`web/src/**`).

### Testing requirements

- **Unit / component (Vitest, web package):**
  - `web/src/api/songs.test.ts` — +7 cases (AC-1)
  - `web/src/hooks/use-song.test.tsx` — +4 cases (AC-2)
  - `web/src/hooks/use-song-mutation.test.tsx` — +3 cases (AC-4)
  - `web/src/components/inline-edit-field.test.tsx` — +10 cases (AC-5)
  - `web/src/components/chord-chart.test.tsx` — +6 cases (AC-6)
  - `web/src/routes/song-detail.test.tsx` — +7 cases (AC-10)
  - `web/src/lib/song-id.test.ts` — +3 cases (AC-3)

  Expected delta: +40 tests. Web test count goes from ~161 → ~201.

- **E2E (Playwright):** no new cases. The user-visible end-to-end (browse + tap + edit + chord render) is verified manually by Sandy on-device (Task 11). Playwright E2E for the create + edit flow is deferred — no story owns it in V1.

- **Manual smoke (Task 11):** Sandy verifies on MacBook + iPhone post-deploy. Unchecked checkbox per Epic 1 retro Lesson #1.

### Dev environment reminders

- **Local dev:** `pnpm dev` runs `dev:web` (Vite at `localhost:5273`) + `dev:api` (Hono via `tsx watch` at `localhost:3100`). The web proxy in `vite.config.ts` forwards `/api/*` to the API. To populate the local DDB Library, you can now create songs via the UI itself — open `localhost:5273/songs/new`, type a title, click outside. Story 2.6's flow is self-bootstrapping.
- **Auth cookie locally:** `POST /api/v1/auth/login { password: "<bootstrap password>" }` sets the cookie. `apiFetch`'s `credentials: 'same-origin'` inherits it. To clear: DevTools → Application → Cookies → delete `gigbuddy_session`.
- **DDB local:** the API uses `DDB_LOCAL_ENDPOINT` if set in env — see `api/src/ddb/client.ts`. For offline dev, point at `dynamodb-local`. For most local dev, just hit the live dev table (Sandy's account).
- **Cache reset during dev:** if the persisted IDB cache holds stale data after a `vite.config.ts` change, clear it via DevTools → Application → IndexedDB → delete `gigbuddy-query-cache`. Or bump the `buster` field in `web/src/sync/query-client.tsx` (currently `'v1'`).
- **Vitest fake-indexeddb leakage:** if a previous test file imported `fake-indexeddb/auto`, the shim persists across files in the same Vitest worker. This is fine for Story 2.6 — `use-song-mutation.test.tsx` opts into the shim explicitly; tests that don't touch the outbox (like `song-detail.test.tsx` which mocks the mutation hook) are not affected.
- **React 19 strict mode:** the app is wrapped in `<StrictMode>` (per `main.tsx:17`). Effects fire twice in development; ensure the debounce hook's cleanup handles this correctly (it does — the cleanup clears the pending timer, and the second mount installs a fresh one).
- **`userEvent` + fake timers:** in `song-detail.test.tsx`, when using `vi.useFakeTimers()`, configure userEvent via `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` so userEvent's internal delays advance the fake clock. Without this, typing hangs indefinitely.
- **Node 22, pnpm 11.0.9** — pinned. Do not bump.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Record shapes (canonical Zod schemas in `shared/`)] (lines 522–569) — `SongSchema`, `SongPutInputSchema`.
- [Source: _bmad-output/planning-artifacts/architecture.md#LWW server logic (implement once, exactly once)] (lines 571–588) — server's LWW pattern; the client's mutation hook sends a whole-record PUT and relies on this server behavior.
- [Source: _bmad-output/planning-artifacts/architecture.md#Outbox state machine (client side)] (lines 590–623) — enqueue rules; flush rules; the existing `enqueue` API consumed by `useSongMutation`.
- [Source: _bmad-output/planning-artifacts/architecture.md#State management taxonomy] (lines 718–731) — server data via TanStack Query; form state via component-local `useState`; URL via React Router.
- [Source: _bmad-output/planning-artifacts/architecture.md#Theme atmosphere] (lines 731–738) — atmosphere selected at boot via `data-atmosphere`; CSS variable scope; no JS theme provider.
- [Source: _bmad-output/planning-artifacts/architecture.md#Accessibility implementation primitives] (lines 815–833) — `aria-label`, `min-h-tap`, focus management, `prefers-reduced-motion`.
- [Source: _bmad-output/planning-artifacts/architecture.md#Directory tree] (lines 840–1015) — `web/src/routes/song-detail.tsx`, `web/src/components/inline-edit.tsx`, `web/src/hooks/use-song.ts`.
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements → structure mapping] (lines 1089–1102) — Song Library lives in `web/src/routes/library.tsx`, `song-detail.tsx`; `api/src/routes/songs.ts`; `shared/src/schemas/song.ts`.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] (lines 908–985) — verbatim AC text.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-1] (line 23) — create a Song with a title.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-2] (line 24) — edit a Song inline; debounced silent save.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-3] (line 25) — Song Detail surface.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-5] (line 27) — Song record structure + chord-chart V1 parsing.
- [Source: _bmad-output/planning-artifacts/epics.md#NFR-4] (line 80) — debounce timing (200ms).
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4] (line 202) — InlineEditField visual treatment.
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR5] (line 204) — Chord chart V1 floor rendering.
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR6] (line 206) — accessibility primitives.
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR7] (line 208) — voice & tone consistency.
- [Source: _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/prd.md#FR-5: Song record structure] (lines 131–148) — field surface scoping table.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Information Architecture] (lines 35–67) — Song detail reached from Library row tap; same surface MacBook + iPhone; routing rules.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Component Patterns] (lines 86–104) — `Inline edit field` behavioral rules; `Chord chart` V1 floor.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#State Patterns] (lines 106–127) — Sparse song content renders honestly; Save in progress is silent; Save failed shows error toast; Offline edits queue silently.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md#Components] (lines 188–207) — `Inline edit field` visual treatment; `Performance card — chord region` visual treatment shared by `Chord chart` on Song Detail (V1 floor = mono text).
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md] — Lesson #1 (manual checkbox), Lesson #4 (integration test coverage).
- [Source: _bmad-output/implementation-artifacts/2-5-library-list-surface.md] — Story 2.5 contract: `useSongs()`, `<LibrarySongRow>`, `+ New song` Link, `ACTIONS` microcopy.
- [Source: _bmad-output/implementation-artifacts/2-4-sync-layer-foundation-client-error-reporter.md] — sync layer: QueryClient singleton, outbox, flusher, stale-write banner, `apiFetch`.
- [Source: _bmad-output/implementation-artifacts/2-3-song-api-ddb-persistence-client-errors-endpoint.md] — `GET /api/v1/songs/:songId` + `PUT /api/v1/songs/:songId` server contracts; envelope shapes; `SongPutInputSchema` `.strict()` validation.
- [Source: _bmad-output/implementation-artifacts/1-5-navigation-chrome-scaffold.md] — `<AuthenticatedShell>`, `<RequireAuth>`, route registration pattern.
- [Source: _bmad-output/implementation-artifacts/1-2-design-system-foundation-tokens-typography-atmospheres.md] — atmosphere tokens, type scale, `--spacing-tap`, font families.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — known tech debt: `maxAge: Infinity` on `PersistQueryClientProvider` deferred (Story 2.6 does NOT fix); `SongSchema.title` allows empty (Story 2.6 enforces non-empty at the form layer per AC-7).
- [Source: web/src/sync/flusher.ts] (lines 36–55) — `queryKeyForSong`; the queryKey contract the per-song hook MUST match.
- [Source: web/src/sync/outbox.ts] (lines 21–22, 43–76) — `URL_SAFE_ALPHABET` constant (to be moved); `enqueue` signature.
- [Source: web/src/sync/query-client.tsx] — singleton QueryClient; `SyncProvider` mounted in `main.tsx`.
- [Source: web/src/api/client.ts] — `apiFetch` contract; `wasNetworkSuccess`; 401 handling.
- [Source: web/src/api/songs.ts] — current `listSongs()` baseline; Story 2.6 extends this file.
- [Source: web/src/routes/library.tsx] — `<Link to="/songs/${id}">` and `<Link to="/songs/new">` already emit; Story 2.6 makes the destinations live.
- [Source: web/src/routes/library.test.tsx] — hoisted-mock pattern to mirror in `song-detail.test.tsx`.
- [Source: web/src/components/bottom-tabs.tsx] — `<Link>` with `min-h-tap` whole-row tap-target pattern.
- [Source: web/src/lib/microcopy.ts] — `EMPTY_STATES`, `BANNERS`, `ACTIONS` pattern; Story 2.6 appends `songNotFound` / `backToLibrary` / `FIELD_LABELS`.
- [Source: web/src/styles/tokens.css] — `--text-perf-title`, `--text-perf-meta`, `--text-perf-chord`, `--text-perf-body`, `--text-practice-body`, `--font-serif-editorial`, `--font-mono-slab`, `--spacing-tap`.
- [Source: shared/src/schemas/song.ts] — `SongSchema`, `SongPutInputSchema`, `Song`, `SongPutInput`.
- [Source: shared/src/schemas/api.ts] — `OkResponseSchema`, `AppliedResponseSchema`, `DroppedAsStaleResponseSchema`, `ErrorResponseSchema`.
- [Source: shared/src/active-band.ts] — `ACTIVE_BAND_ID`, `ACTIVE_BAND_NAME`.
- [Source: CLAUDE.md] — boundaries; Zod single source of truth; React Router 7 imports from `react-router`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via `bmad-dev-story` skill, baseline commit `7c7cb5b`.

### Debug Log References

Local development only — no CI/deploy logs. Notable in-session diagnostics:

- **Vitest fake timers + userEvent deadlock.** First attempt at `song-detail.test.tsx` used `vi.useFakeTimers()` + `userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })` for the four debounce-window cases (AC-10's "edits a single field", "rapid edits coalesce", "create flow", "empty title guard"). All four hung to the 5s test timeout. Resolution: switched to real timers + `waitFor(..., { timeout: 600 })` for the positive-assertion cases and a `setTimeout(400ms)` await for the negative-assertion empty-title case. Suite now completes in ~2.6s for the 8 route tests. Documented in AC-10 task checklist for future stories that need a debounce test.
- **JSX literal `\n` is not a newline.** First attempt at `chord-chart.test.tsx` used `<ChordChart text="foo\n\n\nbar" />` — JSX attribute string passes the literal `\` + `n` characters, not actual newlines. Resolution: switched to `text={'foo\n\n\nbar'}` (expression form). Affected two test cases.
- **`getByLabelText('Title')` matched both h1 and input.** First attempt rendered `<h1 className="sr-only">{FIELD_LABELS.title}</h1>` (text "Title") above the title `<InlineEditField ariaLabel={FIELD_LABELS.title} />` (aria-label "Title"). `screen.getByLabelText('Title')` then matched both the section (labelled-by h1) and the input (aria-label). Resolution: changed h1 text to "New song" on create / `data.title || 'Song detail'` on edit.
- **Biome `useExhaustiveDependencies` flagged InlineEditField's resize effect.** The `useLayoutEffect(() => resize(textareaRef.current), [local, multiline])` was flagged because `local` is referenced via the DOM, not directly in the closure. Resolution: explicit `biome-ignore` with a comment explaining the DOM-flow trigger.

### Completion Notes List

- All 10 acceptance criteria implemented; AC-12 (Sandy's on-device proof, Task 11) intentionally stays unchecked per Epic 1 retro Lesson #1.
- `URL_SAFE_ALPHABET` is now declared once in `web/src/lib/song-id.ts`; `web/src/sync/outbox.ts` imports it (Story 2.4's local declaration deleted). Outbox tests pass without modification.
- The edit-branch debounced commit uses a **ref-based accumulator** (`pendingRef: Partial<Song>`) so cross-field rapid blurs don't lose changes. Without this, a fast Title-then-Key blur sequence would lose the Title because the second commit's record-snapshot doesn't yet contain the optimistic Title write. AC-10 only tests same-field rapid edits, but the implementation is correct for the cross-field case too.
- The optimistic write in `useSongMutation.saveSong` writes BOTH `['song', bandId, songId]` and `['songs', bandId]` so the Library re-renders without a refetch when a new song is created or a song title changes. This is the path Story 2.5's AC-8 cache-invalidation test exercises in a synthetic form; Story 2.6 makes it real.
- The InlineEditField is always-editable (no edit-mode toggle, no save button per FR-2/UX-DR4). `disabled` renders the same input element with the `disabled` attribute, satisfying AC-5's "ignores click/focus events" requirement while keeping a consistent visual shell (no layout jump on toggle).
- Atmosphere is read once at mount from `document.documentElement.dataset.atmosphere` (set by `applyBootAtmosphere()` per Story 1.2). The route does NOT use `isIPhone()` as a proxy — atmosphere is the single source of truth per architecture.md "Theme atmosphere".
- The architecture's `web/src/components/inline-edit.tsx` filename is realized here as `inline-edit-field.tsx` to match the component name `InlineEditField` verbatim. One-character deviation documented in the story's Project Structure Notes.
- `pnpm-lock.yaml` and all `package.json` files are unchanged. No new dependencies.

### File List

**New (web/src):**
- `lib/song-id.ts`
- `lib/song-id.test.ts`
- `hooks/use-song.ts`
- `hooks/use-song.test.tsx`
- `hooks/use-song-mutation.ts`
- `hooks/use-song-mutation.test.tsx`
- `components/inline-edit-field.tsx`
- `components/inline-edit-field.test.tsx`
- `components/chord-chart.tsx`
- `components/chord-chart.test.tsx`
- `routes/song-detail.tsx`
- `routes/song-detail.test.tsx`

**Modified (web/src):**
- `api/songs.ts` — adds `getSong()` and `putSong()`; updates the file's leading comment
- `api/songs.test.ts` — adds 7 cases (4 for `getSong`, 3 for `putSong`)
- `sync/outbox.ts` — imports `URL_SAFE_ALPHABET` from `../lib/song-id.js`; removes local declaration
- `lib/microcopy.ts` — appends `EMPTY_STATES.songNotFound`, `ACTIONS.backToLibrary`, new `FIELD_LABELS` constant; updates header comment
- `router.tsx` — registers `/songs/new` and `/songs/:songId`

**Sprint tracking:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 2-6 transitions `ready-for-dev` → `in-progress` → `review`
- `_bmad-output/implementation-artifacts/2-6-song-detail-with-inline-edit-chord-chart-rendering.md` — status, task checkboxes, Dev Agent Record, File List, Change Log

## Change Log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 2026-06-18 | Implementation complete (status: review). All 10 acceptance criteria (AC-1 through AC-11) implemented and passing tests. Web test count: 161 → 206 (+45). API: 73 unchanged. Build green. No new deps. AC-12 (Sandy's on-device proof, Task 11) remains intentionally unchecked per Epic 1 retro Lesson #1 — Sandy verifies post-merge on MacBook Safari and iPhone PWA. Key implementation decisions: (1) extracted `URL_SAFE_ALPHABET` to `web/src/lib/song-id.ts` so outbox + song-id generator share one source of truth; (2) used a ref-based pending-changes accumulator in the edit branch's debounced commit so cross-field rapid blurs don't lose changes; (3) optimistic `setQueryData` writes both per-song and list caches so the Library re-renders without a refetch; (4) chose real timers + `waitFor` over fake timers for the route's debounce-window tests after fake timers deadlocked userEvent's internal awaits. |
| 2026-06-18 | Story spec created (status: ready-for-dev). Builds on Story 2.5 (Library list + `+ New song` Link emit) and Story 2.4 (sync layer + outbox + stale-write banner). Closes Epic 2's user-visible scope: lands the Song Detail surface at `/songs/new` and `/songs/:songId`, the `InlineEditField` primitive (no edit-mode, no save button, debounced 200ms blur commit per NFR-4), the `ChordChart` V1-floor renderer (`{...}` lines as section breaks, blank lines preserved, URLs tappable in Practice / inert in Performance per UX-DR5), `getSong()` + `putSong()` API calls, `useSong(songId)` + `useSongMutation()` hooks, and the song-id generator (16-char URL-safe NanoID per AR-47 — alphabet shared with the outbox). Mutation hook does optimistic `setQueryData` for both `['song', bandId, songId]` and `['songs', bandId]` so the Library list re-renders without a refetch (validates Story 2.5's AC-8 cache-invalidation path). Title-required guard on `/songs/new`: empty Title blur does not create. Atmosphere-based URL tappability without coupling to `performanceActive`. No new dependencies (all of nanoid / react-router / @tanstack/react-query / fake-indexeddb / @testing-library/user-event already resolved). Expected delta: +40 web tests; web suite climbs from ~161 → ~201. Task 11 (Sandy's on-device proof) intentionally unchecked per Epic 1 retro Lesson #1. |
