---
baseline_commit: "6622390"
builds_on: 4-4-end-performance-state-on-navigate-away-last-song-inert-next
---

# Story 4.5: Backgrounding survives + Tonight-Gig pre-fetch + `/api/v1/upcoming-gigs` (FR-22, AR-25, AR-40)

Status: review

## Story

As Sandy,
I want the app to survive being backgrounded mid-Performance (re-opening lands on the current Performance Card, not Home), and I want every iPhone foreground to silently pre-fetch tonight's Setlist if a Gig is within 24h,
So that going on stage doesn't depend on a fresh network round-trip, and a mid-set OS interruption doesn't lose my place.

## Acceptance Criteria

**AC-1 — `GET /api/v1/upcoming-gigs` endpoint**

**Given** `api/src/routes/upcoming-gigs.ts`
**When** `GET /api/v1/upcoming-gigs` is called with a valid auth cookie
**Then** the handler queries GSI1 for the active Band, filtering to Setlists with `gigMeta.date` within the next 24h Europe/London
**And** the response is `{status: 'ok', data: [{setlistId, gigMeta: {venue, date, time}, songRefs: [{songId, titleSnapshot, perGigAnnotation?}]}]}` — minimum fields needed to drive prefetch (full Setlist record can be returned too; the contract is "enough to prefetch downstream")
**And** the response includes `x-server-now` (automatically stamped by the existing `serverNowMiddleware`)

**AC-2 — Shared 24h query semantics**

**Given** the `/api/v1/upcoming-gigs` endpoint
**When** invoked from the deploy blackout check (Story 1.6) OR from the foreground-prefetch logic
**Then** both callers receive a consistent contract
**And** the deploy blackout check (`infra/scripts/blackout-check.ts`) and this API endpoint share the same query semantics (24h Europe/London window, same GSI1 key pattern)

**AC-3 — Client: Tonight-Gig pre-fetch on iPhone foreground**

**Given** `web/src/cache/prefetch.ts`
**When** the iPhone PWA enters the foreground (`visibilitychange` to `visible`)
**Then** the prefetch logic checks `isIPhone()`; if false it returns immediately (MacBook does not run this prefetch)
**And** it reads upcoming gigs via the `useUpcomingGigs()` TanStack Query hook (queryKey `['upcoming-gigs', ACTIVE_BAND_ID]`, queryFn calls `/api/v1/upcoming-gigs`) — per the epic's named mechanism. The prefetch path invokes `queryClient.prefetchQuery` against the same key so the cache is shared with any future consumer of the hook.
**And** for each upcoming Gig within 24h, it calls `queryClient.prefetchQuery` for the Setlist queryKey AND for each referenced Song queryKey (keys MUST exactly match `useSetlist` / `useSong` to land in the same cache slot)
**And** prefetches are background / non-blocking — they do NOT block UI

**AC-4 — Cache-hit on `Start performance ›` after foreground prefetch**

**Given** the prefetch runs successfully
**When** Sandy later taps `Start performance ›` on the prefetched Setlist
**Then** the synchronous prefetch in `onStartPerformance` (Story 4.1) returns immediately from cache (cache hits)
**And** the cold-render-to-card-visible time is well within the 300ms budget (NFR-2)

**AC-5 — Silent failure when offline**

**Given** the prefetch runs while offline
**When** the network call fails
**Then** the prefetch is silent — no toast, no banner, no log to the user (per FR-31 / AR-28)
**And** if a Gig was already cached from a previous online prefetch, the cache remains usable

**AC-6 — Backgrounding mid-Performance: state survives**

**Given** the iPhone OS backgrounds the PWA during Performance Mode
**When** `visibilitychange` to `hidden` fires
**Then** `performanceActive` REMAINS `true`
**And** the current Song index, Section position, and route state are preserved (React Router URL-driven state is already preserved by the browser history)
**And** the OS may release Wake Lock automatically (Story 4.2 handles reacquire on foreground — no new action needed here)
**And** `endPerformance()` (Story 4.4) is NOT called on background/hidden — that would break backgrounding survival

**AC-7 — Foregrounding mid-Performance: re-renders current card**

**Given** the iPhone OS foregrounds the PWA mid-Performance
**When** `visibilitychange` to `visible` fires AND `performanceActive === true`
**Then** the app re-renders the SAME Performance Card the user was on (no advance, no retreat, no reset — FR-22)
**And** no interstitial screen appears (no splash, no "Resuming...", no auth check redirect — per AR-28)
**And** the Wake Lock reacquisition from Story 4.2 fires automatically (via the existing `visibilitychange` handler in `wake-lock.ts` — no new code needed)
**And** the Tonight-Gig prefetch from AC-3 ALSO fires (no harm — most queries are cache hits)

**AC-8 — OS-kill and PWA relaunch mid-Gig**

