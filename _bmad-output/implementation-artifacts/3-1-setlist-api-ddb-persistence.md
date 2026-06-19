---
baseline_commit: 5808b86
builds_on: 2-6-song-detail-with-inline-edit-chord-chart-rendering
---

# Story 3.1: Setlist API + DDB persistence

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want server-side Setlist CRUD with embedded Sections + Song refs + annotations as a single DDB item, plus GSI1 for date queries,
so that the V1 reads of the Setlist overview are one-item-fetches and the V2-mineable history is preserved without migration.

## Acceptance Criteria

**AC-1 — `shared/src/schemas/setlist.ts` defines and exports `SongRefSchema`, `SectionSchema`, and `SetlistSchema`**

**Given** `shared/src/schemas/setlist.ts` (NEW)
**When** reviewed
**Then** `SongRefSchema` is a Zod object: `{ songId: z.string(), titleSnapshot: z.string(), perGigAnnotation: z.string().optional() }`
**And** `SectionSchema` is: `{ name: z.string(), songs: z.array(SongRefSchema) }`
**And** `SetlistSchema` is:
```ts
z.object({
  bandId: z.string(),
  setlistId: z.string(),
  gigMeta: z.object({
    venue: z.string(),
    date: z.string().date(),       // ISO date only, e.g. "2026-06-21"
    time: z.string().optional(),   // HH:MM 24h, e.g. "20:00"
  }),
  sections: z.array(SectionSchema),
  clientWrittenAt: z.string().datetime(),
  serverReceivedAt: z.string().datetime(),
  version: z.literal(1),
})
```
**And** the file also exports:
```ts
export const SetlistPutInputSchema = SetlistSchema.omit({ serverReceivedAt: true }).strict();
export type SetlistPutInput = z.infer<typeof SetlistPutInputSchema>;
```
(mirrors the `SongPutInputSchema` pattern in `shared/src/schemas/song.ts:21-22` — `.strict()` is intentional and symmetric: `SongPutInputSchema` also uses `.strict()`, enforcing the AR-23 contract that the server stamps `serverReceivedAt` and the client must not send it)
**And** `SongRefSchema`, `SectionSchema`, `SetlistSchema`, `SetlistPutInputSchema`, `SongRef`, `Section`, `Setlist`, and `SetlistPutInput` types are all re-exported via `shared/src/index.ts`

**AC-2 — `api/src/ddb/setlists.ts` wraps all DDB access for Setlist records**

**Given** `api/src/ddb/setlists.ts` (NEW)
**When** reviewed
**Then** it exposes:
- `getSetlist(bandId: string, setlistId: string): Promise<Setlist | undefined>`
- `putSetlist(record: Setlist): Promise<void>`
- `listSetlistsByBand(bandId: string): Promise<Setlist[]>` (uses GSI1 query)
**And** items are persisted with:
- `pk = BAND#<bandId>`, `sk = SETLIST#<isoDate>#<setlistId>` (from `gigMeta.date`)
- `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`
- `gsi1sk = <isoDate>#<setlistId>` (for GSI1 date-ordered reads)
**And** `getSetlist` issues a `QueryCommand` for `pk = BAND#<bandId> AND begins_with(sk, 'SETLIST#')` filtered by `setlistId`, NOT a `GetCommand` with the full composite sk — because `getSetlist(bandId, setlistId)` does not have `isoDate` available at call time (the caller knows only the setlistId)

> **Note on `getSetlist` key design:** The sk is `SETLIST#<isoDate>#<setlistId>`. A `GetCommand` requires the full sk. Since the API route receives only `setlistId` (not the date), `getSetlist` must query by `pk = BAND#<bandId>` with `begins_with(sk, 'SETLIST#')` and filter by `setlistId`. An alternative design would add a GSI or change the sk, but that requires a CDK/infra change outside this story. The Query approach works for single-tenant V1 volume. This is a known trade-off; flag in dev notes.

**And** `putSetlist` issues a `PutCommand` with all fields including the GSI attributes and pk/sk, stripping them from the parsed response (same as `songs.ts` pk/sk handling)
**And** `listSetlistsByBand` queries **GSI1** (`IndexName: 'gsi1'`): `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, returns results in `gsi1sk` (date) ascending order — the client (Story 3.2) handles sectioning
**And** all DDB access stays inside this wrapper — no `@aws-sdk/client-dynamodb` imports elsewhere in `api/` (AR-42)

**AC-3 — `api/src/ddb/setlists.test.ts` covers the DDB wrapper contract**

**Given** `api/src/ddb/setlists.test.ts` (NEW)
**When** the test suite runs
**Then** it mirrors the pattern in `api/src/ddb/songs.test.ts`: `mockClient(getDocClient())` at file scope; `beforeEach` sets `process.env.TABLE_NAME` and calls `ddbMock.reset()`
**And** it covers `getSetlist`:
- returns `undefined` when the Query returns no Items
- returns a parsed `Setlist` when DDB returns a complete item (pk/sk/gsi1pk/gsi1sk stripped)
- throws when DDB returns a malformed item (schema drift guard)
- issues a `QueryCommand` against the correct table with `pk = BAND#<bandId>` and `begins_with(sk, 'SETLIST#')` (confirms the Query approach not GetCommand)
**And** it covers `putSetlist`:
- issues a `PutCommand` with `pk`, `sk`, `gsi1pk`, `gsi1sk` all correctly derived from the record
- `pk = BAND#<bandId>`, `sk = SETLIST#<gigMeta.date>#<setlistId>`, `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, `gsi1sk = <gigMeta.date>#<setlistId>`
**And** it covers `listSetlistsByBand`:
- issues a `QueryCommand` against `gsi1` index with the correct `KeyConditionExpression` (`gsi1pk = :pk`)
- returns an empty array when no items exist
- returns multiple Setlists in the order DDB returns them (ascending gsi1sk)