**Given** the iPhone OS killed the PWA process and Sandy relaunches from the home-screen icon mid-Gig
**When** the SPA boots
**Then** the boot sequence calls `GET /api/v1/me` (NetworkOnly via SW)
**And** if the network returns 200, the app proceeds normally; if unavailable, the cached app shell renders and the cached Setlist + Songs load (per FR-31 / NFR-8)
**And** the boot flow reads a `gigbuddy_active_performance` marker from `localStorage` (persisted on entry / cleared on end — see AC-13 below). If the marker carries `{setlistId, songIndex}`, the router navigates to `/performance/<setlistId>/<songIndex>` BEFORE first paint and `performance-card.tsx` mounts. The component's existing mount-effect calls `setActive(true)`, which reactivates `PerformanceModeContext.performanceActive = true` so AR-28 invariants re-engage (per the epic AC-8 "via persisting the flag" example mechanism).
**And** if the marker is missing or corrupt, the app lands on the home-screen URL (`/`) as normal — no error surfaces.

**AC-13 — `localStorage` session marker lifecycle**

**Given** `web/src/performance/session-resume.ts` (NEW)
**When** the URL transitions into a route matching `/performance/:setlistId/:songIndex`
**Then** the module writes `{setlistId, songIndex}` to `localStorage['gigbuddy_active_performance']` as JSON
**And** when the URL leaves any `/performance/` route, the module removes the key
**And** the writer is driven by URL changes (subscribed via React Router's `useLocation()` in a top-level effect inside `app-bootstrap.tsx` or `authenticated-shell.tsx`), so the marker is consistent with `performanceActive` without coupling to context internals or to Stories 4.1 / 4.4 code paths.
**And** all `localStorage` operations are wrapped in `try/catch` — a quota or access exception is silent and never throws past the module.

**AC-9 — 24h time-window logic shared or identical**

**Given** the prefetch logic and the deploy blackout check both consume "upcoming gigs" semantics
**When** the implementations are reviewed
**Then** the time-window logic (24h Europe/London via the named IANA TZ) is shared OR replicated identically with self-tests in both places (per Story 1.6 self-test requirement extended to client side)

**AC-10 — Unit tests: API**

**Given** `api/src/routes/upcoming-gigs.test.ts` (NEW)
**When** tests run
**Then** the following cases pass:
  - Returns 200 with `{status: 'ok', data: [...]}` for gigs within 24h
  - Returns 200 with `{status: 'ok', data: []}` when no upcoming gigs
  - Returns 401 when auth cookie missing (auth middleware enforces this — no explicit test needed in the route tests; covered by the auth middleware tests)
  - `x-server-now` header is present on response

**Given** `api/src/ddb/gigs.ts` (NEW)
**When** tests cover the DDB query function
**Then** `listUpcomingGigs(bandId, todayIso, tomorrowIso)` returns only setlists within the 24h window

**AC-11 — Unit tests: web prefetch**

**Given** `web/src/cache/prefetch.test.ts` (NEW)
**When** tests run
**Then** the following cases pass:
  - On non-iPhone (`isIPhone()` returns false): `onForeground()` does NOT call `prefetchQuery`
  - On iPhone with no upcoming gigs within 24h: no `prefetchQuery` calls
  - On iPhone with a gig within 24h: `prefetchQuery` called for the setlist and each referenced song
  - On iPhone with prefetch error (fetch throws): no error surfaces, no toast, no banner (silent)
  - `onForeground` is registered as the `visibilitychange → visible` handler

**AC-12 — Verification pass**

**Given** the implementation is complete
**When** the following run
**Then** `pnpm typecheck` passes across all five packages
**And** `pnpm lint` passes (no new `biome-ignore` directives)
**And** `pnpm test` passes with no regressions; Story 4.4 baseline was **web 546 / api 103 / shared 26**
**And** `pnpm build:web` succeeds

## Tasks / Subtasks

- [x] **Task 1 — Read existing files before touching anything** (prerequisite — non-negotiable)
  - [x] Read `api/src/routes/setlists.ts` end-to-end (understand the Hono route pattern to replicate for `upcoming-gigs.ts`)
  - [x] Read `api/src/ddb/setlists.ts` end-to-end (understand `listSetlistsByBand` and the GSI1 query pattern — `gigs.ts` will use the same GSI)
  - [x] Read `api/src/ddb/client.ts` (understand `getDocClient()` and `getTableName()` — required for any new DDB query)
  - [x] Read `api/src/app.ts` (understand how routes are registered — the new route must be added here)
  - [x] Read `infra/scripts/blackout-check.ts` (understand the 24h Europe/London window logic used by the deploy check — `gigs.ts` must share the same semantics; `londonIsoDate()` is the key helper)
  - [x] Read `web/src/performance/wake-lock.ts` (confirm the existing `visibilitychange → visible` handler in the module — the prefetch listener must be separate and NOT interfere with it)
  - [x] Read `web/src/hooks/use-tonight-gig.ts` and `web/src/lib/gig-date.ts` (understand `sectionSetlists()`, `todayLondon()`, and how "tonight" is determined — the prefetch may reuse this hook or the TanStack query for the setlists list)
  - [x] Read `web/src/sync/query-client.tsx` (understand the `queryClient` singleton export — prefetch.ts calls `queryClient.prefetchQuery()` directly)
  - [x] Read `web/src/lib/platform.ts` (confirm `isIPhone()` export — prefetch is iPhone-only per AR-25)
  - [x] Read `web/src/routes/performance-card.tsx` (understand how it sets `performanceActive` on mount — needed to assess AC-8 relaunch recovery)
  - [x] Read `web/src/hooks/use-navigate-away-guard.ts` (confirm it does NOT call `endPerformance()` on `visibilitychange` to `hidden` — backgrounding must not trigger end-state)
  - [x] Read `api/src/routes/setlists.test.ts` (understand the Hono route test pattern with `vi.hoisted` mocks — replicate for `upcoming-gigs.test.ts`)

- [x] **Task 2 — Implement `api/src/ddb/gigs.ts`** (NEW file — AC: 1, 2, 9, 10)
  - [x] Import `QueryCommand` from `@aws-sdk/lib-dynamodb`, `getDocClient` and `getTableName` from `./client.js`
  - [x] Import `SetlistSchema, type Setlist` from `@gigbuddy/shared` — the query returns full `Setlist` records, so no new shape is introduced at the DDB layer
  - [x] Export `async function listUpcomingGigs(bandId: string, todayIso: string, tomorrowIso: string): Promise<Setlist[]>` — queries GSI1 with `KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk BETWEEN :from AND :to'` using `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, `gsi1sk` range `todayIso#` to `tomorrowIso#zzzz` (same pattern as `blackout-check.ts` scan)
  - [x] Handle pagination (cursor loop identical to `listSetlistsByBand`)
  - [x] Strip DDB key attrs before returning (`pk`, `sk`, `gsi1pk`, `gsi1sk`) — reuse `SetlistSchema.parse()` from `@gigbuddy/shared`
  - [x] NOTE: Replicate the 24h Europe/London window inline using `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(at)`. Do **not** import `londonIsoDate` from `infra/scripts/blackout-check.ts` — `infra/` is CDK/deploy tooling and is not a consumable library per the architecture boundary table. The Story 1.6 self-test requirement (AC-9) is met by adding a co-located self-test in `api/src/ddb/gigs.test.ts` that asserts the inline helper matches the blackout-check semantics for a fixed input.

- [x] **Task 3 — Implement `api/src/routes/upcoming-gigs.ts`** (NEW file — AC: 1, 2, 10)
  - [x] Import `ACTIVE_BAND_ID` from `@gigbuddy/shared`, `Hono` from `hono`, `listUpcomingGigs` from `../ddb/gigs.js`
  - [x] Compute today and tomorrow in `Europe/London` at request time (same `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' })` pattern)
  - [x] Export `const upcomingGigsRoute = new Hono().get('/', async (c) => { ... })` returning `c.json({ status: 'ok' as const, data: gigs })`
  - [x] Auth is enforced by the global `authMiddleware` — the route itself needs no explicit auth check
  - [x] Register the route in `api/src/app.ts`: `.route('/api/v1/upcoming-gigs', upcomingGigsRoute)`
  - [x] Create `api/src/routes/upcoming-gigs.test.ts` with test cases (AC-10): mock `listUpcomingGigs` via `vi.hoisted`; test 200 with data, 200 with empty array; verify `x-server-now` header is present; verify 401 without auth cookie

- [x] **Task 4a — Add `useUpcomingGigs` hook in `web/src/hooks/use-upcoming-gigs.ts`** (NEW file — supports AC-3 via the epic's named mechanism)
  - [x] `useQuery({ queryKey: ['upcoming-gigs', ACTIVE_BAND_ID], queryFn: () => listUpcomingGigs() })` — TanStack Query v5 form, mirrors `use-setlist.ts` shape
  - [x] Export the `UPCOMING_GIGS_QUERY_KEY` builder so `prefetch.ts` and the hook share the exact same key
  - [x] No JSX in this file — `.ts`, not `.tsx`

- [x] **Task 4b — Implement `web/src/cache/prefetch.ts`** (NEW file — AC: 3, 4, 5, 11)
  - [x] Import `queryClient` from `../sync/query-client.js`
  - [x] Import `isIPhone` from `../lib/platform.js`
  - [x] Import `UPCOMING_GIGS_QUERY_KEY`, `listUpcomingGigs` from `../hooks/use-upcoming-gigs.js` (and `../api/gigs.js` for the queryFn)
  - [x] Read the exact TanStack query keys used by `useSetlist` and `useSong` before finalizing — `prefetchQuery` keys MUST match exactly or there is no cache hit
  - [x] `onForeground()` function: if `!isIPhone()` return early; call `queryClient.prefetchQuery({ queryKey: UPCOMING_GIGS_QUERY_KEY, queryFn: () => listUpcomingGigs() })`; read the cached data via `queryClient.getQueryData(UPCOMING_GIGS_QUERY_KEY)`; for each gig, call `queryClient.prefetchQuery` for the Setlist queryKey (with the matching `queryFn`); then for each song in `setlist.sections.flatMap(s => s.songs)`, call `queryClient.prefetchQuery` for the Song queryKey (with the matching `queryFn`); wrap everything in `try/catch` — silent on any error (no throw, no toast)
  - [x] Register the `visibilitychange` handler at module load: `if (typeof document !== 'undefined') { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { void onForeground(); } }); }` — same pattern as `wake-lock.ts`
  - [x] Export `onForeground` for testability
  - [x] Ensure `prefetch.ts` is imported at app boot so the `visibilitychange` listener is registered. Check `web/src/main.tsx` or the app entry point and add an import if not already present.
  - [x] Create `web/src/cache/prefetch.test.ts` with test cases (AC-11)

- [x] **Task 5 — Implement `web/src/api/gigs.ts`** (NEW file — query function for upcoming-gigs)
  - [x] This is the client-side fetch function (parallel to `web/src/api/setlists.ts` and `web/src/api/songs.ts`)
  - [x] Reuse `SetlistSchema` from `@gigbuddy/shared` — the API returns full `Setlist[]` records (per the epic AC-1 "full Setlist record can be returned too" contract note), so no new wire shape is introduced
  - [x] Export `async function listUpcomingGigs(): Promise<Setlist[]>` using `apiFetch('/api/v1/upcoming-gigs', { method: 'GET', schema: OkResponseSchema(z.array(SetlistSchema)) })`
  - [x] Do **not** define a parallel `UpcomingGigSchema` or hand-written `UpcomingGig` type. Per CLAUDE.md "Zod schemas in `shared/` are the single source of truth. Never define a parallel TypeScript `type` or `interface` for the same record shape." If a future story actually needs a slimmer wire shape, the schema goes in `shared/` and the type is `z.infer<typeof X>`.

- [x] **Task 6 — Verify backgrounding survival is already handled (AC: 6, 7)**
  - [x] Confirm that `visibilitychange` to `hidden` does NOT call `endPerformance()` anywhere — the `use-navigate-away-guard.ts` uses `useLocation()` which only fires on router navigation, not on backgrounding
  - [x] Confirm that `wake-lock.ts` already has the `visibilitychange → visible && performanceActive` handler for Wake Lock reacquisition (Story 4.2 — read the module end to confirm the listener is registered at module scope)
  - [x] If any gap is found, add a note in Dev Notes and address it (likely no code change needed)

- [x] **Task 6b — Implement `web/src/performance/session-resume.ts`** (NEW — AC: 8, 13)
  - [x] Export `readSessionMarker(): { setlistId: string; songIndex: number } | null` — reads `localStorage['gigbuddy_active_performance']`, parses JSON, validates shape, returns `null` on any error (try/catch wraps all `localStorage` access)
  - [x] Export `syncSessionMarker(pathname: string): void` — on a `/performance/:setlistId/:songIndex` pathname, writes `{setlistId, songIndex}` as JSON to `localStorage['gigbuddy_active_performance']`; on any other pathname, removes the key (silent on quota/access errors)
  - [x] Wire the writer: in `app-bootstrap.tsx` (or `authenticated-shell.tsx`), call `syncSessionMarker(useLocation().pathname)` from a top-level `useEffect` so every route change updates the marker
  - [x] Wire the reader: in `app-bootstrap.tsx`, on initial mount, if `window.location.pathname === '/'` AND `readSessionMarker()` returns a marker, call `navigate('/performance/<setlistId>/<songIndex>', { replace: true })` BEFORE the first paint. `performance-card.tsx` then mounts and sets `performanceActive=true` via its existing entry path.
  - [x] Create `web/src/performance/session-resume.test.ts`:
    - `syncSessionMarker('/performance/sl1/3')` writes JSON `{"setlistId":"sl1","songIndex":3}`
    - `syncSessionMarker('/setlists/sl1')` removes the key
    - `readSessionMarker()` returns the parsed object after a valid write
    - `readSessionMarker()` returns `null` for missing key, malformed JSON, or schema mismatch
    - `syncSessionMarker` swallows `localStorage` exceptions (Safari private mode quota=0)

- [x] **Task 7 — Wire `prefetch.ts` import into app boot** (AC: 3)
  - [x] Check `web/src/main.tsx` or the app entry — find where the sync layer and `wake-lock.ts` are first imported so module-scope side effects run
  - [x] Add `import './cache/prefetch.js'` at the same level (side-effect import to register the `visibilitychange` listener)
  - [x] Alternatively, import `onForeground` at a higher-level component that is always mounted — same effect

- [x] **Task 8 — Verification pass** (AC: 12)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green (no new `biome-ignore` directives)
  - [x] `pnpm test` green — no regressions vs. Story 4.4 baseline (web 546 / api 103 / shared 26); new tests pass
  - [x] `pnpm build:web` green

(Commit is handled by the epic-run workflow per CLAUDE.md "Commit cadence" — not a story-level AC.)

## Dev Notes

### What this story delivers

Story 4.5 completes Epic 4 Performance Mode with four distinct pieces:

1. **`/api/v1/upcoming-gigs` endpoint** (AC-1, AC-2) — a new API route that queries DDB GSI1 for Setlists within the next 24h Europe/London. Returns full `Setlist[]` per AC-1's "full Setlist record can be returned too" contract. The 24h window helper is replicated inline from `infra/scripts/blackout-check.ts` (no cross-package import — `infra/` is CDK/deploy tooling); a co-located self-test asserts the inline helper matches blackout-check semantics for AC-9.

2. **Tonight-Gig background pre-fetch** (AC-3, AC-4, AC-5) — a `visibilitychange` listener in `web/src/cache/prefetch.ts` that fires on every iPhone foreground. Reads upcoming gigs via the new `useUpcomingGigs()` hook's query key (`UPCOMING_GIGS_QUERY_KEY`) — matching the epic's named mechanism — and silently pre-fetches the upcoming Setlist + Songs. Non-blocking, non-interactive, iPhone-only.

3. **Backgrounding survival** (AC-6, AC-7) — confirms existing architecture handles this. The `use-navigate-away-guard.ts` hook fires on router navigation (not `visibilitychange`), so backgrounding never triggers end-state. The `wake-lock.ts` singleton already reacquires on foreground.

4. **OS-kill resume marker** (AC-8, AC-13) — `web/src/performance/session-resume.ts` writes a tiny `localStorage` marker `{setlistId, songIndex}` whenever the URL is inside `/performance/`, clears it on URL exit. On boot, if the URL is `/` AND a marker is present, the boot flow navigates to the marked URL before first paint, which mounts `performance-card.tsx` and reactivates `performanceActive=true` via the existing entry path. No changes to Story 4.1 / 4.4 code; no new persistence in `PerformanceModeContext`.

**What this story does NOT deliver:**
- Any changes to `×` exit or navigate-away detection (Stories 4.3, 4.4 own those)
- Full session-state serialization (just the route marker — the Setlist + Song record cache is already in IndexedDB via the TanStack Query persister from Story 2.4)
- Any new UI affordances — all prefetching and resume is silent
- No changes to `shared/` schemas — the upcoming-gigs API reuses the existing `SetlistSchema`

### Critical: Do NOT call `endPerformance()` on `visibilitychange` to `hidden`

The `useNavigateAwayGuard` (Story 4.4) uses `useLocation()` from React Router — this only fires when React Router performs a navigation, never on `document.visibilityState` changes. So backgrounding does NOT trigger end-state. This is the correct behavior for AC-6.

**Trap for the dev agent:** Do NOT add any `visibilitychange → hidden` logic that calls `endPerformance()`. That would break the entire "backgrounding survives" requirement.

### API route: `api/src/routes/upcoming-gigs.ts`

Pattern from `setlists.ts`:

```ts
import { ACTIVE_BAND_ID } from '@gigbuddy/shared';
import { Hono } from 'hono';
import { listUpcomingGigs } from '../ddb/gigs.js';

// Europe/London today — same helper as blackout-check.ts
function londonIsoDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export const upcomingGigsRoute = new Hono()
  .get('/', async (c) => {
    const now = new Date();
    const today = londonIsoDate(now);
    const tomorrow = londonIsoDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const gigs = await listUpcomingGigs(ACTIVE_BAND_ID, today, tomorrow);
    return c.json({ status: 'ok' as const, data: gigs });
  });
```

Register in `api/src/app.ts` by adding `.route('/api/v1/upcoming-gigs', upcomingGigsRoute)` after the existing routes.

### DDB query for upcoming gigs: `api/src/ddb/gigs.ts`

The GSI1 key shape for setlists is:
- `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`
- `gsi1sk = <isoDate>#<setlistId>`

To get gigs within 24h, query GSI1 with:
```
gsi1sk BETWEEN :todayKey AND :tomorrowKey
```
where:
- `:todayKey = "<today>#"` (inclusive start)
- `:tomorrowKey = "<tomorrow>#zzzz"` (inclusive end, the `zzzz` suffix ensures all setlistId values for that date are included — matches the `blackout-check.ts` pattern)

The `listSetlistsByBand` function in `ddb/setlists.ts` uses `gsi1pk` KeyCondition only (no range on `gsi1sk`). The `gigs.ts` query adds a range condition on `gsi1sk`. Use `QueryCommand` from `@aws-sdk/lib-dynamodb`.

Full query:
```ts
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SetlistSchema, type Setlist } from '@gigbuddy/shared';
import { getDocClient, getTableName } from './client.js';

const GSI1_INDEX_NAME = 'GSI1';

export async function listUpcomingGigs(
  bandId: string,
  todayIso: string,
  tomorrowIso: string
): Promise<Setlist[]> {
  const client = getDocClient();
  const out: Setlist[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: getTableName(),
        IndexName: GSI1_INDEX_NAME,
        KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `BAND#${bandId}#SETLIST_BY_DATE`,
          ':from': `${todayIso}#`,
          ':to': `${tomorrowIso}#zzzz`,
        },
        ScanIndexForward: true,
        ExclusiveStartKey: cursor,
      }),
    );
    for (const item of result.Items ?? []) {
      const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g2, ...rest } = item;
      out.push(SetlistSchema.parse(rest));
    }
    cursor = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  return out;
}
```

### TanStack Query keys — CRITICAL: must match existing hooks

Before writing `prefetch.ts`, READ these files to get the exact query keys:
- `web/src/hooks/use-setlist.ts` — key for individual setlist (likely `['setlist', ACTIVE_BAND_ID, setlistId]` or `['setlist', setlistId]`)
- `web/src/hooks/use-song.ts` — key for individual song (likely `['song', ACTIVE_BAND_ID, songId]` or `['song', songId]`)

**If the keys used in `prefetchQuery` do not EXACTLY match the keys used in the hooks, there will be no cache hit and the pre-fetch will be pointless.** This is a critical correctness requirement.

### Client-side `prefetch.ts` architecture

```ts
// web/src/cache/prefetch.ts
// Pre-fetch rules (architecture.md §Pre-fetch rules, AR-25)

import { queryClient } from '../sync/query-client.js';
import { isIPhone } from '../lib/platform.js';
import { listUpcomingGigs } from '../api/gigs.js';
import { UPCOMING_GIGS_QUERY_KEY } from '../hooks/use-upcoming-gigs.js';
// Import ACTIVE_BAND_ID and query key builders from hooks or shared

export async function onForeground(): Promise<void> {
  if (!isIPhone()) return;
  try {
    // Warm the upcoming-gigs cache slot that useUpcomingGigs() will read.
    await queryClient.prefetchQuery({
      queryKey: UPCOMING_GIGS_QUERY_KEY,
      queryFn: () => listUpcomingGigs(),
    });
    const gigs = queryClient.getQueryData<Setlist[]>(UPCOMING_GIGS_QUERY_KEY) ?? [];
    for (const gig of gigs) {
      void queryClient.prefetchQuery({
        queryKey: ['setlist', ACTIVE_BAND_ID, gig.setlistId], // verify key matches use-setlist.ts
        queryFn: () => getSetlist(gig.setlistId),
      });
      for (const ref of gig.sections.flatMap((s) => s.songs)) {
        void queryClient.prefetchQuery({
          queryKey: ['song', ACTIVE_BAND_ID, ref.songId], // verify key matches use-song.ts
          queryFn: () => getSong(ref.songId),
        });
      }
    }
  } catch {
    // Silent — no toast, no banner, no log (AR-28, FR-31)
  }
}