**AC-4 — `GET /api/v1/setlists` returns all Setlists for the active Band, date-ordered**

**Given** `api/src/routes/setlists.ts` (NEW)
**When** `GET /api/v1/setlists` is hit with a valid auth cookie
**Then** the handler calls `listSetlistsByBand(ACTIVE_BAND_ID)` and returns `{ status: 'ok', data: [SetlistSchema, ...] }`
**And** the response carries the `x-server-now` header (from `serverNowMiddleware` already wired globally in `api/src/app.ts`)

**AC-5 — `GET /api/v1/setlists/:setlistId` returns a single Setlist or 404**

**Given** `GET /api/v1/setlists/:setlistId` with a valid auth cookie
**When** the setlist exists
**Then** the response is `{ status: 'ok', data: <Setlist> }`
**And** when the setlist does not exist, the response is HTTP 404 with `{ status: 'error', error: { code: 'NOT_FOUND', message: 'setlist not found' } }`

**AC-6 — `PUT /api/v1/setlists/:setlistId` with LWW semantics (whole-record, atomic)**

**Given** `PUT /api/v1/setlists/:setlistId` with a body matching `SetlistPutInputSchema` and a valid auth cookie
**When** the handler runs
**Then** it validates with `SetlistPutInputSchema.safeParse(body)` — returns 400 with `VALIDATION_FAILED` envelope on failure (mirrors songs.ts pattern)
**And** it validates that `body.setlistId === :setlistId` path param — returns 400 if mismatch
**And** it validates that `body.bandId === ACTIVE_BAND_ID` — returns 400 if mismatch
**And** it calls `compareLww(parsed.data, existing)` from `api/src/lww.ts` (the same generic comparator used by songs.ts — this is why it was made generic)
**And** when incoming `clientWrittenAt` ≥ stored, the WHOLE record (sections + songs + annotations atomically) is written with `serverReceivedAt = new Date().toISOString()`; response is `{ status: 'applied', data: <Setlist> }`
**And** when incoming < stored, the record is NOT persisted; response is `{ status: 'dropped-as-stale', currentState: <Setlist> }` (HTTP 200 — the write was processed, just not persisted; per AR-23 whole-record PUT semantics)
**And** there is NO per-field merging — entire `sections[]` array including all Song refs and per-gig annotations is replaced atomically

**AC-7 — `api/src/routes/setlists.test.ts` covers the route contract**

**Given** `api/src/routes/setlists.test.ts` (NEW)
**When** the test suite runs
**Then** it mirrors the structure of `api/src/routes/songs.test.ts`
**And** it covers `GET /api/v1/setlists`:
- returns 200 with `{ status: 'ok', data: [] }` on empty band
- returns 200 with `{ status: 'ok', data: [setlist] }` when setlists exist
**And** it covers `GET /api/v1/setlists/:setlistId`:
- returns 200 with `{ status: 'ok', data: <setlist> }` when found
- returns 404 with `{ status: 'error', error: { code: 'NOT_FOUND' } }` when not found
**And** it covers `PUT /api/v1/setlists/:setlistId`:
- returns 400 on malformed body (Zod validation fail)
- returns 400 when `body.setlistId` does not match path param
- returns 400 when `body.bandId` does not match `ACTIVE_BAND_ID`
- returns `{ status: 'applied', data: <record> }` when incoming ≥ existing `clientWrittenAt`
- returns `{ status: 'dropped-as-stale', currentState: <existing> }` when incoming < existing
- returns `{ status: 'applied' }` when no existing record (new setlist — `compareLww` returns `'apply'` when `existing` is `undefined`)
- **Setlist-specific atomicity test:** a PUT that modifies sections, reorders songs, AND changes a `perGigAnnotation`, all on the same `clientWrittenAt` as the existing record — should `apply` (same-timestamp wins) and the entire `sections[]` payload is written verbatim (no merging)
**And** auth is enforced: `GET` and `PUT` without a valid cookie return 401 (the global `authMiddleware` in `app.ts` handles this — test confirms the route is registered under `/api/v1/*`)

**AC-8 — `api/src/app.ts` wires the setlists route**

**Given** `api/src/app.ts` (UPDATE)
**When** reviewed
**Then** it imports `setlistsRoute` from `./routes/setlists.js`
**And** adds `.route('/api/v1/setlists', setlistsRoute)` after the existing `.route('/api/v1/songs', songsRoute)` line
**And** all other routes and middleware are unchanged

**AC-9 — `titleSnapshot` independence from Song title changes**

**Given** a Setlist record with `sections[0].songs[0].titleSnapshot = 'Round Midnight'`
**When** a `PUT /api/v1/songs/:songId` changes that Song's `title` to `'Round About Midnight'`
**Then** the Setlist record in DDB is NOT modified by the Song write
**And** a subsequent `GET /api/v1/setlists/:setlistId` still returns `titleSnapshot: 'Round Midnight'`
**And** new Setlist writes can carry the updated title in `titleSnapshot` (the client supplies it at write time)

This AC is satisfied structurally by the architecture (songs.ts and setlists.ts are independent DDB wrappers; they never co-write). The test in AC-7 should include an assertion that after a song PUT, a GET on the setlist still shows the original `titleSnapshot`.

**AC-10 — `web/src/sync/record-key.ts` extended with `setlistRecordKey()` and flusher updated** _(scope note: the epic's Story 3.1 AC covers server + shared only; AC-10 through AC-13 are web plumbing that is required before any Story 3.2–3.6 UI can function. No later story owns this foundation, so it ships here.)_

**Given** `web/src/sync/record-key.ts` (UPDATE)
**When** reviewed
**Then** it exports `setlistRecordKey(bandId: string, setlistId: string): string` returning `setlist:${bandId}:${setlistId}`
**And** `ParsedRecordKey` union type is extended with `| { kind: 'setlist'; bandId: string; setlistId: string }`
**And** `parseRecordKey` handles the new `'setlist'` kind: `parts[0] === 'setlist'` with 3 parts → `{ kind: 'setlist', bandId: parts[1], setlistId: parts[2] }`
**And** the existing `songRecordKey` and `'song'` kind handling is unchanged

**Given** `web/src/sync/flusher.ts` (UPDATE)
**When** reviewed
**Then** a `SetlistSchema` import is added from `@gigbuddy/shared`
**And** `PutResponseSchema` inner data types are widened to `z.unknown()` — the flusher only needs the envelope `status` to dispatch and does not deep-use the typed record:
```ts
const PutResponseSchema = z.discriminatedUnion('status', [
  AppliedResponseSchema(z.unknown()),
  DroppedAsStaleResponseSchema(z.unknown()),
  ErrorResponseSchema,
]);
```
(The per-kind schemas and dispatch-before-parsing alternative is explicitly rejected — the `z.unknown()` widening is the required approach. See Dev Notes for full rationale.)

**And** `routeForRecordKey` in `flusher.ts` is updated to handle the `'setlist'` kind:
```ts
if (parsed.kind === 'setlist') {
  return {
    kind: 'setlist',
    method: 'PUT' as const,
    url: `/api/v1/setlists/${parsed.setlistId}`,
    queryKey: queryKeyForSetlist(parsed.bandId, parsed.setlistId),
  };
}
```
**And** `queryKeyForSetlist(bandId, setlistId)` returns `['setlist', bandId, setlistId]` (mirrors `queryKeyForSong`)
**And** the `routeForRecordKey` return type union is extended with the setlist variant
**And** `web/src/sync/record-key.test.ts` (UPDATE) adds cases for `setlistRecordKey` (format check) and `parseRecordKey` with a setlist key (round-trip parse)

**AC-11 — `web/src/api/setlists.ts` exposes API client functions for Setlists**

**Given** `web/src/api/setlists.ts` (NEW)
**When** reviewed
**Then** it exports:
- `listSetlists(): Promise<Setlist[]>` — calls `GET /api/v1/setlists`, unwraps `OkResponseSchema(z.array(SetlistSchema))`, returns the array
- `getSetlist(setlistId: string): Promise<Setlist | null>` — calls `GET /api/v1/setlists/<setlistId>`, returns the setlist or `null` on 404
- `putSetlist(input: SetlistPutInput): Promise<{ kind: 'applied'; data: Setlist } | { kind: 'dropped-as-stale'; currentState: Setlist }>` — mirrors `putSong` in `web/src/api/songs.ts`
**And** schemas are composed at the call site (no new shared exports) — mirrors `web/src/api/songs.ts` structure
**And** `web/src/api/setlists.test.ts` (NEW) covers:
- `listSetlists`: 200 ok envelope returns the array; malformed envelope throws
- `getSetlist`: 200 ok returns unwrapped Setlist; 404 NOT_FOUND returns `null`; malformed throws
- `putSetlist`: 200 applied returns `{ kind: 'applied', data }`; 200 dropped-as-stale returns `{ kind: 'dropped-as-stale', currentState }`; 400 error throws

**AC-12 — `web/src/hooks/use-setlists.ts` and `web/src/hooks/use-setlist.ts` TanStack Query hooks**

**Given** `web/src/hooks/use-setlists.ts` (NEW)
**When** reviewed
**Then** it exports `function useSetlists(): UseQueryResult<Setlist[], Error>` calling `useQuery({ queryKey: ['setlists', ACTIVE_BAND_ID], queryFn: listSetlists })`
**And** no per-call `staleTime`, `gcTime`, or `refetchOnWindowFocus` overrides (defaults from SyncProvider apply)
**And** `web/src/hooks/use-setlists.test.tsx` (NEW) covers: resolves to array on success; queryKey shape is `['setlists', ACTIVE_BAND_ID]`

**Given** `web/src/hooks/use-setlist.ts` (NEW)
**When** reviewed
**Then** it exports `function useSetlist(setlistId: string | null): UseQueryResult<Setlist | null, Error>` calling `useQuery({ queryKey: ['setlist', ACTIVE_BAND_ID, setlistId], queryFn: () => getSetlist(setlistId!), enabled: setlistId !== null })`
**And** mirrors `web/src/hooks/use-song.ts` exactly (same `enabled` null-guard pattern)
**And** `web/src/hooks/use-setlist.test.tsx` (NEW) covers: resolves to Setlist; queryKey shape; 404 → `null`; `enabled: false` on null setlistId

**AC-13 — `web/src/hooks/use-setlist-mutation.ts` outbox-wired Setlist mutation hook**

**Given** `web/src/hooks/use-setlist-mutation.ts` (NEW)
**When** reviewed
**Then** it exports `function useSetlistMutation(): { saveSetlist: (record: SetlistPutInput) => Promise<void> }`
**And** `saveSetlist(record)`:
  1. Optimistically writes per-setlist cache: `queryClient.setQueryData(['setlist', record.bandId, record.setlistId], optimistic)` where `optimistic = { ...record, serverReceivedAt: new Date().toISOString() }`
  2. Optimistically merges into list cache: `queryClient.setQueryData(['setlists', record.bandId], (current: Setlist[] | undefined) => mergeSetlistIntoList(current ?? [], optimistic))` where `mergeSetlistIntoList` replaces by `setlistId` or inserts (no sorting required — list order is by date per GSI1; Story 3.2 handles the Tonight/Upcoming/Past sectioning)
  3. Enqueues: `await enqueue({ recordKey: setlistRecordKey(record.bandId, record.setlistId), payload: record, clientWrittenAt: record.clientWrittenAt })`
  4. Kicks flusher: `void flushOnce()`
**And** mirrors `useSongMutation` structure (same imports: `queryClient` singleton, `enqueue`, `flushOnce`, `setlistRecordKey`)
**And** does NOT use `useQueryClient()` hook (same reason as `useSongMutation` — singleton avoids context dependency)
**And** `web/src/hooks/use-setlist-mutation.test.tsx` (NEW) covers:
- enqueueing a new setlist: outbox contains one entry; per-setlist cache holds the record; list cache holds the record
- enqueueing an edit (existing setlist): outbox coalesces; caches updated
- `mergeSetlistIntoList` cases: empty list + new → length 1; existing list + same setlistId replaces (no duplicate)
**And** uses `import 'fake-indexeddb/auto';` + `__resetOutboxForTests()` in `beforeEach` + stubs `flushOnce` via `vi.mock('../sync/flusher.js', ...)`

**AC-14 — `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build:web` all green; final commit checkpoint**

**Given** the implementation is complete
**When** verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages — new files (`shared/src/schemas/setlist.ts`, `api/src/ddb/setlists.ts`, `api/src/routes/setlists.ts`, updated `api/src/app.ts`, `web/src/sync/record-key.ts`, `web/src/sync/flusher.ts`, `web/src/api/setlists.ts`, `web/src/hooks/use-setlists.ts`, `web/src/hooks/use-setlist.ts`, `web/src/hooks/use-setlist-mutation.ts`) compile under `strict: true`
**And** `pnpm lint` is green via Biome — kebab-case filenames; camelCase identifiers; no new `biome-ignore` directives beyond patterns already in the repo
**And** `pnpm test` is green — the new test cases pass; no regressions in the existing 206 web tests / 73 api tests baseline (Story 2.6 exit count)
**And** `pnpm build:web` is green; no new runtime dependencies added
**And** `pnpm-lock.yaml` is unchanged (no new packages)
**And** `web/package.json`, `api/package.json`, `shared/package.json` are unchanged (no new runtime deps; only new source files)

**AC-15 — Commit checkpoint (Epic 2 retro Lesson #1 extension)**

**Given** the implementation is complete and all verification passes
**When** the story is marked done
**Then** an explicit commit has been created containing all new and modified files listed in AC-14
**And** `git status --porcelain` is clean (no uncommitted changes in the story's touched paths)

## Tasks / Subtasks

- [x] **Task 1 — `shared/src/schemas/setlist.ts` + shared index update** (AC: 1)
  - [x] Create `shared/src/schemas/setlist.ts` with `SongRefSchema`, `SectionSchema`, `SetlistSchema`, `SetlistPutInputSchema` and their inferred types
  - [x] Update `shared/src/index.ts` to export all four schemas and all four types from `./schemas/setlist.js`
  - [x] Run `pnpm typecheck` from repo root — confirm the shared package compiles and the new exports are visible

- [x] **Task 2 — `api/src/ddb/setlists.ts` + test** (AC: 2, 3)
  - [x] Create `api/src/ddb/setlists.ts` following `api/src/ddb/songs.ts` structure. Key derivation:
    - `pk = BAND#<bandId>`, `sk = SETLIST#<gigMeta.date>#<setlistId>`
    - `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`
    - `gsi1sk = <gigMeta.date>#<setlistId>`
  - [x] `getSetlist`: use `QueryCommand` on main table with `pk = BAND#<bandId>` + `begins_with(sk, 'SETLIST#')`, filter Items by `setlistId`. Parse with `SetlistSchema` (strip pk/sk/gsi attrs).
  - [x] `putSetlist`: `PutCommand` with all DDB key attributes included in `Item`
  - [x] `listSetlistsByBand`: `QueryCommand` on `GSI1` index: `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`; no sort-key condition (return all); `ScanIndexForward: true` (ascending date)
  - [x] Create `api/src/ddb/setlists.test.ts` covering AC-3 cases. Mirror `songs.test.ts` setup pattern exactly (same `mockClient`, same `beforeEach` structure)

- [x] **Task 3 — `api/src/routes/setlists.ts` + route wiring** (AC: 4, 5, 6, 7, 8)
  - [x] Create `api/src/routes/setlists.ts`. Structure:
    ```ts
    import { ACTIVE_BAND_ID, type Setlist, SetlistPutInputSchema } from '@gigbuddy/shared';
    import { Hono } from 'hono';
    import { getSetlist, listSetlistsByBand, putSetlist } from '../ddb/setlists.js';
    import { compareLww } from '../lww.js';
    // ... same summarizeZodIssues helper pattern as songs.ts
    ```
  - [x] GET `/`: `listSetlistsByBand(ACTIVE_BAND_ID)` → `{ status: 'ok', data: [...] }`
  - [x] GET `/:setlistId`: `getSetlist(ACTIVE_BAND_ID, setlistId)` → `{ status: 'ok', data }` or 404
  - [x] PUT `/:setlistId`: validate body, validate id match, validate bandId, `compareLww`, write or drop
  - [x] Create `api/src/routes/setlists.test.ts` covering AC-7 cases including the atomicity test
  - [x] Update `api/src/app.ts`: add `import { setlistsRoute } from './routes/setlists.js'` and `.route('/api/v1/setlists', setlistsRoute)`

- [x] **Task 4 — `web/src/sync/record-key.ts` extension + flusher update** (AC: 10)
  - [x] Update `web/src/sync/record-key.ts`: add `setlistRecordKey()`, extend `ParsedRecordKey` union, update `parseRecordKey` to handle `'setlist'` kind
  - [x] Update `web/src/sync/flusher.ts`:
    - Widen `PutResponseSchema` to accept both Song and Setlist response bodies (z.unknown() approach, per AC-10)
    - Add setlist branch to `routeForRecordKey` with `queryKeyForSetlist` helper
    - Extend the `routeForRecordKey` return type
    - Also updated `flusher.test.ts` "poisoned recordKey" case (was using `setlist:not:wired`, which is now a valid setlist key — switched to `gig:not:wired`)
  - [x] Update `web/src/sync/record-key.test.ts`: add `setlistRecordKey` format test and `parseRecordKey` roundtrip for setlist key (existing test asserting `setlist:band:slot` was unknown updated to use `gig:band:slot`)

- [x] **Task 5 — `web/src/api/setlists.ts` + test** (AC: 11)
  - [x] Create `web/src/api/setlists.ts` following `web/src/api/songs.ts` structure:
    - Compose `GetSetlistResponseSchema`, `PutSetlistResponseSchema` at call site
    - Export `listSetlists()`, `getSetlist()`, `putSetlist()`
  - [x] Create `web/src/api/setlists.test.ts` covering AC-11 cases (mock `fetch` same way as `songs.test.ts`)

- [x] **Task 6 — Hooks: `use-setlists.ts`, `use-setlist.ts`, `use-setlist-mutation.ts` + tests** (AC: 12, 13)
  - [x] Create `web/src/hooks/use-setlists.ts` with `useSetlists()` hook
  - [x] Create `web/src/hooks/use-setlists.test.tsx` — fresh `QueryClient` per test, `retry: false`
  - [x] Create `web/src/hooks/use-setlist.ts` with `useSetlist(setlistId: string | null)` hook
  - [x] Create `web/src/hooks/use-setlist.test.tsx` — same pattern
  - [x] Create `web/src/hooks/use-setlist-mutation.ts` with `useSetlistMutation()` + `mergeSetlistIntoList()`
  - [x] Create `web/src/hooks/use-setlist-mutation.test.tsx` — `import 'fake-indexeddb/auto'` + `__resetOutboxForTests` + stub `flushOnce`

- [x] **Task 7 — Verification pass** (AC: 14)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green via Biome
  - [x] `pnpm test` green — api 73 → 103 (+30), web 206 → 233 (+27); shared 26 and infra 51 unchanged. (E2E suite failing on a pre-existing authenticated-fixture gap documented in commit 91e8e41 — explicitly out of Story 3.1 scope per "Files this story does NOT touch".)
  - [x] `pnpm build:web` green; no new runtime deps; `pnpm-lock.yaml` unchanged

- [ ] **Task 8 — Commit checkpoint** (AC: 15) _(deferred — orchestration workflow owns the commit after review steps pass; dev-story phase intentionally leaves changes uncommitted)_
  - [ ] `git add` all new and modified files listed in AC-14
  - [ ] `git commit` with a descriptive message
  - [ ] Confirm `git status --porcelain` is clean

## Dev Notes

### This story's scope

Story 3.1 is the **server + sync foundation** for Epic 3. It is API-only on the server side and plumbing-only on the web side. No user-visible UI is added. Stories 3.2–3.6 build on these primitives.

What this story delivers:
- `SetlistSchema` in `shared/` (the AR-4 Zod contract)
- `api/src/ddb/setlists.ts` wrapper (AR-42 boundary)
- `api/src/routes/setlists.ts` (GET list, GET single, PUT with LWW)
- Flusher + record-key extended for `'setlist'` kind
- Web API client functions (`listSetlists`, `getSetlist`, `putSetlist`)
- Three web hooks (`useSetlists`, `useSetlist`, `useSetlistMutation`)

What this story does NOT deliver (owned by later stories):
- Any React route or UI component (3.2–3.6)
- The `upcoming-gigs` endpoint used by the deploy blackout check (architecture.md AR-40) — this was intentionally deferred; Story 3.1 adds the Setlist CRUD only
- Paste-to-parse logic (`web/src/paste-parse/`) — Story 3.5
- `web/src/hooks/use-tonight-gig.ts` — Story 3.2 (needs the home surface to be meaningful)
- Any router.tsx updates — Story 3.2

### Architecture compliance (the contract you must follow)

**AR-9 (architecture.md line 133):** DynamoDB `gigbuddy-data` single-table. Setlist content embedded (sections + song refs + annotations) for atomic LWW writes. Single item = single PUT = atomic.

**AR-10 (architecture.md line 134):** GSI1 — `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, `gsi1sk = <isoDate>#<setlistId>`. This drives the Home surface (Story 3.2) Tonight/Upcoming/Past sectioning. The index was provisioned in Story 1.3's CDK stack — Story 3.1 just queries it.

**AR-11 (architecture.md line 135):** `titleSnapshot` on each `SongRef` so renaming a Song never rewrites historical Setlists. **The Setlist PUT never reads the Songs table.** The client supplies `titleSnapshot` at write time.

**AR-23 (architecture.md line 151):** Whole-record PUT semantics. The `sections[]` array (including all `songs[]` and all `perGigAnnotation` values) is replaced atomically on every PUT. No per-section or per-song merging.

**AR-42 (architecture.md line 184):** All DDB access via `api/src/ddb/*` wrappers. Routes never import `@aws-sdk/client-dynamodb` directly. `api/src/ddb/setlists.ts` is the only legal DDB import surface for Setlists.

**AR-45 (architecture.md line 185):** UI consumes hooks only. `useSetlistMutation` is the legal seam. No route or component imports `sync/outbox.ts` directly.

**AR-47 / AR-48 (architecture.md lines 189-190):** NanoID 16-char IDs; ISO-8601 UTC timestamps; DDB key prefixes SCREAMING_SNAKE_CASE with `#` separator.

### Patterns to reuse exactly

**`compareLww` (api/src/lww.ts):**
```ts
// Already generic over T extends { clientWrittenAt: string }
// Story 2.3 retro point 6 notes this was deliberate forward-design for Story 3.1
import { compareLww } from '../lww.js';
const verdict = compareLww(parsed.data, existing);
```
Do NOT rewrite or duplicate LWW logic. The same function, zero changes.

**`songs.ts` DDB wrapper structure:**
```ts
// songs.ts pattern — replicate for setlists.ts:
// 1. function xKey(bandId, xId) → { pk, sk }
// 2. getSong → GetCommand with key; SetlistSchema.parse(rest) after stripping pk/sk
// 3. putSong → PutCommand with { ...keyObj, ...record }
// 4. listSongsByBand → QueryCommand with begins_with(sk, 'SONG#')
// For setlists: replace GetCommand with QueryCommand (sk composite key issue)
```

**`songs.ts` route structure:**
```ts
// songs.ts pattern — replicate for setlists.ts:
function summarizeZodIssues(error) { ... }  // same helper, copy verbatim
const setlistsRoute = new Hono()
  .get('/', ...)
  .get('/:setlistId', ...)
  .put('/:setlistId', ...);
```

**`useSongMutation` hook structure (web/src/hooks/use-song-mutation.ts):**
```ts
// useSetlistMutation mirrors useSongMutation exactly, replacing:
// - Song → Setlist
// - songId → setlistId
// - songRecordKey → setlistRecordKey
// - ['song', bandId, songId] → ['setlist', bandId, setlistId]
// - ['songs', bandId] → ['setlists', bandId]
// - mergeSongIntoList → mergeSetlistIntoList
// The mergeSetlistIntoList function replaces by setlistId only (no alphabetical sort needed)
```

**`songs.test.ts` DDB mock pattern:**
```ts
// Mirror exactly — same import order, same mockClient(getDocClient()), same beforeEach pattern
const ddbMock = mockClient(getDocClient());
// ...
beforeEach(() => {
  process.env.TABLE_NAME = 'gigbuddy-data-test';
  ddbMock.reset();
});
```

### GSI1 index name

The CDK data stack created GSI1. The index name is `'gsi1'` (lowercase, no spaces). Verify this matches `infra/lib/stacks/data-stack.ts` before assuming. The architecture doc says `gsi1pk` / `gsi1sk` as attribute names.

Check the actual CDK index configuration:
```bash
grep -n 'globalSecondaryIndexes\|indexName\|gsi' /Users/sandy/dev/gigbuddy/infra/lib/stacks/data-stack.ts
```

If the index name differs from `'gsi1'`, use the actual name. This is the most likely source of a runtime failure on first test.

### `getSetlist` key design trade-off

The sk for a Setlist is `SETLIST#<isoDate>#<setlistId>`. A `GetCommand` requires the full, exact sk. Since the API route receives only `setlistId` (not `isoDate`), `getSetlist` must use a `QueryCommand` filtered by setlistId. This works at V1 single-tenant volume (at most a few hundred setlists per band). Alternative: store an additional item with sk = `SETLIST_META#<setlistId>` pointing to the full sk — but that adds complexity not warranted in V1. Document this trade-off in the wrapper's comment block.

### Flusher PutResponseSchema widening

The current flusher has:
```ts
const PutResponseSchema = z.discriminatedUnion('status', [
  AppliedResponseSchema(SongSchema),
  DroppedAsStaleResponseSchema(SongSchema),
  ErrorResponseSchema,
]);
```

Story 3.1 needs the flusher to also handle Setlist PUT responses. The simplest approach is to widen the inner data types to `z.unknown()` since the flusher only needs the envelope `status` field to dispatch (it does not deep-use `data` or `currentState` — it passes `body.currentState` to `queryClientRef?.setQueryData` but that just stores the raw value):

```ts
const PutResponseSchema = z.discriminatedUnion('status', [
  AppliedResponseSchema(z.unknown()),
  DroppedAsStaleResponseSchema(z.unknown()),
  ErrorResponseSchema,
]);
```

This compiles, passes the envelope validation, and satisfies the flusher's dispatch requirements. The cost is that TypeScript loses the `data` and `currentState` type precision — but the flusher already ignores the typed record beyond passing it to the cache. The cache stores `unknown` values and the consuming hook (useSong/useSetlist) validates via its own schema on read.

If you choose a different approach (split schemas, dispatch before parsing), document the choice in Dev Notes of the story.

### `ACTIVE_BAND_ID` import

`ACTIVE_BAND_ID` is already exported from `@gigbuddy/shared` (added in Story 2.3, see `shared/src/active-band.ts` or `shared/src/index.ts`). Both `api/src/routes/songs.ts` and `web/src/hooks/use-songs.ts` already import it from there. Do NOT re-import from `web/src/lib/band.ts` (which re-exports it — it's the same value but using the canonical shared source is the contract).

### Setlist test data helper

Create a `makeSetlist` helper in each test file (same pattern as `makeSong` in `songs.test.ts`):
```ts
function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: BAND_ID,
    setlistId: 'abc123setlist001',
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [
          { songId: 'song0000000001ab', titleSnapshot: 'Round Midnight' },
          { songId: 'song0000000002cd', titleSnapshot: 'Autumn Leaves', perGigAnnotation: 'start slow' },
        ],
      },
    ],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1,
    ...overrides,
  };
}
```

### Files this story modifies — current state

#### `shared/src/index.ts` (UPDATE)
**Current state:** Exports `active-band`, `schemas/api`, `schemas/auth`, `schemas/band`, `schemas/client-error`, `schemas/song`.
**This story adds:** `export * from './schemas/setlist.js';`
**Must preserve:** All existing exports verbatim.

#### `api/src/app.ts` (UPDATE)
**Current state:** Wires `loggerMiddleware`, `serverNowMiddleware`, `authMiddleware`, `healthRoute`, `authRoute`, `meRoute`, `songsRoute`, `clientErrorsRoute`.
**This story adds:** import + `.route('/api/v1/setlists', setlistsRoute)` after songsRoute.
**Must preserve:** All existing route registrations and their order (middleware chains are order-dependent).

#### `web/src/sync/record-key.ts` (UPDATE)
**Current state:** Exports `songRecordKey`, `ParsedRecordKey` (union with `'song' | 'unknown'` kinds), `parseRecordKey`.
**This story adds:** `setlistRecordKey`, extends `ParsedRecordKey` with `'setlist'` kind, extends `parseRecordKey` handler.
**Must preserve:** Existing `songRecordKey`, `'song'` parsing logic, `'unknown'` fallback — all unchanged.

#### `web/src/sync/flusher.ts` (UPDATE)
**Current state:** `PutResponseSchema` wraps `SongSchema`. `routeForRecordKey` handles `'song'` only; returns `{ kind: 'unknown' }` for everything else.
**This story adds:** Setlist response schema widening + setlist branch in `routeForRecordKey`.
**Must preserve:** Song path through `routeForRecordKey` unchanged. `queryKeyForSong` unchanged. All retry/backoff logic unchanged. `setFlusherQueryClient`, `__resetFlusherForTests`, `backoffMs`, `startFlusher` — all unchanged.

### Files this story does NOT touch (regression safety)

- `web/src/sync/outbox.ts` — no changes; `enqueue` accepts generic `payload: unknown` already
- `web/src/sync/query-client.tsx` — singleton unchanged
- `web/src/sync/flusher.ts` — only the schema and routeForRecordKey parts change; all retry logic untouched
- `api/src/lww.ts` — already generic; no changes needed
- `api/src/ddb/songs.ts` — unchanged
- `api/src/routes/songs.ts` — unchanged
- `web/src/api/songs.ts` — unchanged
- `web/src/hooks/use-song*.ts` — unchanged
- `web/src/routes/*.tsx` — no UI routes in this story
- `web/src/router.tsx` — unchanged (Stories 3.2+ add routes)
- `infra/**` — GSI1 was already provisioned in Story 1.3; no CDK changes
- `e2e/**` — no E2E tests in this story (API-level coverage is in unit tests)

### Epic 2 retro lessons applied here

**Lesson #1 (marked done / not committed gap):** Task 8 is an explicit final commit checkpoint. Do not mark story done before the commit.

**Lesson #2 (dev agent silently deletes TypeScript-flagged options):** When widening `PutResponseSchema`, if TypeScript flags anything about the schema change, do not revert — find the correct fix. The _intent_ is to accept both Song and Setlist envelopes. Document any TypeScript gymnastics required.

**Lesson #3 (fake timers + userEvent deadlock):** Story 3.1 has no debounce tests. If you need timer-based tests in future tasks, use real timers + `waitFor`.

**Lesson #4 (new directories need Biome/tsconfig coverage):** All new files in this story go under directories already covered:
- `shared/src/schemas/` — existing directory, covered by `shared/tsconfig.json`
- `api/src/ddb/`, `api/src/routes/` — existing directories
- `web/src/api/`, `web/src/hooks/`, `web/src/sync/` — existing directories
No tsconfig or Biome config changes required.

### Testing count expectation

At Story 2.6 close: **web 206, api 73**.

Story 3.1 additions:
- `api/src/ddb/setlists.test.ts`: ~10 cases
- `api/src/routes/setlists.test.ts`: ~15 cases (including atomicity test)
- `web/src/api/setlists.test.ts`: ~8 cases
- `web/src/hooks/use-setlists.test.tsx`: ~3 cases
- `web/src/hooks/use-setlist.test.tsx`: ~4 cases
- `web/src/hooks/use-setlist-mutation.test.tsx`: ~6 cases
- `web/src/sync/record-key.test.ts` additions: ~3 cases

Expected final counts: **web ~230, api ~98** (approximate; exact counts depend on how many assertions become separate `it` blocks).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `pnpm typecheck` — all 5 packages green
- `pnpm lint` — Biome green after auto-format applied to `api/src/ddb/setlists.ts` and `api/src/ddb/setlists.test.ts` (long function signature + long object literals split per Biome's printWidth)
- `pnpm -r --filter=\!e2e run test` — shared 26, infra 51, api 103 (was 73; +30), web 233 (was 206; +27). All unit suites green.
- `pnpm build:web` — green; bundle size unchanged from prior story; PWA SW regenerated.
- `pnpm-lock.yaml` and all `package.json` files — untouched.

### Completion Notes List

- **GSI1 index name correction:** The spec's Dev Notes flagged that the spec author *assumed* `'gsi1'` (lowercase) for the IndexName. CDK's `infra/lib/stacks/data-stack.ts:38` actually provisions it as `'GSI1'` (uppercase). I used `'GSI1'` per the architecture reality. Tests assert against `'GSI1'`. Updated Task 2 checklist line accordingly.
- **Flusher PutResponseSchema widening (AC-10):** Implemented the `z.unknown()` widening exactly as the spec prescribed; removed the now-unused `SongSchema` import.
- **Test breakage from new `setlist:` recognition:** Two existing tests asserted `setlist:band:slot` / `setlist:not:wired` as *unknown* recordKeys. After this story they're valid setlist keys. Updated both (`web/src/sync/record-key.test.ts`, `web/src/sync/flusher.test.ts`) to use `gig:` / `gig:not:wired` for the "truly unknown prefix" assertions. The setlist roundtrip / format-check coverage is added in `record-key.test.ts`.
- **E2E suite status:** `e2e/smoke/shell.spec.ts` fails on `pnpm test` because the only test there hits the authenticated shell without a session-cookie fixture. Commit 91e8e41 (`Wire Playwright + Vite to start the API for E2E`) explicitly tracks this as a deferred follow-up; the story spec excludes `e2e/**` from scope. Unit-test counts above are the green coverage line.
- **Commit checkpoint deferred:** AC-15 / Task 8 owned by the orchestration workflow per the dev-story instructions ("DO NOT create a git commit. Leave changes uncommitted in the working tree"). All listed files exist in the working tree, ready for the review pass to commit.

### File List

**NEW files:**
- `shared/src/schemas/setlist.ts`
- `api/src/ddb/setlists.ts`
- `api/src/ddb/setlists.test.ts`
- `api/src/routes/setlists.ts`
- `api/src/routes/setlists.test.ts`
- `web/src/api/setlists.ts`
- `web/src/api/setlists.test.ts`
- `web/src/hooks/use-setlists.ts`
- `web/src/hooks/use-setlists.test.tsx`
- `web/src/hooks/use-setlist.ts`
- `web/src/hooks/use-setlist.test.tsx`
- `web/src/hooks/use-setlist-mutation.ts`
- `web/src/hooks/use-setlist-mutation.test.tsx`

**UPDATED files:**
- `shared/src/index.ts`
- `api/src/app.ts`
- `web/src/sync/record-key.ts`
- `web/src/sync/record-key.test.ts`
- `web/src/sync/flusher.ts`
- `web/src/sync/flusher.test.ts` (poisoned-prefix test recordKey changed from `setlist:not:wired` to `gig:not:wired` — see Completion Notes)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress, then → review on completion)

### Change Log

- 2026-06-19 — Implemented Story 3.1 Setlist API + DDB persistence + sync plumbing. Adds `SetlistSchema` (shared), `api/src/ddb/setlists.ts` wrapper, `api/src/routes/setlists.ts` (GET list / GET single / PUT with LWW), extends flusher + record-key for `'setlist'` kind, web API client (`listSetlists` / `getSetlist` / `putSetlist`), and three hooks (`useSetlists` / `useSetlist` / `useSetlistMutation`). 30 new api tests, 27 new web tests. No new runtime deps.