// Register singleton listener at module load (same pattern as wake-lock.ts)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void onForeground();
    }
  });
}
```

**Why the hook + prefetchQuery split:** the epic AC names `useUpcomingGigs()` as the read mechanism — we honour that by adding the hook in Task 4a and reusing its query key (`UPCOMING_GIGS_QUERY_KEY`) for `prefetchQuery` inside `onForeground`. The prefetch warms the same cache slot that `useUpcomingGigs()` would read, so any future consumer of the hook gets the warm data for free. The hook + prefetch share `listUpcomingGigs` from `web/src/api/gigs.ts`.

### Background survival: confirming the existing architecture

1. **`visibilitychange → hidden`**: The only subscriber to this event (besides the browser) is `wake-lock.ts`'s module-scope listener — but that listener only calls `acquire()` when `visibilityState === 'visible'`. On `hidden`, nothing happens. `endPerformance()` is NOT called.

2. **`useNavigateAwayGuard`** (Story 4.4): Uses `useLocation()` from React Router — only fires on router navigations. Backgrounding does not change `location.pathname`, so the guard does not fire.

3. **URL state**: React Router's URL (`/performance/:setlistId/:songIndex`) is preserved by iOS Safari/PWA in the session history even when the app is backgrounded. When foregrounded, React renders the same URL → same `performance-card.tsx` → same state. No explicit state restoration code needed.

4. **OS-kill relaunch (AC-8 / AC-13)**: On cold relaunch, the PWA loads `index.html` (from cache if offline). iOS resets the URL to the manifest `start_url` (`/`), so a pure URL-driven restore won't work. The fix in this story is a small `localStorage` marker written whenever the URL is inside `/performance/:setlistId/:songIndex` and cleared whenever the URL leaves that prefix (see `session-resume.ts`, Task 6b). On boot, if the URL is `/` AND the marker is present, the boot flow performs a `navigate(..., { replace: true })` to the marked URL BEFORE first paint. `performance-card.tsx` then mounts and sets `performanceActive=true` via the existing entry path — no new persistence inside `PerformanceModeContext`, no changes to Story 4.1 / 4.4 code.

   The epic AC-8 names two acceptable mechanisms: "via persisting the flag in IndexedDB or by URL signal". This story uses the URL-signal mechanism with `localStorage` as the carry across cold launch — it's a thin shim, not full session serialization. The Setlist + Song record cache is already persisted via the TanStack Query IndexedDB persister (Story 2.4); only the route marker needs to ride the relaunch.

### Checking `performance-card.tsx` for AC-8

Read `web/src/routes/performance-card.tsx` (from Story 4.1) to confirm: it sets `performanceActive=true` on mount via the existing entry path. This means once the boot flow has navigated to `/performance/:setlistId/:songIndex` (driven by the localStorage marker), `performanceActive` reactivates naturally. No new code is needed inside the route component itself for this story.

### `api/src/routes/upcoming-gigs.test.ts` test pattern

Follow the `setlists.test.ts` pattern exactly:

```ts
const { getJwtKeyMock, listUpcomingGigsMock } = vi.hoisted(() => ({
  getJwtKeyMock: vi.fn(),
  listUpcomingGigsMock: vi.fn(),
}));

vi.mock('../secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
  getPasswordHash: vi.fn(),
}));

vi.mock('../ddb/gigs.js', () => ({
  listUpcomingGigs: listUpcomingGigsMock,
}));

import { app } from '../app.js';
import { signSession } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';
```

Test cases:
1. Returns 200 `{status: 'ok', data: []}` for no upcoming gigs (mock returns `[]`)
2. Returns 200 `{status: 'ok', data: [setlist]}` for one upcoming gig
3. Returns 401 without auth cookie (no mock needed — auth middleware handles)
4. Response includes `x-server-now` header (`res.headers.get('x-server-now')` is not null)

### `web/src/cache/prefetch.test.ts` test pattern

Use `vi.stubGlobal('document', ...)` or test `onForeground` directly without the event listener:

```ts
// Mock isIPhone, queryClient, and the API function
vi.mock('../lib/platform.js', () => ({ isIPhone: isIPhoneMock }));
vi.mock('../sync/query-client.js', () => ({ queryClient: { prefetchQuery: prefetchQueryMock } }));
vi.mock('../api/gigs.js', () => ({ listUpcomingGigs: listUpcomingGigsMock }));

// Then call onForeground() directly and assert prefetchQuery was/wasn't called
```

This approach tests `onForeground()` without requiring actual DOM event registration.

### Architecture compliance checklist

- **FR-22:** `performanceActive` REMAINS `true` on backgrounding. No `endPerformance()` called. Backgrounding survival confirmed by existing architecture.
- **AR-25:** Pre-fetch runs on every iPhone foreground (`visibilitychange → visible`). Scoped to `isIPhone()`. Background / non-blocking. `Start performance ›` synchronous prefetch already implemented in Story 4.1.
- **AR-28:** Prefetch failure is silent. No toast, no banner, no auth-failure redirect triggered.
- **AR-40:** `/api/v1/upcoming-gigs` endpoint exists and is used by both the foreground-prefetch logic and the deploy blackout check.
- **AR-42:** All DDB access in `api/src/ddb/gigs.ts` only — no raw DDB imports in routes.
- **AR-46:** No analytics SDK, no Redux/Zustand, no CSS-in-JS.
- **AR-47:** NanoID IDs — no change; setlistId/songId values already follow this pattern.
- **NFR-2:** `Start performance ›` cold-render-to-card-visible ≤300ms — met by cache hit from foreground prefetch.
- **NFR-8:** Performance Mode runs fully offline-capable — the pre-fetched cache satisfies this.
- **Locked design constraint:** Visual direction is LOCKED — this story has NO UI changes whatsoever. Everything is backend + background logic.

### Files to create / update

**New files:**
- `api/src/ddb/gigs.ts` — `listUpcomingGigs(bandId, todayIso, tomorrowIso)` DDB query
- `api/src/routes/upcoming-gigs.ts` — `GET /api/v1/upcoming-gigs` Hono route
- `api/src/routes/upcoming-gigs.test.ts` — unit tests
- `web/src/api/gigs.ts` — client-side fetch function for upcoming-gigs
- `web/src/cache/prefetch.ts` — foreground pre-fetch rules (AR-25)
- `web/src/cache/prefetch.test.ts` — unit tests

**Updated files:**
- `api/src/app.ts` — register `upcomingGigsRoute` at `/api/v1/upcoming-gigs`
- `web/src/main.tsx` (or equivalent entry) — side-effect import of `./cache/prefetch.js` to register `visibilitychange` listener
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 4-5 → in-progress → review (on completion)

**No changes needed:**
- `web/src/performance/wake-lock.ts` — already handles `visibilitychange → visible && performanceActive` for Wake Lock reacquisition (Story 4.2)
- `web/src/hooks/use-navigate-away-guard.ts` — correct as-is; does not fire on background
- `web/src/performance/performance-context.tsx` — no changes needed
- `shared/` — only add schema if the API returns a new shape not covered by `SetlistSchema`

### Test count projection

Story 4.4 exit: **web 546 / api 103 / shared 26**

New tests to add (estimate):
- `upcoming-gigs.test.ts` (api): ~4 cases
- `prefetch.test.ts` (web): ~5 cases
- `gigs.ts` (api, if separately tested): ~3 cases (optional — covered by route test mocks)

Expected Story 4.5 final: **web ~551, api ~107–110, shared 26 unchanged**

### Handoff note

Story 4.5 is the last story in Epic 4. After this story's commit, run the Epic 4 retrospective (`bmad-retrospective`).

Epic 5 (Export & Verified Restore Ship-Gate) is the final epic — stories 5.1 and 5.2 are both in `backlog` state.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-dev-story workflow

### Debug Log References

- Initial `pnpm lint` flagged formatting on `web/src/main.tsx` (multi-line `history.replaceState` call). Fixed by inlining the arguments to one line.
- Intermittent flake in `app-bootstrap.test.tsx:173` (waitFor timeout in the `pnpm test` monorepo run). The test passes consistently when web tests run in isolation and on a re-run of the full suite. The new code in `main.tsx` runs before React mounts and only mutates `window.history.replaceState` when `window.location.pathname === '/'` AND `readSessionMarker()` returns a marker — both conditions are false in the jsdom test environment, so the test isn't impacted in steady state.

### Completion Notes List

- AC-1/2/9/10 (API): `api/src/ddb/gigs.ts` exports `listUpcomingGigs(bandId, todayIso, tomorrowIso)` querying GSI1 with `BETWEEN :from AND :to` on `gsi1sk` and an inline `londonIsoDate` helper replicated verbatim from `infra/scripts/blackout-check.ts`. The co-located `gigs.test.ts` includes the AC-9 self-test asserting the helper matches the blackout-check semantics for representative BST/GMT/DST instants.
- The route `api/src/routes/upcoming-gigs.ts` is the thin Hono `.get('/')` handler registered in `app.ts` at `/api/v1/upcoming-gigs`. Auth + `x-server-now` are inherited from global middleware.
- AC-3/4/5/11 (web prefetch): `web/src/cache/prefetch.ts` registers a singleton `visibilitychange` listener (same pattern as `wake-lock.ts`) and exports `onForeground()`. The function is iPhone-gated (early return on `!isIPhone()`), warms the `UPCOMING_GIGS_QUERY_KEY` slot, then fires `void queryClient.prefetchQuery(...)` for each Setlist + Song using the EXACT keys `useSetlist` / `useSong` use (`['setlist', ACTIVE_BAND_ID, id]` / `['song', ACTIVE_BAND_ID, id]`). All wrapped in a top-level `try/catch` for silent failure (AR-28, FR-31).
- AC-3 hook: `web/src/hooks/use-upcoming-gigs.ts` exports `useUpcomingGigs()` + `UPCOMING_GIGS_QUERY_KEY` constant — shared by the prefetch so any future consumer of the hook gets the warm data for free. No UI mounts the hook in this story.
- AC-6/7 (backgrounding survival): verified no `visibilitychange → hidden` handler calls `endPerformance()`. `endPerformance()` is only called from `use-navigate-away-guard.ts` which uses `useLocation()` (router navigations only, not visibility changes). `wake-lock.ts` already reacquires on `visibilitychange → visible && performanceActive`. URL state is preserved by browser history. No new code needed.
- AC-8/13 (OS-kill resume): `web/src/performance/session-resume.ts` exports `readSessionMarker()` + `syncSessionMarker(pathname)`. The writer is wired in `AuthenticatedShell` (a `useEffect` keyed off `useLocation().pathname`) so every URL change updates the marker. The reader runs once in `main.tsx` BEFORE React mounts — when `window.location.pathname === '/'` and a marker is present, it uses `window.history.replaceState(...)` to swap the URL so the router lands on the Performance Card on first paint. All `localStorage` access is `try/catch`-wrapped (Safari private mode safe).
- AC-12 verification: `pnpm typecheck` green across all five packages. `pnpm lint` green (no new `biome-ignore`). `pnpm test` green — web 566 / api 117 / shared 26 (up from baseline web 546 / api 103 / shared 26 by exactly +20 web tests for prefetch + session-resume, +14 api tests for gigs DDB + upcoming-gigs route). `pnpm build:web` succeeded (463.67 kB bundle, 137.78 kB gzipped).

### File List

**Added**
- `api/src/ddb/gigs.ts`
- `api/src/ddb/gigs.test.ts` (self-test for the inline 24h-window helper, AC-9)
- `api/src/routes/upcoming-gigs.ts`
- `api/src/routes/upcoming-gigs.test.ts`
- `web/src/api/gigs.ts`
- `web/src/hooks/use-upcoming-gigs.ts` (TanStack Query hook; key shared with prefetch)
- `web/src/cache/prefetch.ts`
- `web/src/cache/prefetch.test.ts`
- `web/src/performance/session-resume.ts`
- `web/src/performance/session-resume.test.ts`

**Modified**
- `api/src/app.ts` (register `/api/v1/upcoming-gigs`)
- `web/src/main.tsx` (side-effect import for `prefetch.ts`; pre-mount `readSessionMarker` → `history.replaceState` for AC-8)
- `web/src/routes/authenticated-shell.tsx` (wire `syncSessionMarker` to `useLocation()` via top-level `useEffect`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-5-backgrounding-survives-tonight-gig-pre-fetch-upcoming-gigs.md`

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-06-21 | Claude Sonnet 4.6 (bmad-create-story) | Created Story 4.5 spec: backgrounding survives + Tonight-Gig pre-fetch + /api/v1/upcoming-gigs endpoint. |
| 2026-06-21 | Claude (spec-review round 2) | AC-3 now matches the epic's named `useUpcomingGigs()` mechanism (new Task 4a adds the hook; prefetch reuses its query key). AC-8 contradiction resolved: a small `localStorage` marker (new `session-resume.ts`, AC-13) carries the active `/performance/...` URL across iOS cold launch, matching the epic's "URL signal" example. Task 2 inline-replicates the London 24h helper (no `infra/` import — cross-package boundary). Task 5 reuses `SetlistSchema` (no parallel `UpcomingGigSchema`; no hand-written `UpcomingGig` type — per CLAUDE.md "Zod in shared/ is the single source of truth"). |
| 2026-06-21 | Claude Opus 4.7 (bmad-dev-story) | Implemented Story 4.5. New `api/src/ddb/gigs.ts` + route + tests; new `web/src/api/gigs.ts`, `web/src/hooks/use-upcoming-gigs.ts`, `web/src/cache/prefetch.ts` + test; new `web/src/performance/session-resume.ts` + test. Wired prefetch side-effect import + pre-mount `readSessionMarker` in `main.tsx`, and `syncSessionMarker` writer in `AuthenticatedShell`. AC-9 self-test asserts inline `londonIsoDate` matches blackout-check semantics. AC-12 green: typecheck/lint/build all pass; tests web 566 / api 117 / shared 26 (Story 4.4 baseline +20 web / +14 api). Status → review. |
