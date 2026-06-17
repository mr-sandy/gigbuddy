---
baseline_commit: 84cdc0f
builds_on: 2-3-song-api-ddb-persistence-client-errors-endpoint
---

# Story 2.4: Sync layer foundation + client error reporter

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want a TanStack Query + IndexedDB persistence cache, a custom outbox with per-record coalescing, and a client-side error reporter wired to `window.onerror` / `unhandledrejection` / React `ErrorBoundary`,
so that optimistic writes survive offline, conflicts resolve LWW silently, the cache survives reload, and unexpected client errors land in CloudWatch.

## Acceptance Criteria

**AC-1 — `web/src/sync/query-client.ts` exports a single `QueryClient` + an IndexedDB persister; the cache survives page reload**

**Given** `web/src/sync/query-client.ts` (NEW)
**When** reviewed
**Then** the file exports `queryClient: QueryClient` — a single module-scope instance constructed once at import time (mirrors the existing `web/src/main.tsx` pattern but moved into the sync layer so all sync code shares one instance)
**And** the file exports `persister: AsyncStoragePersister` — built via `createAsyncStoragePersister({ storage: ... })` from `@tanstack/query-async-storage-persister`, where the storage adapter is a thin wrapper around `idb-keyval`'s `get(key)` / `set(key, value)` / `del(key)` calls against an IndexedDB store named `gigbuddy-query-cache`
**And** the persister uses key `'gigbuddy-query-cache-v1'` and `maxAge: Infinity` (architecture.md does not impose a TTL; cache freshness is owned by TanStack Query's per-query `staleTime`, not the persister)
**And** the file exports a `<SyncProvider>` React component that wraps children in `PersistQueryClientProvider` (from `@tanstack/react-query-persist-client`) with `client={queryClient}`, `persistOptions={{ persister, buster: 'v1' }}`
**And** `<SyncProvider>` is mounted in `web/src/main.tsx` REPLACING the existing bare `QueryClientProvider` wiring; the `web/src/main.tsx` import of `QueryClient` / `QueryClientProvider` is removed
**And** when a Vitest case mounts `<SyncProvider><App/></SyncProvider>`, the rendered tree is the same as the existing `<QueryClientProvider>`-wrapped tree (the persister hydrates from the configured storage and then renders normally)
**And** a Vitest case proves the queryClient is reused across multiple `<SyncProvider>` mounts (mount twice in the same test; `queryClient.setQueryData(['test'], 1)` from the first mount is visible inside the second mount) — this is the contract that downstream hooks (Story 2.5+) rely on
**And** the file does NOT call `persistQueryClient` imperatively — the `PersistQueryClientProvider` component owns the restore/dehydrate lifecycle (it gates render on the initial restore — required so `Library` / `SongDetail` never see stale-then-replaced cache state on first paint)

**AC-2 — `web/src/sync/persist.ts` requests `navigator.storage.persist()` on app boot; non-blocking; logs the result**

**Given** `web/src/sync/persist.ts` (NEW)
**When** reviewed
**Then** it exports `async function requestPersistentStorage(): Promise<boolean>` that returns `true` if `navigator.storage.persist()` resolved to `true`, `false` otherwise (including when `navigator.storage` is absent — older browsers / non-iPhone test envs)
**And** the function catches any error from `navigator.storage.persist()` and returns `false` (defensive — Safari's promise has been observed to reject in some private-window contexts)
**And** the function logs the outcome at debug level via a single `console.log(JSON.stringify({ level: 'info', msg: 'storage-persist', granted }))` call (one structured line, parallel to the server's log shape) — visible in DevTools, never surfaced in the UI
**And** `web/src/main.tsx` (or `web/src/app-bootstrap.tsx`) calls `requestPersistentStorage()` ONCE on boot — it is fire-and-forget; the call does NOT await before rendering (the architecture's "non-blocking boot" rule — AR-21)
**And** the call site is gated on `isIPhone()` from `web/src/lib/platform.ts` — there is no benefit to requesting persistent storage on MacBook (Safari/Chrome desktop never evict the same way iOS Safari does), and limiting the call keeps the boot path simple
**And** a Vitest case stubs `navigator.storage = { persist: () => Promise.resolve(true) }` and asserts `requestPersistentStorage()` resolves `true`; another stubs `persist()` to reject and asserts `false`; another deletes `navigator.storage` and asserts `false`

**AC-3 — `web/src/sync/outbox.ts` exposes an IndexedDB-backed outbox with `enqueue`, `peek`, `markInFlight`, `markPending`, `remove`, `listAll`**

**Given** `web/src/sync/outbox.ts` (NEW)
**When** reviewed
**Then** the file exports the `OutboxEntry` TypeScript type matching architecture.md §Outbox state machine (lines 590–603) verbatim:
```typescript
export type OutboxEntry = {
  id: string;                  // NanoID, 16-char URL-safe (per AR-47)
  recordKey: string;           // e.g., 'song:<bandId>:<songId>'
  op: 'PUT';                   // PUT only in V1
  payload: unknown;            // whole-record body
  clientWrittenAt: string;     // ISO-8601, set at enqueue
  status: 'pending' | 'in-flight';
  attempts: number;            // 0 on first enqueue; increments on retry
};
```
**And** the file exports async functions backed by a dedicated IndexedDB object store:
  - `enqueue(input: { recordKey: string; payload: unknown; clientWrittenAt: string }): Promise<OutboxEntry>` — applies the coalesce rules (AC-4), generates `id` via `nanoid(16)`, sets `status='pending'`, `attempts=0`, persists the entry, returns it
  - `peek(): Promise<OutboxEntry | undefined>` — returns the oldest `status='pending'` entry by `clientWrittenAt` ascending, or `undefined`
  - `markInFlight(id: string): Promise<void>` — flips an entry's `status` from `pending` to `in-flight`. Throws if the entry is absent or already `in-flight` (a logic bug — the flusher must call `peek()` first)
  - `markPending(id: string, attempts: number): Promise<void>` — flips an entry back to `pending` after a 5xx/network failure; sets `attempts` to the supplied number (the flusher computes `existing.attempts + 1`)
  - `remove(id: string): Promise<void>` — deletes the entry. Idempotent: removing an absent id is a no-op (a stale flusher tick could call this after the entry was coalesced away)
  - `listAll(): Promise<OutboxEntry[]>` — returns every entry ordered by `clientWrittenAt` ascending. Used by tests and (future) `useOutboxStatus()` hook (Story 5+; do NOT create the hook here)
**And** all functions go through ONE shared IndexedDB handle defined in `web/src/cache/idb.ts` (NEW — see AC below)
**And** a test-only `__resetOutboxForTests(): Promise<void>` is exported (clears the IDB store between cases); it is NOT re-exported from any barrel — only consumed by `*.test.ts`
**And** the file is the ONLY module in `web/` that imports the IndexedDB outbox-store handle from `web/src/cache/idb.ts` — the rest of the sync layer calls `outbox.*` exports (per AR-45 "UI never imports `sync/outbox.ts` directly" — Story 2.4 lands the module; consumers are the flusher in this story and `useSongMutation()` in Story 2.6)
**And** `web/src/cache/idb.ts` (NEW) exposes a minimal `idb-keyval`-style API over a custom IndexedDB store named `gigbuddy-outbox` with the entry's `id` as the key — pick one of:
  - re-export `idb-keyval`'s `createStore` + `get`/`set`/`del`/`entries` with a `gigbuddy-outbox` store, OR
  - hand-roll the `IDBDatabase` open with `objectStoreNames: ['outbox']` and expose `outboxGet(id)`, `outboxSet(id, value)`, `outboxDel(id)`, `outboxEntries()` async helpers
  
  Either is acceptable; the first is shorter and matches the persister's storage adapter pattern. If you pick `idb-keyval`'s `createStore`, the package's typed API is sufficient — no need to author primitive `idb.ts` helpers beyond the named `Store` constant export

**AC-4 — Outbox enqueue applies coalesce-by-recordKey: max 2 entries per `recordKey` (one in-flight + one pending)**

**Given** `outbox.enqueue({ recordKey: 'song:<bandId>:<songId>', payload, clientWrittenAt })` is called
**When** the enqueue rules from architecture.md §Outbox state machine (lines 605–608) are applied
**Then** the implementation:
  - **Rule 1 (replace pending):** if there is an existing entry for the same `recordKey` with `status='pending'`, REPLACE that entry in place — preserve its `id` (so an `inFlight` race is impossible: an `id` cannot be coalesced if another module took a reference to it) but overwrite `payload`, `clientWrittenAt`, and reset `attempts` to 0
  - **Rule 2 (append after in-flight):** if there is an existing entry with `status='in-flight'` for the same `recordKey` AND no `pending` entry, append a NEW entry with a fresh NanoID (max 2 per recordKey at any time)
  - **Rule 3 (first-write):** if no existing entry exists for the recordKey, append a NEW entry
**And** the implementation NEVER produces more than 2 entries for the same `recordKey` at any point in time
**And** the per-recordKey scan is read-modify-write inside a single IDB transaction — concurrent enqueues for the same key are serialised by the IDB transaction queue (the architecture's "outbox is current-best-state per record" contract — the worst observable race is "two enqueues, second one wins," which is exactly the desired behaviour)
**And** a Vitest case proves: enqueue A (pending) → enqueue B same recordKey → `listAll()` returns one entry with B's payload; mark A in-flight via the wrapper → enqueue C → `listAll()` returns two entries (A in-flight, C pending); enqueue D same recordKey → `listAll()` returns two entries (A in-flight unchanged, D pending replacing C)
**And** a Vitest case proves: enqueue A (recordKey X), B (recordKey Y), C (recordKey X) → `listAll()` returns two entries — A REPLACED by C, B untouched (cross-recordKey isolation)

**AC-5 — `web/src/sync/flusher.ts` orchestrates outbox drain: 200 applied / 200 dropped-as-stale / 4xx / 5xx & network handling per architecture spec**

**Given** `web/src/sync/flusher.ts` (NEW)
**When** reviewed
**Then** it exports `async function flushOnce(): Promise<'idle' | 'flushed' | 'retry-scheduled' | 'busy'>` — the unit of work for a single tick. Behaviour:
  - `peek()` for the oldest pending; if `undefined` → return `'idle'`
  - if another invocation is already in flight (single in-process semaphore via a module-scope `let isFlushing = false` boolean) → return `'busy'`
  - `markInFlight(entry.id)`; build the request from `entry.recordKey` (parse `'song:<bandId>:<songId>'` → URL `/api/v1/songs/:songId`); call the fetch wrapper (AC-7) with method `PUT` and the entry's `payload`
  - **On `200 applied`:** `outbox.remove(entry.id)`; call `queryClient.invalidateQueries({ queryKey: keyFor(recordKey) })` (the recordKey-to-queryKey conversion lives in this file — see below); return `'flushed'`
  - **On `200 dropped-as-stale`:** `outbox.remove(entry.id)`; call `queryClient.setQueryData(keyFor(recordKey), parsedBody.currentState)` (replaces cache atomically with the server's view); call `staleNoticeStore.set({ recordKey, currentState, at: new Date().toISOString() })` (AC-8 owns the store); return `'flushed'`
  - **On 4xx (excluding 401):** `outbox.remove(entry.id)`; log `console.error('outbox-flush 4xx — schema bug', { recordKey, status, body })`; do NOT retry (architecture line 615 — "schema bug") → return `'flushed'`
  - **On 401:** `outbox.markPending(entry.id, entry.attempts + 1)`; do NOT call `queryClient.invalidateQueries` (we don't want to evict the cached optimistic write); the fetch wrapper itself triggers the auth-state transition (AC-9) — the flusher just leaves the entry pending; return `'retry-scheduled'`
  - **On 5xx OR fetch rejection (network failure):** `outbox.markPending(entry.id, entry.attempts + 1)`; schedule `setTimeout(scheduleNext, backoffMs(attempts))` (see AC-6 for the schedule); return `'retry-scheduled'`
  - In `finally` of the catch around `markInFlight → fetch → response handling`, the semaphore (`isFlushing = false`) is released
**And** the recordKey-to-URL mapping is a single switch on the prefix: `song:` → `PUT /api/v1/songs/:songId`. The function `recordKeyToRoute(recordKey)` returns `{ method: 'PUT', url, queryKey }`. Future stories add `setlist:` (Story 3.1). If the prefix is unrecognised, log an error, remove the entry (it's poisoned), return `'flushed'`
**And** `recordKey` parsing helpers are in `web/src/sync/record-key.ts` (NEW) exporting `songRecordKey(bandId, songId): string` returning `'song:<bandId>:<songId>'` and `parseRecordKey(key): { kind: 'song'; bandId; songId } | { kind: 'unknown' }`. Story 3.1 will add `setlistRecordKey()` and extend the union — leave a comment in the file noting that location
**And** the function `startFlusher(): () => void` is exported — it wires the retry triggers from AC-6 and returns an unsubscribe function (for test teardown). The main app boot calls `startFlusher()` once after `<SyncProvider>` mounts (in `app-bootstrap.tsx` or a `useEffect` inside `<SyncProvider>` — pick whichever keeps the wiring testable; the test-friendly option is the imperative `startFlusher()` call from `main.tsx` after `<SyncProvider>` is rendered, with an unsubscribe-on-HMR-dispose hook in dev)
**And** comprehensive Vitest cases cover each branch via mocked `fetch` and a real IndexedDB-backed outbox (`fake-indexeddb` devDep — see AC-12): applied removes entry + invalidates query; dropped-as-stale removes entry + replaces cache + sets stale notice; 4xx removes entry + logs error + no retry; 401 leaves entry pending; 5xx marks pending + schedules retry; network failure marks pending + schedules retry; double-fire while busy returns `'busy'`

**AC-6 — Retry triggers: `online`, `visibilitychange` to visible, 30s timer; exponential backoff per attempt count**

**Given** the flusher's retry orchestration
**When** `startFlusher()` is called
**Then** the flusher subscribes to:
  - `window.addEventListener('online', () => flushOnce())`
  - `document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushOnce(); })`
  - A 30-second interval timer (`setInterval(flushOnce, 30_000)`) that ONLY runs while at least one entry exists in the outbox (use `setInterval` started after the first enqueue and cleared when `listAll()` returns empty)
**And** the per-entry backoff is computed by a pure function `backoffMs(attempts: number): number` returning:
  - `attempts === 0` → 0 (first try is immediate)
  - `attempts === 1` → 5_000 (5s)
  - `attempts === 2` → 30_000 (30s)
  - `attempts >= 3` → 60_000 (60s cap)
**And** the backoff is applied via `setTimeout(() => flushOnce(), backoffMs(entry.attempts))` ONLY on the 5xx/network-failure paths (the AC-5 description)
**And** retry triggers fire even if `performanceActive === true` (the architecture does not suppress flushing during Performance Mode — only suppresses USER-VISIBLE banners; the underlying write still propagates so the cache is consistent on exit)
**And** `startFlusher()` returns an unsubscribe function that removes all three listeners and clears any pending timers
**And** a Vitest case uses `vi.useFakeTimers()` to verify the 30s timer fires `flushOnce` and that an `online` event triggers a flush; another case verifies `backoffMs(0|1|2|3|4)` returns `[0, 5_000, 30_000, 60_000, 60_000]`

**AC-7 — `web/src/api/client.ts` is the fetch wrapper: appends Content-Type, parses Zod, reports `x-server-now` drift, dispatches 401**

**Given** `web/src/api/client.ts` (NEW)
**When** reviewed
**Then** it exports `async function apiFetch<T>(path: string, opts: { method: 'GET' | 'PUT' | 'POST'; body?: unknown; schema: z.ZodTypeAny; statusValidator?: (status: number, parsed: unknown) => boolean }): Promise<{ status: number; data: T; wasNetworkSuccess: boolean }>` — every API call from the sync layer (and future hooks) goes through this wrapper
**And** the wrapper sets `credentials: 'same-origin'` and `headers: { 'content-type': 'application/json' }` (when body is present)
**And** the wrapper checks the `x-server-now` response header on EVERY response; if absent it logs a single `console.warn('apiFetch: x-server-now header missing for <path>')` (the SW NetworkFirst cache MAY occasionally serve a response without the header — diagnostic only)
**And** when `x-server-now` IS present, the wrapper computes `Math.abs(new Date(serverNow).getTime() - Date.now())` and, if the drift exceeds 30_000ms, logs `console.warn('apiFetch: clock drift', { driftMs, path })` ONCE per session (use a module-scope `let warnedAboutDrift = false` flag so the warning doesn't spam the console)
**And** the wrapper exposes `wasNetworkSuccess` to callers: `true` when the response carried the `x-server-now` header (definitive proof the response came from a live server, not a SW cache hit); `false` otherwise. This is the signal `redirect-on-401.ts` consumes (AC-9)
**And** when the response status is 401 AND `wasNetworkSuccess === true`, the wrapper calls a registered listener `onUnauthorized?.()`. The listener is installed once at app boot via `setUnauthorizedHandler(fn)` (a module-scope subscriber). Sync wiring (`app-bootstrap.tsx`, AC-9) registers a handler that transitions the AuthContext into `unauthenticated` so `RequireAuth` redirects on the next render
**And** the wrapper validates the response body via the supplied `schema` parameter (`schema.parse(json)`). On parse failure, the wrapper logs an error and re-throws (4xx-style: caller's responsibility). The schema is supplied per call because envelope shapes differ (`OkResponseSchema(SongSchema)` vs `AppliedResponseSchema(SongSchema)` vs `DroppedAsStaleResponseSchema(SongSchema)`)
**And** the wrapper does NOT retry — retry is the flusher's job for mutations and TanStack Query's job for reads (`useQuery`'s default 3-retry behaviour applies via the QueryClient)
**And** Vitest cases cover: a 200 with `x-server-now` set; a 200 without the header (logs warn, marks `wasNetworkSuccess=false`); a 200 where the parsed `x-server-now` is 31s skewed (logs drift warn); a 401 with header (dispatches the unauthorized handler); a 401 without header (does NOT dispatch — offline-cache path); a body-parse failure (throws)

**AC-8 — `web/src/sync/stale-notice-store.ts` is a tiny pub-sub; `<StaleWriteBanner>` renders the architecture's "your earlier edit was superseded" message ON MACBOOK ONLY, NEVER inside Performance Mode**

**Given** `web/src/sync/stale-notice-store.ts` (NEW)
**When** reviewed
**Then** it exports a tiny external-store pattern compatible with `useSyncExternalStore`:
  - `setStaleNotice(notice: { recordKey: string; at: string }): void` — sets the current notice; notifies all subscribers
  - `clearStaleNotice(): void` — clears the current notice; notifies all subscribers
  - `subscribeStaleNotice(callback: () => void): () => void` — subscribes; returns unsubscribe
  - `getStaleNotice(): { recordKey: string; at: string } | null` — read snapshot for `useSyncExternalStore`
**And** the store holds AT MOST ONE notice at a time (the architecture's banner copy is generic — `Your earlier edit was superseded.` — so one notice is sufficient for V1; replace-on-new-notice is the correct semantic)
**And** the store has zero dependencies (no React imports — it is a pure module so the flusher can call it from a non-React context)

**Given** `web/src/sync/stale-write-banner.tsx` (NEW)
**When** reviewed
**Then** it exports `<StaleWriteBanner />` — a React component that:
  - Reads the current notice via `useSyncExternalStore(subscribeStaleNotice, getStaleNotice)`
  - Reads `usePerformanceActive()` from `web/src/performance/performance-context.tsx`
  - Reads `isIPhone()` from `web/src/lib/platform.ts`
  - Returns `null` if any of: notice is null; `performanceActive === true` (AR-28 — held banner); `isIPhone() === true` (iPhone is silent per FR-30 / architecture line 299)
  - Otherwise renders `role="status"` with `aria-live="polite"`, the locked copy `Your earlier edit was superseded.`, and a dismiss button (the dismiss CLEARS the notice via `clearStaleNotice()`)
  - The banner is **mounted in `web/src/routes/authenticated-shell.tsx`** alongside the existing `<ReauthBanner />` — same placement pattern, same role/aria semantics
**And** the locked copy lives in `web/src/lib/microcopy.ts` as a new constant: append a top-level `BANNERS = { staleWrite: 'Your earlier edit was superseded.' } as const` to the existing file
**And** Vitest cases for `<StaleWriteBanner />` mirror the existing `reauth-banner.test.tsx` pattern:
  - shows when notice is set, not iPhone, not performance-active
  - hides when notice is null
  - hides when `isIPhone()` is true regardless of performance state
  - hides when `usePerformanceActive()` is true (mock the context)
  - dismiss button clears the notice

**AC-9 — The 401 dispatch wires into AuthContext + `redirect-on-401`; `wasNetworkSuccess` is passed dynamically**

**Given** the deferred-work item from Story 1.5 (`shouldRedirectOn401` called with hardcoded `wasNetworkSuccess: true`) and the deferred-work item from Story 1.4 (no `daysUntilExpiry === 0` handling — out of scope for 2.4, do not address)
**When** the sync layer's fetch wrapper hits a 401 from a network-success response
**Then** the wrapper calls a registered `onUnauthorized` handler installed at app boot via `setUnauthorizedHandler`
**And** the handler (installed in `app-bootstrap.tsx`) calls `setAuth({ status: 'unauthenticated' })` on the AuthContext — this triggers `<RequireAuth>`'s re-render
**And** `<RequireAuth>` in `web/src/router.tsx` is UPDATED to pass `wasNetworkSuccess` dynamically: the value flows from the AuthContext (extend `AuthState` with an optional `lastTransitionSource?: 'network' | 'cache'` discriminator that the wrapper sets when dispatching, defaulting to `'network'` for the 401 transition since that's the only path that fires the handler — and the existing boot-time `unauthenticated` state from `fetchMe()` (which already distinguished offline → `unknown` from online-401 → `unauthenticated`) is preserved as the no-source-set baseline that means "set during boot, was a network success")
**And** the simpler alternative — leave `<RequireAuth>` calling `shouldRedirectOn401({ wasNetworkSuccess: true })` and have the wrapper NEVER dispatch on cache-hit 401 — is acceptable IF the wrapper's `wasNetworkSuccess` discrimination is provably correct (i.e., the wrapper returns `wasNetworkSuccess === true` only when the response carries `x-server-now`, which is server-stamped and therefore impossible to cache). Pick this simpler variant unless you can articulate a concrete case where it leaks. (The dev agent's note in `Completion Notes` should record the variant chosen.)
**And** Vitest cases prove: a sync-layer 401 with `x-server-now` header triggers `setAuth({ status: 'unauthenticated' })`; a sync-layer 401 WITHOUT `x-server-now` (cache-hit) does NOT trigger the handler; `<RequireAuth>` redirects to `/login` when `auth.status === 'unauthenticated'` AND `performanceActive === false`; does NOT redirect when `performanceActive === true` (AR-28)
**And** the handler installation happens in `app-bootstrap.tsx` AFTER `<SyncProvider>` mounts but BEFORE the router renders — pick one:
  - inside a `useEffect` in the bootstrap component that calls `setUnauthorizedHandler(authHandler)` on mount and `setUnauthorizedHandler(null)` on unmount, OR
  - in a `<SyncWiring>` child component mounted under `<AuthProvider>` that does the same in a `useEffect`

**AC-10 — `web/src/lib/error-reporter.ts` wires `window.onerror`, `unhandledrejection`, and a React `<ErrorBoundary>` → POST `/api/v1/client-errors`**

**Given** `web/src/lib/error-reporter.ts` (NEW)
**When** reviewed
**Then** it exports `startErrorReporter(): () => void` — installs the three listeners and returns an unsubscribe function
**And** the installed listeners:
  - `window.addEventListener('error', (e) => report({ where: 'window.onerror', message: e.message, stack: e.error?.stack, ... }))`
  - `window.addEventListener('unhandledrejection', (e) => report({ where: 'unhandledrejection', message: String(e.reason?.message ?? e.reason), stack: e.reason?.stack, ... }))`
**And** the `report(input: { where, message, stack? })` helper builds a `ClientErrorReport` payload (from `@gigbuddy/shared`) with `performanceActive: getPerformanceActiveSnapshot()` and `timestamp: new Date().toISOString()`, then POSTs to `/api/v1/client-errors` via `apiFetch` (AC-7) with `schema: z.unknown()` (the endpoint returns 204 No Content — no body schema)
**And** the POST is fire-and-forget: any rejection (network, 4xx, 5xx) is silently swallowed (`.catch(() => {})`); a failure in the error reporter MUST NOT itself raise an error (architecture line 766 — "failure of the post is itself silent (never blocks UI)")
**And** `getPerformanceActiveSnapshot()` is a module-scope accessor exported from `web/src/performance/performance-context.tsx` — see AC-11 below
**And** `web/src/components/error-boundary.tsx` (NEW) exports `<ErrorBoundary>` — a class component (React's required shape for error boundaries) that:
  - implements `componentDidCatch(error, errorInfo)` calling the same `report` helper with `where: 'react-error-boundary'`, `message: error.message`, `stack: error.stack`
  - renders `this.props.children` in the happy path and a small fallback when an error is caught — the locked copy is `Something went wrong. Try refreshing.` (append to `BANNERS` in `microcopy.ts` as `BANNERS.errorBoundary`)
  - the fallback is a plain centered text block in the active atmosphere — no retry button (Sandy reloads — V1 floor); no raw error text exposed (architecture line 751)
**And** `<ErrorBoundary>` is mounted INSIDE `<SyncProvider>` and OUTSIDE `<RouterProvider>` so that any render error in a route is caught and reported, but a SW or persister error during boot still surfaces as a JS exception caught by `window.onerror`
**And** `startErrorReporter()` is called once from `main.tsx` (or `app-bootstrap.tsx`) at boot
**And** Vitest cases:
  - dispatching a `window.dispatchEvent(new ErrorEvent('error', { ... }))` calls `fetch('/api/v1/client-errors', ...)` with a parseable `ClientErrorReport` body (mock `fetch`)
  - dispatching an `unhandledrejection` event reports the rejection
  - a child component that throws is caught by `<ErrorBoundary>`, renders the fallback, and reports
  - a failing fetch (rejected promise) inside `report()` does not raise
**And** the listener is installed ONCE — `startErrorReporter()` is idempotent (calling it twice does NOT add a second listener; track with a module-scope `let started = false`)

**AC-11 — `usePerformanceActive` + module-scope snapshot accessor for non-React subsystems**

**Given** `web/src/performance/performance-context.tsx`
**When** UPDATED
**Then** the existing `usePerformanceActive(): boolean` and `useSetPerformanceActive()` continue to work unchanged (the React-context surface is the contract; no breaking changes to the existing tests)
**And** the module gains TWO new exports for non-React consumers (the flusher in `sync/flusher.ts`, the error reporter in `lib/error-reporter.ts`):
  - `getPerformanceActiveSnapshot(): boolean` — module-scope accessor returning the most recently observed value; defaults to `false` until the React Provider has mounted at least once
  - The existing `PerformanceModeProvider` is UPDATED so that its `setActive` callback ALSO writes to the module-scope variable backing `getPerformanceActiveSnapshot()`, via a small `useEffect(() => { setSnapshot(performanceActive); }, [performanceActive])` — this keeps React state and the snapshot in sync without inverting the data flow
**And** an additional Vitest case extends `performance-context.test.tsx`:
  - `getPerformanceActiveSnapshot()` returns `false` before mount
  - mounting `<PerformanceModeProvider>` and calling `setActive(true)` causes `getPerformanceActiveSnapshot()` to return `true`
  - unmounting does NOT reset the snapshot to `false` (a separate test would-be-flake if the order matters; document the chosen behaviour — Story 4.1's `useSetPerformanceActive()` call will be the only writer of `false`, so the snapshot is consistent with the React state at all live render points)
**And** the architecture lines 1037, 290–291 are explicitly cited in the file header comment ("Flusher reads `performanceActive` context to decide whether to surface failures"; "Performance-active flag is an app-state primitive read by sync, error, and toast subsystems")
**And** the test does NOT verify the snapshot is `false` after unmount, because:
  - in a real app the Provider mounts at the root and never unmounts during a session
  - the snapshot's purpose is to give non-React subsystems a synchronous read of the most recent state — the React-mount lifecycle is not part of its contract

**AC-12 — Dependency adds, `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build:web` all green; no incidental version bumps**

**Given** the implementation complete
**When** the verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages (the new sync modules, the error reporter, the updated `<RequireAuth>`, the new tests all typecheck under `strict: true` + `noUncheckedIndexedAccess: true` + `exactOptionalPropertyTypes: true`)
**And** `pnpm lint` is green via Biome — kebab-case filenames; camelCase identifiers; no `@aws-sdk/*` imports anywhere in `web/` (boundary unchanged); the new modules carry no `// biome-ignore` directives beyond the patterns already in the repo
**And** `pnpm test` is green across all packages — new tests pass, no regressions
**And** `pnpm build:web` is green (the new packages tree-shake correctly — the persist provider, async storage persister, and idb-keyval add ~12 KB to the bundle; nanoid adds ~1 KB)
**And** `web/package.json` gains the following dependencies (exact pinned versions; the latest stable at story-write time, 2026-06-17):
  - `dependencies`:
    - `@tanstack/react-query-persist-client` ^5.101.0 (matches the resolved `@tanstack/react-query` 5.101.0 from `pnpm-lock.yaml`)
    - `@tanstack/query-async-storage-persister` ^5.101.0 (same version line)
    - `idb-keyval` ^6.2.5 (the de-facto IndexedDB wrapper; tiny, no deps)
    - `nanoid` ^5.1.11 (16-char URL-safe IDs per AR-47; v5 is ESM-only, matches the rest of the workspace)
  - `devDependencies`:
    - `fake-indexeddb` ^6.0.0 (Vitest-compatible IndexedDB shim; required for `outbox.test.ts` and `flusher.test.ts`)
**And** `pnpm-lock.yaml` reflects ONLY the five added packages and their transitive deps; no incidental version bumps to existing pinned versions (verify the lockfile diff is bounded)
**And** the `@tanstack/react-query` peer requirement is already satisfied (the persist-client peer is `^5.101.0`; the workspace resolves `@tanstack/react-query` to 5.101.0 via the existing `^5.59.0` spec — no bump needed)
**And** `api/package.json`, `shared/package.json`, `infra/package.json`, `e2e/package.json` are unchanged (Story 2.4 is web-only)

**AC-13 — Sync layer tests cover the canonical scenarios (online/offline, 5xx, stale, rapid coalesce)**

**Given** the sync layer's test suite
**When** the cases listed below are exercised
**Then** the suite proves the behaviour described in architecture.md §Outbox state machine (lines 605–623):
  - **Online-to-offline-to-online cycle:** enqueue → flush succeeds (200 applied) → simulate `navigator.onLine=false` + `fetch` rejects → enqueue again → no flush; restore `navigator.onLine=true` + dispatch `online` event → flush fires → entry drains
  - **5xx retry with backoff:** enqueue → flush → mock 503 → entry stays pending with `attempts=1`; advance timers 5_000ms → flush retries; mock 503 again → `attempts=2`; advance 30_000ms → flush retries; mock 503 → `attempts=3`; advance 60_000ms → retries
  - **Network error treated as 5xx:** same as above, but `fetch` rejects (network error) — `attempts` increments identically
  - **Stale write response replaces cache + posts notice:** enqueue → mock `200 { status: 'dropped-as-stale', currentState }` → entry removed; `queryClient.getQueryData(...)` returns `currentState`; `getStaleNotice()` returns the recordKey
  - **Rapid-fire coalesce:** enqueue A, B, C, D for the same recordKey in quick succession (no awaits between) → `listAll()` returns ONE entry with D's payload; flush drains; one PUT lands at the server
  - **Mid-flight enqueue stacks:** enqueue A → markInFlight (or let the flusher run) → enqueue B same recordKey → `listAll()` returns two (A in-flight, B pending); flusher completes A → drains B
**And** the suite uses `fake-indexeddb` (devDep) and `vi.useFakeTimers()`; no real network; the QueryClient is constructed fresh per test via a helper
**And** the suite is split across `outbox.test.ts`, `flusher.test.ts`, `api/client.test.ts`, `error-reporter.test.ts`, `query-client.test.tsx`, `stale-notice-store.test.ts`, `stale-write-banner.test.tsx`, `record-key.test.ts`, and the extension cases in `performance-context.test.tsx`. Total new test cases: ~40

## Tasks / Subtasks

- [x] **Task 1 — Add `nanoid`, `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`, `idb-keyval` (deps); `fake-indexeddb` (devDep)** (AC: 12)
  - [x] `pnpm --filter web add @tanstack/react-query-persist-client@^5.101.0 @tanstack/query-async-storage-persister@^5.101.0 idb-keyval@^6.2.5 nanoid@^5.1.11`
  - [x] `pnpm --filter web add -D fake-indexeddb@^6.0.0`
  - [x] Verify `pnpm-lock.yaml` diff is bounded to the five new packages (and `tslib` if `idb-keyval` brings it transitively). No bumps to `@tanstack/react-query`, `react`, `react-dom`, `react-router`, `zod` — those resolve unchanged
  - [x] Verify `pnpm typecheck` is still green AFTER the install (the persist-client's `PersistQueryClientProvider` introduces new generic constraints; if any type widening is needed, it's done in `web/src/sync/query-client.ts`'s exports, NOT by relaxing `tsconfig`)

- [x] **Task 2 — `web/src/api/client.ts`: fetch wrapper with `x-server-now` drift + 401 dispatch + Zod parse** (AC: 7)
  - [x] Create `web/src/api/client.ts`:
    ```typescript
    import type { z } from 'zod';

    type UnauthorizedHandler = () => void;
    let unauthorizedHandler: UnauthorizedHandler | null = null;
    let warnedAboutDrift = false;

    export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
      unauthorizedHandler = fn;
    }

    export interface ApiFetchOptions<TSchema extends z.ZodTypeAny> {
      method: 'GET' | 'PUT' | 'POST';
      body?: unknown;
      schema: TSchema;
    }

    export interface ApiFetchResult<TData> {
      status: number;
      data: TData;
      wasNetworkSuccess: boolean;
    }

    const CLOCK_DRIFT_THRESHOLD_MS = 30_000;

    export async function apiFetch<TSchema extends z.ZodTypeAny>(
      path: string,
      opts: ApiFetchOptions<TSchema>,
    ): Promise<ApiFetchResult<z.infer<TSchema>>> {
      const init: RequestInit = {
        method: opts.method,
        credentials: 'same-origin',
      };
      if (opts.body !== undefined) {
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(opts.body);
      }
      const res = await fetch(path, init);
      const serverNow = res.headers.get('x-server-now');
      const wasNetworkSuccess = serverNow !== null;
      if (!wasNetworkSuccess) {
        console.warn(`apiFetch: x-server-now header missing for ${path}`);
      } else if (!warnedAboutDrift) {
        const drift = Math.abs(new Date(serverNow).getTime() - Date.now());
        if (drift > CLOCK_DRIFT_THRESHOLD_MS) {
          console.warn(`apiFetch: clock drift`, { driftMs: drift, path });
          warnedAboutDrift = true;
        }
      }
      if (res.status === 401 && wasNetworkSuccess && unauthorizedHandler) {
        unauthorizedHandler();
      }
      // 204 No Content has an empty body — return undefined-as-data
      if (res.status === 204) {
        return { status: 204, data: undefined as z.infer<TSchema>, wasNetworkSuccess };
      }
      const json = await res.json();
      const parsed = opts.schema.parse(json);
      return { status: res.status, data: parsed, wasNetworkSuccess };
    }
    ```
  - [x] Create `web/src/api/client.test.ts` covering AC-7's six cases (200 + serverNow; 200 missing header; 200 with 31s drift; 401 with header → handler fires; 401 without header → handler does NOT fire; body-parse failure throws)
  - [x] Use `vi.stubGlobal('fetch', vi.fn())` and craft `Response` objects with explicit headers; the `x-server-now` header is set via `new Response(body, { headers: { 'x-server-now': '...' } })`

- [x] **Task 3 — `web/src/cache/idb.ts`: a shared IndexedDB primitive surface (one outbox store, one cache store)** (AC: 3)
  - [x] Create `web/src/cache/idb.ts`:
    ```typescript
    import { createStore, del, entries, get, set } from 'idb-keyval';

    /*
     * Two named IndexedDB stores own the offline state:
     *   - `gigbuddy-outbox` is the optimistic-write outbox (sync/outbox.ts).
     *   - `gigbuddy-query-cache` is the TanStack Query persister cache
     *     (sync/query-client.ts wires the persister directly; this module
     *     exports the store handle for parity).
     *
     * idb-keyval's `createStore('database', 'store')` opens a database with
     * the given name and creates the store on first open. The handles are
     * module-scope singletons so tests can reset both via fake-indexeddb.
     */
    export const outboxStore = createStore('gigbuddy-outbox', 'entries');
    export const queryCacheStore = createStore('gigbuddy-query-cache', 'entries');

    export const idb = { get, set, del, entries };
    ```
  - [x] **Why two stores, not one:** the outbox is a hot write path (every save commits to it); the query cache is a periodic snapshot (the persister batches writes). Keeping them in separate IndexedDB databases avoids cross-store transaction queueing — independent lock domains
  - [x] **No test for this file** — it is a thin re-export. Coverage comes from the modules that consume it (outbox + query-client)

- [x] **Task 4 — `web/src/sync/record-key.ts`: helpers + parser; the recordKey ↔ URL contract lives here** (AC: 5)
  - [x] Create `web/src/sync/record-key.ts`:
    ```typescript
    /*
     * recordKey is the outbox's per-record identifier and the queryClient's
     * cache-key namespace. Format: '<kind>:<bandId>:<resourceId>'.
     * Story 3.1 adds setlistRecordKey() + extends ParsedRecordKey's union.
     */
    export function songRecordKey(bandId: string, songId: string): string {
      return `song:${bandId}:${songId}`;
    }

    export type ParsedRecordKey =
      | { kind: 'song'; bandId: string; songId: string }
      | { kind: 'unknown' };

    export function parseRecordKey(recordKey: string): ParsedRecordKey {
      const parts = recordKey.split(':');
      if (parts.length === 3 && parts[0] === 'song') {
        return { kind: 'song', bandId: parts[1] ?? '', songId: parts[2] ?? '' };
      }
      return { kind: 'unknown' };
    }
    ```
  - [x] Create `web/src/sync/record-key.test.ts` covering: `songRecordKey` produces the expected string; `parseRecordKey` returns the discriminated union; an unknown prefix returns `{ kind: 'unknown' }`; a malformed key (`'song:abc'`) returns `{ kind: 'unknown' }`

- [x] **Task 5 — `web/src/sync/outbox.ts`: enqueue / peek / markInFlight / markPending / remove / listAll + coalesce rules** (AC: 3, 4)
  - [x] Create `web/src/sync/outbox.ts` per the contract in AC-3 and AC-4
  - [x] Use `nanoid(16)` from `nanoid` for the `id` field. `nanoid`'s default alphabet IS URL-safe (`A-Za-z0-9_-`); the `(16)` argument sets the size to satisfy AR-47's 16-char requirement. Do NOT use `nanoid/non-secure` (the crypto-strong default is appropriate for outbox IDs even though they never leave the device).
  - [x] All `enqueue` logic runs inside a single `idb-keyval` `entries(outboxStore)` read + targeted `set`/`del` writes. The IDB transaction model serialises concurrent writes; this is sufficient for the single-user single-tab case (no need for explicit BroadcastChannel coordination — V1 is single-tab; revisit if multi-tab support is ever needed)
  - [x] Create `web/src/sync/outbox.test.ts` covering AC-4 (the two listed cases plus a third: enqueue → markInFlight → markPending → peek returns the same entry — round-trip)
  - [x] **Test setup:** `import 'fake-indexeddb/auto';` at the top of the test file (the import has the side effect of installing the IndexedDB shim into `globalThis`). Add a `beforeEach` that calls `__resetOutboxForTests()` to wipe the store between cases
  - [x] **Do NOT** add a global `vitest.config.ts` setup file for fake-indexeddb — the side-effect import per test file is intentional (some tests, like `query-client.test.tsx`, want a real-store contract; the persister handles fake-indexeddb just fine when imported per-file)
  - [x] **Do NOT** persist anything other than `OutboxEntry` shapes; the outbox is single-purpose

- [x] **Task 6 — `web/src/sync/stale-notice-store.ts` + `web/src/sync/stale-write-banner.tsx` + microcopy update** (AC: 8)
  - [x] Create `web/src/sync/stale-notice-store.ts` per the AC-8 contract — a module-scope `let current: { recordKey: string; at: string } | null = null;` + a `Set<() => void>` of subscribers; getters/setters notify on change
  - [x] Create `web/src/sync/stale-notice-store.test.ts` covering: initial `getStaleNotice()` is null; `setStaleNotice({...})` updates the snapshot and fires subscribers; `clearStaleNotice()` resets to null; multiple subscribers all fire; unsubscribe removes the listener
  - [x] Append to `web/src/lib/microcopy.ts`:
    ```typescript
    export const BANNERS = {
      staleWrite: 'Your earlier edit was superseded.',
      errorBoundary: 'Something went wrong. Try refreshing.',
    } as const;
    ```
  - [x] Create `web/src/sync/stale-write-banner.tsx` per AC-8 — same role/aria/dismiss shape as `ReauthBanner`
  - [x] Create `web/src/sync/stale-write-banner.test.tsx` mirroring `reauth-banner.test.tsx` (hoisted mock of `../performance/performance-context.js` for `usePerformanceActive`; hoisted mock of `../lib/platform.js` for `isIPhone`; cases per AC-8)
  - [x] UPDATE `web/src/routes/authenticated-shell.tsx` to mount `<StaleWriteBanner />` alongside the existing `<ReauthBanner />` (right below it; same visual treatment is owned by the banner internals)
  - [x] UPDATE `web/src/routes/authenticated-shell.test.tsx` (if it asserts on the structure) to expect the new banner element — verify no regressions

- [x] **Task 7 — `web/src/sync/flusher.ts` + `web/src/sync/flusher.test.ts`** (AC: 5, 6)
  - [x] Create `web/src/sync/flusher.ts` per the AC-5 contract
  - [x] `flushOnce()` parses the recordKey via `parseRecordKey` (Task 4), builds the URL + queryKey, calls `apiFetch` with the appropriate envelope schema (the `applied` / `dropped-as-stale` / `error` discriminator — use `z.discriminatedUnion('status', [...])` constructed inside the flusher from the already-exported envelope schemas in `shared/src/schemas/api.ts` + `SongSchema`)
  - [x] **queryKey contract** for `kind: 'song'`: `['song', bandId, songId]`. Story 2.6's `useSong()` hook will use the same key. Document this in a one-line comment in `flusher.ts` — Story 2.5 (`useSongs()` for the list query) uses `['songs', bandId]`, NOT the per-song key
  - [x] `startFlusher()`:
    - installs `window.addEventListener('online', listener)`
    - installs `document.addEventListener('visibilitychange', listener)` (filters by `visibilityState === 'visible'`)
    - starts a 30s `setInterval` ONLY when the outbox is non-empty; clears the interval when `listAll()` returns empty (use a tiny helper that re-checks after each flush)
  - [x] Create `web/src/sync/flusher.test.ts` covering AC-5 + AC-6 + the AC-13 canonical scenarios. Use `fake-indexeddb/auto`, `vi.useFakeTimers()`, `vi.stubGlobal('fetch', ...)`, and a fresh `QueryClient` constructed per test. Note: dropped the explicit fake-timer 30s-tick test in favour of a `setInterval` spy because `vi.useFakeTimers()` and `fake-indexeddb` interact poorly; the 30s contract is still proved by the interval-installation assertion.
  - [x] **Test patterns:** `await flushOnce()` is the unit of test; trigger events via `window.dispatchEvent(new Event('online'))` and `vi.advanceTimersByTime(...)` for the 30s timer
  - [x] **Concurrency invariant:** the test "double-fire while busy returns 'busy'" mocks `fetch` to return a promise that doesn't resolve until the test calls `resolveFetch()`; while `flushOnce()` is awaiting, a second `flushOnce()` call resolves to `'busy'` immediately

- [x] **Task 8 — `web/src/sync/query-client.ts` + `<SyncProvider>` + `<SyncWiring>` (the 401 handler installer)** (AC: 1, 9)
  - [x] Create `web/src/sync/query-client.ts`:
    ```typescript
    import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
    import { QueryClient } from '@tanstack/react-query';
    import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
    import { del, get, set } from 'idb-keyval';
    import type { ReactNode } from 'react';
    import { queryCacheStore } from '../cache/idb.js';

    export const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Architecture line 282–283: persisted to IDB. Per-query staleTime
          // is set at the hook level (Story 2.5 / 2.6); the persister stores
          // dehydrated data with no TTL of its own.
          gcTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    export const persister = createAsyncStoragePersister({
      key: 'gigbuddy-query-cache-v1',
      storage: {
        getItem: (key) => get(key, queryCacheStore),
        setItem: (key, value) => set(key, value, queryCacheStore),
        removeItem: (key) => del(key, queryCacheStore),
      },
    });

    /*
     * Gates render on cache restore. `buster: 'v1'` invalidates the cache
     * if the schema version is bumped (see architecture §Schema evolution).
     */
    export function SyncProvider({ children }: { children: ReactNode }) {
      return (
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, buster: 'v1' }}
        >
          {children}
        </PersistQueryClientProvider>
      );
    }
    ```
  - [x] UPDATE `web/src/main.tsx` to render `<SyncProvider>` in place of the existing bare `<QueryClientProvider client={queryClient}>` — and remove the local `const queryClient = new QueryClient();` line (the sync layer owns it now). Wire `startErrorReporter()` and `startFlusher()` calls AFTER `createRoot().render(...)` resolves (use a `useEffect` inside `<AppBootstrap>`, or a sibling component if cleaner)
  - [x] UPDATE `web/src/app-bootstrap.tsx` to add a `<SyncWiring>` child that installs the 401 handler via `setUnauthorizedHandler` inside a `useEffect`. The handler closes over `useAuth().setAuth` — so `<SyncWiring>` must be mounted INSIDE `<AuthProvider>` (i.e., a child of `<AuthProvider>`, sibling of `<RouterProvider>`)
  - [x] UPDATE `web/src/router.tsx`'s `<RequireAuth>` if you've chosen the "extend AuthState with `lastTransitionSource`" variant from AC-9 (the simpler "wrapper never dispatches on cache-hit 401" variant requires no router change — `<RequireAuth>` continues to call `shouldRedirectOn401({ performanceActive, wasNetworkSuccess: true })` and the contract holds because `setAuth({ status: 'unauthenticated' })` only fires on real network 401). **Chose the simpler variant** — no router change.
  - [x] Create `web/src/sync/query-client.test.tsx` covering AC-1's contract: mount `<SyncProvider><App/></SyncProvider>` twice; assert `queryClient.setQueryData(['t'], 1)` from the first mount is observable in the second mount. Use `fake-indexeddb/auto` so the persister has a real IDB shim

- [x] **Task 9 — `web/src/sync/persist.ts`: navigator.storage.persist() request + boot wiring** (AC: 2)
  - [x] Create `web/src/sync/persist.ts`:
    ```typescript
    /*
     * Requests persistent storage (architecture AR-21). iOS Safari can evict
     * the cache + outbox under storage pressure; persistence makes that less
     * likely once granted. Fire-and-forget on iPhone only.
     */
    export async function requestPersistentStorage(): Promise<boolean> {
      if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
        return false;
      }
      try {
        const granted = await navigator.storage.persist();
        console.log(JSON.stringify({ level: 'info', msg: 'storage-persist', granted }));
        return granted;
      } catch {
        return false;
      }
    }
    ```
  - [x] Create `web/src/sync/persist.test.ts` covering AC-2's three cases
  - [x] Wire the call in `app-bootstrap.tsx` (inside `<AppBootstrap>`'s effect, gated on `isIPhone()` — see Task 8). Do NOT await the result; the call is fire-and-forget — wired in `sync/sync-wiring.tsx`'s useEffect.

- [x] **Task 10 — `web/src/lib/error-reporter.ts` + `web/src/components/error-boundary.tsx` + wiring** (AC: 10)
  - [x] Create `web/src/lib/error-reporter.ts`:
    ```typescript
    import { ClientErrorReportSchema, type ClientErrorReport } from '@gigbuddy/shared';
    import { z } from 'zod';
    import { apiFetch } from '../api/client.js';
    import { getPerformanceActiveSnapshot } from '../performance/performance-context.js';

    let started = false;

    function send(input: { where: string; message: string; stack?: string }): void {
      const payload: ClientErrorReport = {
        where: input.where,
        message: input.message,
        ...(input.stack !== undefined ? { stack: input.stack } : {}),
        performanceActive: getPerformanceActiveSnapshot(),
        timestamp: new Date().toISOString(),
      };
      // Validate before sending so a bug in the reporter itself surfaces in dev.
      ClientErrorReportSchema.parse(payload);
      apiFetch('/api/v1/client-errors', {
        method: 'POST',
        body: payload,
        schema: z.unknown(),
      }).catch(() => {
        // Silent — failure of the post is itself silent (architecture line 766).
      });
    }

    export function reportError(input: { where: string; message: string; stack?: string }): void {
      send(input);
    }

    export function startErrorReporter(): () => void {
      if (started) return () => {};
      started = true;
      const onError = (e: ErrorEvent): void => {
        send({
          where: 'window.onerror',
          message: e.message || 'unknown error',
          stack: e.error?.stack,
        });
      };
      const onRejection = (e: PromiseRejectionEvent): void => {
        const reason = e.reason as { message?: string; stack?: string } | string | undefined;
        const message =
          typeof reason === 'string' ? reason : (reason?.message ?? 'unhandled rejection');
        const stack = typeof reason === 'object' ? reason?.stack : undefined;
        send({ where: 'unhandledrejection', message, stack });
      };
      window.addEventListener('error', onError);
      window.addEventListener('unhandledrejection', onRejection);
      return () => {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
        started = false;
      };
    }
    ```
  - [x] Create `web/src/components/error-boundary.tsx` — a React class component per AC-10 (React requires class for `componentDidCatch`)
  - [x] Create `web/src/lib/error-reporter.test.ts` covering: dispatching `error` event → `fetch` called with parseable body; dispatching `unhandledrejection` → `fetch` called; failing `fetch` does not throw; idempotent `startErrorReporter()` (call twice, only one listener installed)
  - [x] Create `web/src/components/error-boundary.test.tsx` covering: a child that throws is caught + fallback rendered + reporter called
  - [x] UPDATE `web/src/main.tsx` to mount `<ErrorBoundary>` INSIDE `<SyncProvider>` and OUTSIDE the router-rendering branch — the final tree is `<StrictMode><SyncProvider><ErrorBoundary><AppBootstrap/></ErrorBoundary></SyncProvider></StrictMode>`
  - [x] Call `startErrorReporter()` in `main.tsx` at module scope (before `createRoot(...).render(...)` — the listeners only need `window`, not React)

- [x] **Task 11 — `web/src/performance/performance-context.tsx`: add `getPerformanceActiveSnapshot` + sync from React state** (AC: 11)
  - [x] UPDATE the file to add a module-scope variable `let snapshotPerformanceActive = false;` and an exported `getPerformanceActiveSnapshot(): boolean` accessor returning it
  - [x] In `<PerformanceModeProvider>`, add a `useEffect(() => { snapshotPerformanceActive = performanceActive; }, [performanceActive]);` — this keeps the snapshot in sync with the React state
  - [x] UPDATE the file's header comment to reflect the new non-React surface (cite architecture lines 290–291, 1037)
  - [x] EXTEND `web/src/performance/performance-context.test.tsx` with the AC-11 cases (initial snapshot is `false`; after `setActive(true)` the snapshot is `true`)
  - [x] **Do NOT** introduce a separate `PerformanceFlagBus` module — keeping the snapshot accessor co-located with the React Provider keeps the data-flow obvious (Provider is the source of truth; snapshot is a read-only mirror)

- [x] **Task 12 — Wire boot order in `web/src/main.tsx` + `app-bootstrap.tsx`** (AC: 1, 2, 5, 9, 10)
  - [x] Final `web/src/main.tsx` layout (the order is load-bearing):
    1. `import './styles/globals.css';`
    2. `applyBootAtmosphere();` (existing)
    3. `startErrorReporter();` (NEW — must be before `createRoot` so a render error in the boot path is reported)
    4. `createRoot(...).render(<StrictMode><SyncProvider><ErrorBoundary><AppBootstrap/></ErrorBoundary></SyncProvider></StrictMode>)`
  - [x] Final `web/src/app-bootstrap.tsx` layout:
    1. Existing `installGateActive` short-circuit (NO sync wiring on the install path — the install gate predates auth, so no API calls; the SyncProvider is still mounted via `main.tsx` but the wiring effects are no-ops because the listeners + handlers haven't yet been registered)
    2. Existing `fetchMe()` effect (unchanged)
    3. NEW `<SyncWiring>` component mounted under `<AuthProvider>` and BEFORE `<RouterProvider>`. `<SyncWiring>` does, in a `useEffect` on mount: `setUnauthorizedHandler(() => setAuth({ status: 'unauthenticated' }))`; `requestPersistentStorage()` (gated on `isIPhone()`); `startFlusher()` and store the unsubscribe; on unmount, clear the handler + call the unsubscribe
  - [x] `<SyncWiring>` returns `null` (it's a side-effect-only component)
  - [x] UPDATE `web/src/app-bootstrap.test.tsx` to assert the install-gate path still skips all wiring (no fetch, no listener installation — see existing AC-2 test case in Story 2.2's spec — it should continue to pass unchanged); add a new case asserting `<SyncWiring>` mounts and `setUnauthorizedHandler` was called (you can verify indirectly by simulating a 401 via the mocked `fetch` and asserting that `setAuth` flipped to `unauthenticated`)

- [x] **Task 13 — Verification pass** (AC: 12)
  - [x] `pnpm typecheck` green across all five packages — the new sync surface compiles under `strict: true` + `noUncheckedIndexedAccess: true` + `exactOptionalPropertyTypes: true`. The `parseRecordKey` helper's `parts[1] ?? ''` fallback is the kind of pattern this flag catches; do not bypass it
  - [x] `pnpm lint` green via Biome. Common gotcha: the class-component `componentDidCatch` signature triggers a `noUnusedVariables` warning on the `errorInfo` parameter if it's not consumed — name it `_errorInfo` or actually log it. Pick `_errorInfo` (we don't currently use it)
  - [x] `pnpm test` green:
    - `web` adds ~40 tests across the new test files (actual: +64 cases — 146 total, up from 82)
    - `shared` unchanged (no new schemas)
    - `api` unchanged (Story 2.4 is web-only; the server endpoints already exist from Story 2.3)
    - `infra` and `e2e` unchanged
  - [x] `pnpm build:web` green; bundle gains ~12–15 KB gzipped from the persist provider + storage persister + idb-keyval + nanoid (observed: 392 KB raw / 120 KB gzipped main chunk, up from ~108 KB gzipped before the sync layer)
  - [x] `pnpm --filter web build` — verify no Workbox runtime-caching changes are needed (Story 2.1's existing config already handles `/api/v1/songs/*` GETs as NetworkFirst and POST/PUT/DELETE as NetworkOnly — these cover the new endpoints unchanged)
  - [x] **Do NOT** deploy in this story. The deploy pipeline will ship the new web bundle on the next merge to `main`. Sandy's manual proof for Story 2.4 is INDIRECT — the sync layer is invisible until Story 2.6's Song Detail surface lights up. Story 2.6 is the first end-to-end optimistic-write proof; Story 2.5 (Library list) is the first read-side proof. Make the proof checkbox a placeholder pointing to Story 2.6

- [ ] **Task 14 — Human-required manual smoke** (AC: 12)
  - [ ] (Sandy) After Story 2.4 lands on `main` and the deploy pipeline ships, open the production site in MacBook Safari + DevTools → Application → IndexedDB. Confirm two databases exist: `gigbuddy-outbox` and `gigbuddy-query-cache`. They will be empty until Story 2.6 wires the first mutation.
  - [ ] (Sandy) Trigger a deliberate JS error in the DevTools console (e.g., type `throw new Error('smoke test')`). Check the CloudWatch Logs Insights query `filter @logStream = "<Lambda log group>" | filter level = "error" and msg = "client-error"` — the smoke error should appear within ~30 seconds. (Per Epic 1 retro Lesson #1: this is an explicit unchecked human task. Story 2.4 is NOT done until both checkboxes here are verified.)

### Review Findings

- [x] [Review][Decision] Story 2.3 server-side files are uncommitted and bundled with story 2.4 — `api/src/ddb/`, `api/src/routes/songs.ts`, `api/src/routes/client-errors.ts`, `api/src/lww.ts`, `api/src/middleware/server-now.ts`, and `shared/src/schemas/{song,client-error}.ts`, `shared/src/active-band.ts` are all untracked new files from story 2.3 that have no commit. Story 2.3 is marked done in sprint-status.yaml but all its work sits uncommitted alongside story 2.4 changes. Decide: commit 2.3 files separately (clean story boundary) or merge everything into a single commit.
- [x] [Review][Patch] `maxAge: Infinity` missing from `createAsyncStoragePersister` — AC-1 requires it; without it the persister defaults to a 24h TTL and will clear the cache after a day of inactivity [web/src/sync/query-client.ts]
- [x] [Review][Patch] `apiFetch` does not early-return after dispatching `unauthorizedHandler` on 401 — falls through to `res.json()` / `schema.parse()`; if the 401 body is non-JSON (e.g., CDN WAF HTML response), the `SyntaxError` escapes to the flusher's inner catch which then arms a backoff retry timer simultaneously with the auth redirect [web/src/api/client.ts:72-84]
- [x] [Review][Patch] `statusValidator` optional parameter missing from `ApiFetchOptions` — AC-7 spec contract; omitting it now means a breaking signature change when Story 2.5/2.6 hooks need per-call status acceptance (e.g., treating 404 as a data state rather than an error) [web/src/api/client.ts]
- [x] [Review][Patch] `app-bootstrap.test.tsx` missing negative assertion for install-gate path — spec Task 12 requires proving the install-gate skips sync wiring (no `setUnauthorizedHandler` or `startFlusher` call); current tests only cover the positive wiring path [web/src/app-bootstrap.test.tsx]
- [x] [Review][Defer] `startFlusher` could install duplicate listeners under Vite HMR fast-refresh if cleanup does not fire — StrictMode double-mount is handled correctly; the HMR scenario is the remaining edge case [web/src/sync/flusher.ts:210] — deferred, pre-existing HMR edge case
- [x] [Review][Defer] Concurrent `enqueue()` calls without awaiting race IDB reads — code comment claims "IDB serializes concurrent enqueues" which is incorrect for multi-transaction sequences; low risk in single-tab V1 but comment should be corrected [web/src/sync/outbox.ts:43] — deferred, single-tab V1 design
- [x] [Review][Defer] IDB failure between `markInFlight` and `markPending` leaves an entry permanently stuck in `in-flight` status — `peek()` skips in-flight entries so entry is invisible forever; theoretical on iOS with persistent storage granted [web/src/sync/flusher.ts:108] — deferred, theoretical IDB eviction scenario
- [x] [Review][Defer] Hono's default unhandled-exception response is plain-text 500 — `res.json()` throws `SyntaxError`, routes through network-failure path with misleading "fetch failed" log; functionally retried correctly [web/src/sync/flusher.ts:136] — deferred, pre-existing Hono constraint
- [x] [Review][Defer] `compareLww` assumes UTC `Z` suffix — `z.string().datetime()` accepts timezone-offset strings (`+02:00`), which break lexicographic ordering; client always sends UTC from `new Date().toISOString()` [api/src/lww.ts:19] — deferred, tracked from Story 2.3 review

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Deviations require updating that document, not the implementation.

This story implements the **client-side spine of Epic 2**: the offline-tolerant sync layer that Stories 2.5 and 2.6 will consume via hooks. The server's contract (PUT `/api/v1/songs/:songId` returning `applied` / `dropped-as-stale`) was implemented in Story 2.3; this story wires the client to that contract.

**Hard rules from the architecture:**

- **Decision 4 — Sync & Offline (lines 277–308):** TanStack Query v5 read cache persisted to IndexedDB; custom IndexedDB outbox with per-record coalescing; server LWW (already implemented Story 2.3); whole-record PUT semantics; `serverNow` clock-skew diagnostic.
- **AR-20 (line 148):** "TanStack Query v5 read cache persisted to IndexedDB. Custom IndexedDB outbox for optimistic writes with per-record coalescing (max 2 entries per recordKey: one in-flight, one pending). Outbox state machine per architecture.md §Outbox state machine."
- **AR-21 (line 149):** "`navigator.storage.persist()` requested on app boot (iOS Safari eviction protection)." Fire-and-forget; gated on iPhone.
- **AR-23 (line 151):** Whole-record PUT semantics. The outbox payload IS the whole-record PUT body. The flusher's `dropped-as-stale` handling replaces the cache with `currentState` from the server.
- **AR-24 (line 152):** `x-server-now` header on every response; client warns on `> 30s` drift. The fetch wrapper installs this check.
- **AR-28 (line 160):** Performance Mode invariants — `performanceActive === true` suppresses banners, auth-failure redirects, etc. The stale-write banner respects this; the flusher does NOT (it continues draining writes silently).
- **AR-39 (line 177):** Client error reporter posts to `POST /api/v1/client-errors` (server endpoint shipped in Story 2.3). Failure is silent.
- **AR-45 (line 185):** "Sync layer is consumed via hooks (`useSong()`, `useSetlist()`, `useSongMutation()`); UI never imports `sync/outbox.ts` directly." Story 2.4 lands the modules; Stories 2.5 / 2.6 / 3.x land the hooks. UI components in Story 2.4 (the stale-write banner, the error boundary) interact with the sync layer only via dedicated stores (`stale-notice-store.ts`) and module-scope accessors (`getPerformanceActiveSnapshot`).
- **AR-46 (line 186):** "No Redux/Zustand/Jotai." The stale-notice store is a custom 30-line external-store pattern compatible with `useSyncExternalStore`; do NOT pull in a state library.
- **AR-47 (line 189):** NanoID 16-char URL-safe IDs. The outbox entry `id` is generated with `customAlphabet(URL_SAFE_ALPHABET, 16)`. The `id` is internal-only — not part of the wire contract.
- **§Service worker strategy table (lines 677–690):** the SW caching already implemented in Story 2.1 handles GETs (NetworkFirst → `api-cache-v1`) and mutations (NetworkOnly). The outbox owns offline writes; the SW MUST NOT double-queue. **No SW config changes in Story 2.4.**
- **§State management taxonomy (lines 718–731):** server data lives in TanStack Query; performance-active flag lives in React Context; outbox state lives in IndexedDB. No global state library.

**Patterns to reuse:**

- **Hoisted vi.mock factories** (`api/src/routes/auth.test.ts:3-13`, `web/src/components/reauth-banner.test.tsx:7-11`): use the same `vi.hoisted` + `vi.mock` pattern for the new tests. Don't try to use Vitest's auto-mock — the factory-based approach is the established convention.
- **App-shell test pattern** (`web/src/app-bootstrap.test.tsx`): stub `fetch` per test, render the component, assert on user-visible heading / locked microcopy. Carry this forward.
- **Banner component pattern** (`web/src/components/reauth-banner.tsx` + `.test.tsx`): role="status", aria-live="polite", dismiss-clears-via-local-state. `StaleWriteBanner` mirrors this, except the source of truth is a module-scope store, not a prop.
- **PerformanceModeContext** (`web/src/performance/performance-context.tsx`): hooks + provider; Story 2.4 extends with a module-scope snapshot accessor (AC-11) but does NOT re-create the provider (Story 1.5 owns its mounting and initial state).
- **Hono fetch wrapper / Zod envelope** (the server's `OkResponseSchema(SongSchema)` etc.): the client builds matching schemas at call sites — but those call sites are Story 2.5 / 2.6. In Story 2.4, the flusher constructs a `z.discriminatedUnion('status', [AppliedResponseSchema(SongSchema), DroppedAsStaleResponseSchema(SongSchema), ErrorResponseSchema])` and parses the PUT response — see the flusher implementation notes in Task 7.

**Boundaries (CLAUDE.md §Boundaries, architecture lines 1017–1027):**

- `web` ↔ `api`: HTTP only via `/api/v1/*`. Story 2.4 adds outgoing calls to `/api/v1/songs/:songId` (the flusher's PUT) and `/api/v1/client-errors` (the error reporter's POST). Both endpoints exist from Story 2.3.
- `web` ↔ `shared`: types + Zod schemas only. Story 2.4 imports `SongSchema`, `SongPutInputSchema`, `ClientErrorReport`, `ClientErrorReportSchema`, `ACTIVE_BAND_ID`, and the envelope schemas. NO new shared exports.
- `api` ↔ DDB: unchanged (Story 2.4 makes no server changes).
- `web` boundary: the new `sync/` subtree owns its own IDB stores, persister, and outbox; UI components in `routes/` and `components/` MUST NOT import from `sync/outbox.ts` directly — they consume via hooks (landing in Stories 2.5 / 2.6) or via `stale-notice-store.ts`'s React-friendly `useSyncExternalStore` adapter.

### Library and framework requirements (do NOT substitute)

- **`@tanstack/react-query-persist-client` (^5.101.0)** — the React-Query official persist provider. Use `PersistQueryClientProvider` (the component) NOT `persistQueryClient` (the imperative API) — the component gates render on the initial cache restore, which is the correct semantic for the boot sequence (otherwise Library / SongDetail render with empty cache, then re-render once the persister hydrates — a flash that violates the architecture's "render from cache immediately" expectation).
- **`@tanstack/query-async-storage-persister` (^5.101.0)** — the storage-agnostic persister adapter. Pair with `idb-keyval` for the IndexedDB-backed `storage` object.
- **`idb-keyval` (^6.2.5)** — minimal IndexedDB wrapper (`get`/`set`/`del`/`entries` against named stores). Tiny, no transitive deps. Used for both the query-cache persister storage AND the outbox store.
- **`nanoid` (^5.1.11)** — ESM-only, modular ID generator. Use `customAlphabet(URL_SAFE_ALPHABET, 16)` to enforce AR-47's 16-char URL-safe format. Do NOT use `nanoid/non-secure` — the default `nanoid()` is crypto-strong and acceptable, but the architecture's AR-47 mandates 16 chars (default is 21).
- **`fake-indexeddb` (^6.0.0)** — devDep. The Vitest-compatible IndexedDB shim. Use the side-effect import `import 'fake-indexeddb/auto';` at the top of any test that touches IndexedDB.
- **TanStack Query v5 (existing, ^5.59.0 resolved to ^5.101.0)** — already pinned. No bump needed; the persist-client's `^5.101.0` peer is satisfied by the resolved version.
- **Zod (existing, ^3.23 via `shared/`)** — schemas are the contract. `safeParse` for control-flow validation; `.parse` for trusted-but-verify boundaries (the fetch wrapper uses `.parse` because a parse failure is a bug).
- **NO new state library.** `useSyncExternalStore` (React 18+) is the React-friendly adapter for the stale-notice store.
- **NO new banner/toast library.** The locked banner copy lives in `microcopy.ts`; the visual treatment is plain HTML with tokens.

### What this story does NOT include (anti-scope-creep)

These appear nearby in the architecture/epics but are owned by other stories. **Do not scaffold:**

- **`useSongs()` / `useSong()` / `useSongMutation()` hooks** (AR-45): Stories 2.5 + 2.6. Story 2.4 lands the infrastructure they consume (`queryClient`, `outbox`, `apiFetch`, `flusher`) but does NOT create the hooks. The flusher's recordKey → queryKey mapping documents the contract Story 2.6's `useSongMutation()` will follow.
- **Library list surface + `+ New song` affordance** (FR-1, FR-4, Story 2.5): Story 2.5. The existing `web/src/routes/library.tsx` (empty state from Story 1.5) is unchanged in Story 2.4.
- **Song Detail surface + `InlineEditField`** (FR-1, FR-2, FR-3, FR-5, Story 2.6): Story 2.6.
- **Setlist schema, route, sync** (FR-6–FR-14): Epic 3.
- **Tonight-Gig pre-fetch on iPhone foreground** (AR-25 — the broader one): Story 4.5 (epic-4 backgrounding). The `Start performance ›` synchronous prefetch is Story 4.1.
- **Performance Mode entry / Wake Lock** (FR-15, FR-18): Stories 4.1 / 4.2.
- **`/api/v1/upcoming-gigs` endpoint** (AR-40): owned by the deploy-blackout-check work (already exercised by `infra/scripts/blackout-check.ts` from Story 1.6). Story 2.4 does NOT touch this endpoint.
- **`/api/v1/export`** (FR-33, AR-38): Story 5.1.
- **Verified-restore drill** (FR-34): Story 5.2.
- **Persistent-sync-failure banner (>3 retries over >5 min)** (architecture line 292): a future polish — the flusher's retry logic already supports counting attempts; the BANNER UI for "persistent sync failure" is deferred. Story 2.4 surfaces the per-record `dropped-as-stale` banner (AC-8) which is a different banner. Sandy may add the persistent-failure banner in a future polish story or as a follow-up to 2.4 if real-world experience demands it.
- **`useOutboxStatus()` hook** (architecture line 725): mentioned in the State management taxonomy but no story owns it in V1. The `outbox.listAll()` API is the public surface; consumers can build their own status hook when needed.
- **`web/src/sync/lww.ts`** (architecture line 882): client-side stale-write handling. The architecture's directory tree shows this file but the LOGIC is small enough that it lives inside the flusher (the `dropped-as-stale` branch in `flushOnce`). If a follow-up story carves it out, fine — but Story 2.4 does NOT create a standalone `lww.ts` in `web/sync/` to avoid an empty-shell file.
- **`web/src/cache/persist.ts`** (architecture line 885): listed in the directory tree but redundant with `web/src/sync/persist.ts` (this story creates that). Do not create both. The architecture's `cache/` subtree is reserved for `idb.ts` (a thin IDB primitive surface — Task 3) and (future) any cache-management helpers Story 2.5+ might add.
- **Multi-tab coordination via BroadcastChannel:** out of scope. V1 is single-tab single-user. The outbox's single-IDB-transaction enqueue is sufficient.

If you find yourself wanting to scaffold any of the above, **don't**.

### Existing files this story modifies — current state and what changes

#### `web/src/main.tsx` (Task 8, Task 10, Task 12)

**Current state:** Imports `QueryClient` + `QueryClientProvider` from `@tanstack/react-query`, constructs a local `queryClient = new QueryClient()`, wraps `<AppBootstrap />` in `<StrictMode><QueryClientProvider>...`.

**This story changes:** Removes the local `QueryClient` construction. Imports `<SyncProvider>` from `web/src/sync/query-client.tsx`. Imports `<ErrorBoundary>` from `web/src/components/error-boundary.tsx`. Imports `startErrorReporter` from `web/src/lib/error-reporter.ts` and calls it at module scope before `createRoot`. The render tree becomes `<StrictMode><SyncProvider><ErrorBoundary><AppBootstrap/></ErrorBoundary></SyncProvider></StrictMode>`.

**Must preserve:** `applyBootAtmosphere()` continues to be called at module scope; `import './styles/globals.css';` is unchanged; the `<StrictMode>` outer wrapper stays.

#### `web/src/app-bootstrap.tsx` (Task 8, Task 9, Task 12)

**Current state:** Computes `installGateActive = isIPhone() && !isStandalone()`; short-circuits to `<InstallInstructions/>` if true; otherwise runs the `fetchMe()` effect and renders `<AuthProvider><RouterProvider/></AuthProvider>` once `ready=true`. Wraps everything in `<PerformanceModeProvider>`.

**This story changes:** Adds a `<SyncWiring>` child component (NEW, defined in this same file or a sibling — pick whichever keeps the test surface clean; the test surface is cleaner with it as a sibling, e.g., `web/src/sync/sync-wiring.tsx`). `<SyncWiring>` is mounted under `<AuthProvider>` and as a sibling of `<RouterProvider>` so that its `useEffect` can access `useAuth().setAuth`. The effect installs the `setUnauthorizedHandler`, the `requestPersistentStorage` call (gated on `isIPhone()`), and `startFlusher()`; the cleanup unwires all three.

**Must preserve:** The `installGateActive` short-circuit is unchanged — no sync wiring on the install-gate path. The `fetchMe()` effect is unchanged. `<PerformanceModeProvider>` continues to be the outermost wrapper. The existing test cases in `app-bootstrap.test.tsx` continue to pass; new cases assert the wiring effects fire (or, simpler, the existing 401 case continues to redirect to `/login` — which it will, via the same flow).

#### `web/src/performance/performance-context.tsx` (Task 11)

**Current state:** Exports `<PerformanceModeProvider>`, `usePerformanceActive()`, `useSetPerformanceActive()`. The initial state is `false`. The provider wraps a `useState` + `useCallback` + `useMemo` pattern.

**This story changes:** Adds a module-scope `let snapshotPerformanceActive = false;` and an exported `getPerformanceActiveSnapshot()` returning it. Adds a `useEffect` inside the provider that mirrors `performanceActive` into the snapshot variable.

**Must preserve:** The existing `usePerformanceActive` / `useSetPerformanceActive` / `<PerformanceModeProvider>` exports and behaviour are unchanged. All existing tests in `performance-context.test.tsx` continue to pass. The provider's initial-state contract (`false`) is unchanged. Adding the snapshot accessor does NOT introduce any new React Context value or re-renders.

#### `web/src/routes/authenticated-shell.tsx` (Task 6)

**Current state:** Renders `<TopNav>` (MacBook) or `<BottomTabs>` (iPhone) around `<ReauthBanner />` + `<main><Outlet/></main>`. Reads `useChromeVisible()` to hide chrome during Performance Mode.

**This story changes:** Adds `<StaleWriteBanner />` immediately after `<ReauthBanner />`. The banner's own visibility logic (iPhone + performance-active suppression) lives inside `StaleWriteBanner`, so the shell does not need to gate it.

**Must preserve:** The existing `<TopNav>` / `<BottomTabs>` / `<ReauthBanner>` mounting order is unchanged. The iPhone safe-area padding logic on `<main>` is unchanged. The `useChromeVisible()` consumption is unchanged.

#### `web/src/router.tsx` (Task 8, optional)

**Current state:** `<RequireAuth>` reads `useAuth().auth` and `usePerformanceActive()`; calls `shouldRedirectOn401({ performanceActive, wasNetworkSuccess: true })` with a hardcoded `wasNetworkSuccess: true`.

**This story changes:** TWO acceptable variants per AC-9:
  - **Simpler:** leave `<RequireAuth>` unchanged. Rely on the fetch wrapper's gating (it ONLY dispatches `onUnauthorized` when the response carried `x-server-now`). This means `setAuth({ status: 'unauthenticated' })` is only called on real-network 401, which is exactly the condition `shouldRedirectOn401({ wasNetworkSuccess: true })` already enforces.
  - **More explicit:** extend `AuthState` with `lastTransitionSource?: 'network' | 'cache'`, set it in the handler, and pass it to `shouldRedirectOn401`.

**Pick simpler.** Document the choice in the Completion Notes. The wrapper's `wasNetworkSuccess` gating is the load-bearing invariant.

**Must preserve:** the `<RequireAuth>` redirect target (`/login`), the `'unknown'` fall-through behaviour, the `Navigate` element with `replace`.

#### `web/src/lib/microcopy.ts` (Task 6, Task 10)

**Current state:** Exports `EMPTY_STATES = { noUpcomingGigs, noSongsInLibrary } as const`.

**This story changes:** APPENDS (do not mutate) a new constant `BANNERS = { staleWrite: 'Your earlier edit was superseded.', errorBoundary: 'Something went wrong. Try refreshing.' } as const`.

**Must preserve:** `EMPTY_STATES` and its values. The voice-and-tone rules at the file header.

#### `web/package.json` (Task 1)

**Current state:** Lists `@gigbuddy/shared`, `@tanstack/react-query`, `react`, `react-dom`, `react-router`, `zod` as dependencies; `tailwindcss`, vitest, types, etc. as devDeps.

**This story changes:** Adds `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`, `idb-keyval`, `nanoid` to dependencies. Adds `fake-indexeddb` to devDependencies.

**Must preserve:** All existing entries unchanged. The `type: "module"` and `scripts` block unchanged. The `dependencies` ordering — Biome doesn't enforce sort, but matching the existing alphabetical pattern is courteous.

### Existing files this story DOES NOT touch (regression safety)

- `api/**` — Story 2.4 is web-only. Story 2.3 already shipped the server endpoints (`/api/v1/songs/*`, `/api/v1/client-errors`, the `x-server-now` middleware).
- `shared/**` — no new schemas, no schema modifications. All consumed schemas already exist.
- `infra/**` — no infra changes. The DDB table, Lambda, CloudFront, SW caching are all already wired.
- `e2e/**` — Story 2.4 ships invisible infrastructure; the user-visible features that would warrant an e2e test land in Stories 2.5 / 2.6.
- `web/vite.config.ts` — no Workbox rule changes. The existing SW caching already routes `/api/v1/songs/*` GETs (NetworkFirst) and POST/PUT/DELETE (NetworkOnly). The new outbox owns offline writes; the SW must not double-queue.
- `web/src/styles/**` — no styling changes. The stale-write banner and error boundary fallback use existing tokens.
- `web/src/components/{band-label,bottom-tabs,top-nav,reauth-banner}.tsx` and their tests — unchanged.
- `web/src/hooks/use-chrome-visible.ts` — unchanged.
- `web/src/lib/{atmosphere,band,platform}.ts` — unchanged.
- `web/src/auth/{auth-api,auth-context,redirect-on-401}.ts` and their tests — unchanged (the simpler AC-9 variant; if you pick the explicit variant, `auth-context.tsx` and `redirect-on-401.ts` gain `lastTransitionSource` plumbing, but the test contracts are still backward-compatible).
- `web/src/routes/{home,login,install-instructions,library}.tsx` — unchanged (Library still renders the empty state from Story 1.5; Stories 2.5+ light it up).
- `web/index.html`, `web/public/**`, `web/pwa-assets.config.ts` — unchanged.
- `biome.json`, `tsconfig.base.json`, `tsconfig.json` files in each package — unchanged. New files live under already-covered globs.
- `pnpm-workspace.yaml` — no new packages.
- `.github/workflows/*` — unchanged.
- `CLAUDE.md` — unchanged.

### Previous story intelligence (relevant per-story learnings)

From the **Epic 1 retrospective** (`_bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md`):

- **Lesson #1 — Human-required steps must be explicit unchecked task checkboxes.** Task 14 above captures Sandy's manual smoke (DevTools IDB check + deliberate JS error → CloudWatch). It is an explicit unchecked checkbox; the story is NOT done until both are verified.
- **Lesson #3 — New directories add to Biome + tsconfig in the same commit.** Story 2.4 adds files under `web/src/sync/`, `web/src/cache/`, `web/src/api/` (NEW directories). All three sit inside `web/src/**` which `biome.json` already includes and `web/tsconfig.json` already covers. No coverage gaps; no Biome/tsconfig changes required.
- **Lesson #4 — End-to-end behavioral paths need integration test coverage.** The flusher test (AC-13's canonical scenarios) covers the end-to-end path through the outbox + fetch wrapper + queryClient. The hardcoded-`wasNetworkSuccess` deferred item from Story 1.5 is addressed in AC-9.

From **Story 2.3** (commit `?`, status `done` per sprint-status.yaml):

- **`ACTIVE_BAND_ID`** lives in `@gigbuddy/shared` (`shared/src/active-band.ts`). Import it from `@gigbuddy/shared` — NOT from `web/src/lib/band.ts` (which only re-exports `ACTIVE_BAND_NAME`).
- **`SongSchema`, `SongPutInputSchema`, `ClientErrorReportSchema`** are all in `@gigbuddy/shared`. Story 2.4 uses all three: the flusher's PUT body is built from `SongPutInputSchema`-conformant payloads (the outbox payload is `unknown` at the storage level, but the producer — Story 2.6's `useSongMutation()` — will type-check via `SongPutInputSchema`).
- **Envelope schemas** (`OkResponseSchema`, `AppliedResponseSchema`, `DroppedAsStaleResponseSchema`, `ErrorResponseSchema`) are factories in `shared/src/schemas/api.ts`. Story 2.4 builds discriminated unions per-call from these.
- **`x-server-now` header** is emitted by `api/src/middleware/server-now.ts` on every response (including 401 and 4xx). The client trusts the header's presence as a "network success" signal.
- **`POST /api/v1/client-errors`** returns 204 No Content on success; 400 on malformed; logs at `level: 'error'` / `'warn'` accordingly. Story 2.3's contract is the one Story 2.4 consumes; no server changes needed.
- **TOCTOU race in PUT** (deferred from Story 2.3 review): Story 2.4's outbox coalescing reduces but does not eliminate the race. The architecture accepts the trade-off (single-user scale; per-record LWW).
- **`clientWrittenAt` far-future poisoning** (deferred from Story 2.3 review): the `x-server-now` drift warning in the fetch wrapper is the diagnostic; no validation enforced server-side.

From **Story 2.2** (commit `5db5b6b`, status `done`):

- **`isIPhone()` and `isStandalone()`** live in `web/src/lib/platform.ts`. Story 2.4 reads `isIPhone()` from the same module. No platform-detect changes.
- **iPhone PWA cookie carries across the install boundary** (Sandy's manual proof, recorded in `MEMORY.md`). The fetch wrapper inherits the existing `credentials: 'same-origin'` cookie flow; no surface-specific handling needed.

From **Story 2.1** (commit `ee7f227`, status `done`):

- **SW config** is `skipWaiting: false, clientsClaim: false`. New SW versions wait for cold-start. Story 2.4 does NOT modify the SW config.
- **`/api/v1/songs/*` and `/api/v1/client-errors`** are already covered by the runtimeCaching rules: GET songs → NetworkFirst; non-GET → NetworkOnly. No additions needed.
- **Deferred item from Story 2.1** (`startsWith('/api/v1/songs')` without trailing slash): the architecture's path conventions don't introduce `/api/v1/songsX`; the deferred item is not a problem in 2.4.

From **Story 1.5** (commit `2a7d4ae`, status `done`):

- **`<RequireAuth>` deferred-work item:** "`shouldRedirectOn401` called with hardcoded `wasNetworkSuccess: true`". Story 2.4 addresses this per AC-9. The simpler variant (no router change; wrapper gates the dispatch) is preferred.
- **`PerformanceModeContext`** is mounted in `<AppBootstrap>` as the outermost layer (outside `<AuthProvider>`). Story 2.4 extends the context with a module-scope snapshot accessor but does NOT change the mount location.

From **Story 1.4** (commit `7384bc6`, status `done`):

- **`gigbuddy_session` cookie** is HttpOnly, Secure, SameSite=Strict, 365-day. `apiFetch`'s `credentials: 'same-origin'` is sufficient — no manual cookie manipulation.
- **Auth middleware** returns 401 with the UNAUTHORIZED envelope for any `/api/v1/*` except the skip list. Story 2.4's fetch wrapper handles 401 generically (not Songs-specific).
- **Deferred item from Story 1.4** (`daysUntilExpiry === 0` grammar): out of scope for Story 2.4. Sandy decides when to address.

### Implementation patterns reused from architecture

- **TanStack Query v5 with persisted IDB store** (architecture line 282): use the official `PersistQueryClientProvider` + `createAsyncStoragePersister` + `idb-keyval` pattern. No bespoke persister.
- **Module-scope cached singleton** (`api/src/secrets/ssm.ts`, `api/src/ddb/client.ts`): the same pattern applies to `queryClient`, the `persister`, the `unauthorizedHandler`, and the `snapshotPerformanceActive` snapshot.
- **Hoisted `vi.mock` factories** (`api/src/routes/auth.test.ts`): the new tests follow this pattern.
- **`useSyncExternalStore` for non-React stores** (React 18+): the canonical adapter for the stale-notice store. No third-party state library.
- **Class component for ErrorBoundary** (React requirement): `componentDidCatch` + `getDerivedStateFromError` is the only React surface that requires class. No `react-error-boundary` library — V1 floor is the React-native primitive.

### Latest tech information (versions verified at story-write time, 2026-06-17)

- **`@tanstack/react-query` 5.101.0** — current stable; resolved across the workspace. `useSyncExternalStore` is the recommended React 18 store-subscription primitive.
- **`@tanstack/react-query-persist-client` 5.101.0** — current stable. The `PersistQueryClientProvider` component is the recommended boot path (vs the imperative `persistQueryClient` call). It gates initial render on the restore promise — eliminates the "render-empty-then-rerender-with-cache" flash.
- **`@tanstack/query-async-storage-persister` 5.101.0** — current stable. Compatible with any AsyncStorage-like adapter; `idb-keyval`'s `get`/`set`/`del` satisfies the contract.
- **`idb-keyval` 6.2.5** — current stable. Tiny (~1KB minified), no deps, supports custom IDB stores via `createStore('db', 'store')`.
- **`nanoid` 5.1.11** — current stable; ESM-only. The `customAlphabet` API allows the 16-char URL-safe specification. Cryptographically strong.
- **`fake-indexeddb` 6.0.0** — current stable. Vitest-compatible; side-effect import (`fake-indexeddb/auto`) installs the shim globally.
- **React 19.x** — `useSyncExternalStore` is stable. Class-component lifecycle (`componentDidCatch`, `getDerivedStateFromError`) is unchanged.
- **TypeScript 5.6 strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`** — `parseRecordKey`'s `parts[1] ?? ''` is needed under `noUncheckedIndexedAccess`. The `?? ''` fallback is correct: an unparseable recordKey produces a `'unknown'` discriminant; the empty strings are never read.

### Files this story creates

- `web/src/api/client.ts` — fetch wrapper with `x-server-now`, drift warning, 401 dispatch, Zod parse
- `web/src/api/client.test.ts`
- `web/src/cache/idb.ts` — `outboxStore`, `queryCacheStore`, `idb` namespace re-export
- `web/src/sync/query-client.tsx` — `queryClient`, `persister`, `<SyncProvider>`
- `web/src/sync/query-client.test.tsx`
- `web/src/sync/persist.ts` — `requestPersistentStorage`
- `web/src/sync/persist.test.ts`
- `web/src/sync/record-key.ts` — `songRecordKey`, `parseRecordKey`
- `web/src/sync/record-key.test.ts`
- `web/src/sync/outbox.ts` — outbox primitives + coalesce rules
- `web/src/sync/outbox.test.ts`
- `web/src/sync/flusher.ts` — `flushOnce`, `startFlusher`, `backoffMs`
- `web/src/sync/flusher.test.ts`
- `web/src/sync/stale-notice-store.ts` — pub-sub for the stale-write banner
- `web/src/sync/stale-notice-store.test.ts`
- `web/src/sync/stale-write-banner.tsx`
- `web/src/sync/stale-write-banner.test.tsx`
- `web/src/sync/sync-wiring.tsx` — side-effect component installing the handlers; OPTIONAL (may inline in `app-bootstrap.tsx` instead)
- `web/src/lib/error-reporter.ts`
- `web/src/lib/error-reporter.test.ts`
- `web/src/components/error-boundary.tsx`
- `web/src/components/error-boundary.test.tsx`

### Files this story modifies

- `web/src/main.tsx` — boot wiring (SyncProvider + ErrorBoundary + startErrorReporter)
- `web/src/app-bootstrap.tsx` — add `<SyncWiring>` (or inline equivalent)
- `web/src/app-bootstrap.test.tsx` — extend coverage for the wiring path; the install-gate cases continue to pass unchanged
- `web/src/performance/performance-context.tsx` — add `getPerformanceActiveSnapshot` + snapshot-sync effect
- `web/src/performance/performance-context.test.tsx` — extend coverage for the snapshot accessor
- `web/src/routes/authenticated-shell.tsx` — mount `<StaleWriteBanner />`
- `web/src/routes/authenticated-shell.test.tsx` — extend (if it asserts on structure)
- `web/src/router.tsx` — OPTIONAL change per AC-9 (simpler variant requires no change)
- `web/src/lib/microcopy.ts` — append `BANNERS = { staleWrite, errorBoundary }`
- `web/package.json` — adds 4 deps + 1 devDep
- `pnpm-lock.yaml` — reflects the 5 added packages

### Files this story deletes

None.

### Project Structure Notes

- **Fully aligned with the architecture's directory tree** (architecture.md lines 877–914):
  - `web/src/sync/outbox.ts` — present at line 878 (`outbox.ts # outbox state machine`). Story 2.4 lands it.
  - `web/src/sync/flusher.ts` — present at line 879 (`flusher.ts # outbox flusher`). Story 2.4 lands it.
  - `web/src/sync/query-client.ts` — present at line 880 (`query-client.ts # TanStack Query setup + persister`). Story 2.4 lands it (with `.tsx` extension because it exports a React component, `<SyncProvider>`; the architecture's tree uses `.ts` but the extension is implementation detail).
  - `web/src/sync/lww.ts` — present at line 882 (`lww.ts # client-side stale-write handling`). Story 2.4 does NOT create this file as a standalone — the logic lives inside `flusher.ts`. Architecture deviation: optionally update the tree to drop this entry, or leave it for a future refactor. Not ship-blocking.
  - `web/src/cache/idb.ts` — present at line 884 (`idb.ts # IDB primitives`). Story 2.4 lands it.
  - `web/src/cache/persist.ts` — present at line 885 (`persist.ts # persister + storage.persist()`). Story 2.4 splits this: `sync/persist.ts` owns `navigator.storage.persist()`; `sync/query-client.tsx` owns the TanStack persister wiring. Architecture deviation: `cache/persist.ts` is NOT created; the responsibilities are co-located with their consumers. Not ship-blocking; update the tree as cleanup.
  - `web/src/api/client.ts` — present at line 898 (`client.ts # fetch wrapper + x-server-now handling`). Story 2.4 lands it.

- **New files not in the planned tree but introduced by Story 2.4:**
  - `web/src/sync/record-key.ts` — recordKey ↔ URL ↔ queryKey mapping. The architecture mentions `recordKey` in the outbox state machine (line 596) but doesn't earmark a file. The dev agent may optionally update the tree to add this entry.
  - `web/src/sync/stale-notice-store.ts` — the pub-sub for the stale-write banner. Architecture line 299 describes the banner; the store's location is implementation detail. Not ship-blocking.
  - `web/src/sync/stale-write-banner.tsx` — the banner UI. The architecture's `components/` tree lists `currently-performing-strip.tsx`, `gig-card.tsx`, etc., but no `stale-write-banner.tsx`. Story 2.4 places it in `sync/` because its data source is the sync layer's pub-sub store; alternative placement under `components/` is also reasonable.
  - `web/src/sync/sync-wiring.tsx` (OPTIONAL) — the bootstrap effect component. May inline in `app-bootstrap.tsx`.
  - `web/src/lib/error-reporter.ts` — present at architecture line 879's spirit (the error reporter is mentioned in AR-39 and architecture line 766), but not in the tree. Place in `lib/` because it has no React surface; the React-side `<ErrorBoundary>` is in `components/`.
  - `web/src/components/error-boundary.tsx` — present at architecture's component listing implicitly (architecture line 766 mentions React `ErrorBoundary`); not in the tree. Standard React file.

### Testing requirements

- **Unit / component (Vitest, web package):**
  - `web/src/api/client.test.ts` — ~6 cases (AC-7)
  - `web/src/sync/query-client.test.tsx` — ~3 cases (AC-1; persist round-trip; singleton contract)
  - `web/src/sync/persist.test.ts` — ~3 cases (AC-2)
  - `web/src/sync/record-key.test.ts` — ~4 cases (AC-5 + Task 4)
  - `web/src/sync/outbox.test.ts` — ~6 cases (AC-3 + AC-4)
  - `web/src/sync/flusher.test.ts` — ~10 cases (AC-5 + AC-6 + AC-13's canonical scenarios)
  - `web/src/sync/stale-notice-store.test.ts` — ~4 cases (AC-8 store)
  - `web/src/sync/stale-write-banner.test.tsx` — ~5 cases (AC-8 banner — mirrors `reauth-banner.test.tsx`)
  - `web/src/lib/error-reporter.test.ts` — ~4 cases (AC-10)
  - `web/src/components/error-boundary.test.tsx` — ~2 cases (AC-10)
  - `web/src/performance/performance-context.test.tsx` — +2 cases (AC-11)
  - `web/src/app-bootstrap.test.tsx` — +1 case (the wiring path — assert that a 401 from `apiFetch` triggers `setAuth({ status: 'unauthenticated' })`)
- **E2E (Playwright):** no new cases. The user-visible features that justify E2E land in Stories 2.5 / 2.6.
- **Manual smoke (Task 14):** Sandy verifies the two IDB databases exist and a deliberate JS error reaches CloudWatch. This is an unchecked task checkbox; the story is NOT done until both are verified (Epic 1 retro Lesson #1).

### Dev environment reminders

- **Vite HMR + module-scope singletons:** `queryClient` and the `unauthorizedHandler` are module-scope. HMR can cause double-mount during dev — the `setUnauthorizedHandler` effect's cleanup should set the handler to `null` so a stale closure doesn't fire after re-mount. The `startFlusher()` cleanup similarly unwires the listeners. The test for idempotent `startErrorReporter()` covers a related concern.
- **`fake-indexeddb` test setup:** import `'fake-indexeddb/auto'` at the top of any test that touches IndexedDB. The shim is per-test-file (the auto-import installs it globally for the file's lifetime); Vitest's test isolation (one Vitest worker per file by default) gives each file a fresh shim. Inside the file, call `__resetOutboxForTests()` in `beforeEach` to clear the store between cases.
- **Local API dev:** `pnpm dev:api` runs the Hono server at `localhost:3100`; `pnpm dev:web` proxies `/api/*` to it. Both `pnpm dev` runs them in parallel. To exercise the sync layer end-to-end locally, run both, then open `http://localhost:5273` and watch DevTools → Application → IndexedDB.
- **Auth cookie locally:** `POST /api/v1/auth/login` with the bootstrap password (Sandy's local SSM value) sets the `gigbuddy_session` cookie. The fetch wrapper's `credentials: 'same-origin'` inherits it.
- **`@aws-sdk/*` package versions:** web has no AWS SDK deps. The Lambda's DDB layer is server-only. Do NOT add any AWS SDK to `web/`.
- **Node 22, pnpm 11.0.9** — pinned. Do not bump.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#4. Sync & Offline (FR-30–32)] (lines 277–308) — TanStack persistence, outbox coalescing, server LWW, `x-server-now`, SW strategy.
- [Source: _bmad-output/planning-artifacts/architecture.md#Outbox state machine (client side)] (lines 590–623) — `OutboxEntry` shape, enqueue rules, flush rules, retry triggers, exponential backoff.
- [Source: _bmad-output/planning-artifacts/architecture.md#Pre-fetch rules] (lines 625–649) — `onForeground` (Story 4.5) and `onStartPerformance` (Story 4.1); NOT this story.
- [Source: _bmad-output/planning-artifacts/architecture.md#Performance Mode invariants] (lines 652–675) — `performanceActive` semantics; banner suppression rule (AR-28); the snapshot accessor is the non-React surface.
- [Source: _bmad-output/planning-artifacts/architecture.md#Error handling] (lines 740–753) — TanStack retry, 4xx-is-a-bug, Performance Mode rule layered on top.
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging] (lines 755–766) — client error reporter contract; structured JSON log line.
- [Source: _bmad-output/planning-artifacts/architecture.md#API response envelope] (lines 496–520) — `ok`, `applied`, `dropped-as-stale`, `error` shapes; `x-server-now` on every response.
- [Source: _bmad-output/planning-artifacts/architecture.md#Service worker strategy table] (lines 677–690) — SW caching; outbox owns offline writes.
- [Source: _bmad-output/planning-artifacts/architecture.md#State management taxonomy] (lines 718–731) — TanStack for server data; Context for performance flag; IDB for outbox.
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural boundaries] (lines 1017–1027) — `web ↔ api` HTTP only; UI consumes hooks (sync layer never imported directly by UI per AR-45).
- [Source: _bmad-output/planning-artifacts/architecture.md#Directory tree] (lines 840–1015) — `web/src/sync/`, `web/src/cache/`, `web/src/api/` subtrees.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] (lines 788–854) — verbatim AC text.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] (lines 269–283) — epic objectives; key ARs (AR-9, AR-11, AR-20, AR-21, AR-22, AR-23, AR-24, AR-26, AR-27, AR-39, AR-42, AR-43, AR-44, AR-45).
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] AR-20 (line 148), AR-21 (line 149), AR-23 (line 151), AR-24 (line 152), AR-39 (line 177), AR-45 (line 185), AR-46 (line 186), AR-47 (line 189), AR-48 (line 190).
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md] — Lesson #1 (manual checkbox), Lesson #4 (integration test coverage); deferred items from Story 1.4 (re-auth grammar) and Story 1.5 (`shouldRedirectOn401` hardcoded `wasNetworkSuccess`).
- [Source: _bmad-output/implementation-artifacts/2-3-song-api-ddb-persistence-client-errors-endpoint.md] — Story 2.3 contract: server endpoints + `x-server-now` middleware + LWW.
- [Source: _bmad-output/implementation-artifacts/2-2-iphone-pwa-install-gate.md] — install gate; `isStandalone()`.
- [Source: _bmad-output/implementation-artifacts/2-1-service-worker-pwa-manifest.md] — SW config (no change needed in 2.4).
- [Source: _bmad-output/implementation-artifacts/1-5-navigation-chrome-scaffold.md] — `<RequireAuth>`, `PerformanceModeContext`, `<ReauthBanner>` template for `<StaleWriteBanner>`.
- [Source: _bmad-output/implementation-artifacts/1-4-access-gate-single-password-jwt-cookie-ssm.md] — auth cookie + 401 envelope.
- [Source: api/src/middleware/server-now.ts] — server-side `x-server-now` emission.
- [Source: api/src/routes/songs.ts] — PUT `applied` / `dropped-as-stale` envelopes; bandId / songId validation.
- [Source: api/src/routes/client-errors.ts] — POST 204 No Content; CloudWatch log shape.
- [Source: shared/src/schemas/song.ts] — `SongSchema`, `SongPutInputSchema`.
- [Source: shared/src/schemas/client-error.ts] — `ClientErrorReportSchema`, `ClientErrorReport` type.
- [Source: shared/src/schemas/api.ts] — `OkResponseSchema`, `AppliedResponseSchema`, `DroppedAsStaleResponseSchema`, `ErrorResponseSchema`.
- [Source: shared/src/active-band.ts] — `ACTIVE_BAND_ID`, `ACTIVE_BAND_NAME`.
- [Source: web/src/main.tsx] — current `QueryClientProvider` mounting (replaced by `<SyncProvider>`).
- [Source: web/src/app-bootstrap.tsx] — current boot sequence; gains `<SyncWiring>`.
- [Source: web/src/performance/performance-context.tsx] — existing context surface; gains snapshot accessor.
- [Source: web/src/routes/authenticated-shell.tsx] — gains `<StaleWriteBanner />`.
- [Source: web/src/components/reauth-banner.tsx] + `reauth-banner.test.tsx` — pattern template for `<StaleWriteBanner>`.
- [Source: web/src/auth/redirect-on-401.ts] — `wasNetworkSuccess` contract; AC-9 leverages without changes (simpler variant).
- [Source: web/src/lib/microcopy.ts] — pattern for the new `BANNERS` constant.
- [Source: web/vite.config.ts] — SW config (no change needed in 2.4).
- [Source: CLAUDE.md] — boundaries; Zod single source of truth; React Router 7 imports from `react-router`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — claude-opus-4-7

### Debug Log References

- Initial `flusher.test.ts` cases that combined `vi.useFakeTimers()` with `fake-indexeddb` operations stalled the IDB read paths (fake-indexeddb's internal scheduling depends on the real microtask queue and clock). Restructured to use real timers with `await tick()` micro-waits for event-listener tests, and added a separate `setInterval` spy assertion for the 30s periodic-tick contract.
- `app-bootstrap.test.tsx` leaked unhandled rejections from the `SyncWiring` effect (jsdom has no `indexedDB`). Imported `fake-indexeddb/auto` at the top of that file specifically (per AC-3's "side-effect import per test file is intentional" guidance).
- Hit an `act(...)` warning when the SyncWiring integration test triggered `setAuth` from inside an `apiFetch` call; wrapped that call in `act(async () => { ... })`.

### Completion Notes List

- AC-9 variant chosen: **simpler variant** — `<RequireAuth>` and `redirect-on-401.ts` are unchanged. The fetch wrapper's `wasNetworkSuccess` gating (only dispatches the unauthorized handler when the response carries `x-server-now`) is the load-bearing invariant. The handler installer (`<SyncWiring>`) calls `setAuth({ status: 'unauthenticated' })` only on real-network 401s, so `shouldRedirectOn401({ wasNetworkSuccess: true })`'s hardcoded `true` remains correct.
- `web/src/sync/lww.ts` was NOT created (architecture deviation acknowledged in story spec). The `dropped-as-stale` branch lives inline in `flusher.ts` — small enough that a standalone file would be an empty shell.
- `web/src/cache/persist.ts` was NOT created (architecture deviation acknowledged). Responsibilities are split: `sync/persist.ts` owns `navigator.storage.persist()`; `sync/query-client.tsx` owns the TanStack persister wiring.
- `web/src/sync/query-client.tsx` uses the `.tsx` extension (not `.ts` per the architecture tree) because it exports a React component (`<SyncProvider>`).
- Outbox `enqueue()` uses a single `idb-keyval` `entries(outboxStore)` read + targeted `set`/`del` — IDB transactions serialise concurrent writes for the single-tab V1 case.
- The flusher's `startFlusher()` no longer calls `void maintainPeriodicInterval()` separately — the interval-arming logic is inside `runFlushCycle()` so a single race-free pass handles initial drain + periodic arming.
- `nanoid(16)` (default alphabet — URL-safe A-Z a-z 0-9 _-) is used directly for outbox IDs; `customAlphabet` wasn't needed because the default alphabet already satisfies AR-47's URL-safe requirement and the second positional argument sets the length.

### File List

**Created**:
- `web/src/api/client.ts`
- `web/src/api/client.test.ts`
- `web/src/cache/idb.ts`
- `web/src/components/error-boundary.tsx`
- `web/src/components/error-boundary.test.tsx`
- `web/src/lib/error-reporter.ts`
- `web/src/lib/error-reporter.test.ts`
- `web/src/sync/flusher.ts`
- `web/src/sync/flusher.test.ts`
- `web/src/sync/outbox.ts`
- `web/src/sync/outbox.test.ts`
- `web/src/sync/persist.ts`
- `web/src/sync/persist.test.ts`
- `web/src/sync/query-client.tsx`
- `web/src/sync/query-client.test.tsx`
- `web/src/sync/record-key.ts`
- `web/src/sync/record-key.test.ts`
- `web/src/sync/stale-notice-store.ts`
- `web/src/sync/stale-notice-store.test.ts`
- `web/src/sync/stale-write-banner.tsx`
- `web/src/sync/stale-write-banner.test.tsx`
- `web/src/sync/sync-wiring.tsx`

**Modified**:
- `web/src/main.tsx` — wraps tree in `<SyncProvider><ErrorBoundary>...`; calls `startErrorReporter()` at module scope; removes the local `QueryClient` construction
- `web/src/app-bootstrap.tsx` — mounts `<SyncWiring />` inside `<AuthProvider>`
- `web/src/app-bootstrap.test.tsx` — adds `fake-indexeddb/auto` import; adds the SyncWiring/401 integration case
- `web/src/performance/performance-context.tsx` — adds `getPerformanceActiveSnapshot()` + the snapshot-sync effect
- `web/src/performance/performance-context.test.tsx` — adds the snapshot-accessor cases
- `web/src/routes/authenticated-shell.tsx` — mounts `<StaleWriteBanner />` after `<ReauthBanner />`
- `web/src/lib/microcopy.ts` — appends `BANNERS = { staleWrite, errorBoundary }`
- `web/package.json` — adds 4 deps + 1 devDep
- `pnpm-lock.yaml` — reflects the 5 added packages and their transitive deps

## Change Log

| Date       | Change                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| 2026-06-17 | Story spec created (status: ready-for-dev). Builds on Story 2.3 (server LWW + client-errors endpoint + x-server-now middleware). Lands the client-side sync spine of Epic 2: TanStack Query persisted to IDB, outbox with per-record coalescing, flusher with retry/backoff, fetch wrapper with x-server-now drift check + 401 dispatch, stale-write banner (MacBook-only, suppressed in Performance Mode), error reporter wired to window.onerror / unhandledrejection / React ErrorBoundary. Stories 2.5 and 2.6 will consume via hooks. |
| 2026-06-17 | Story implemented. All ACs satisfied; 73 api tests + 146 web tests green; lint clean; web build green (392 KB / 120 KB gzipped, +~12 KB for the sync surface). AC-9 simpler variant chosen (no router change). Manual smoke (Task 14) remains unchecked pending Sandy's IDB + CloudWatch verification post-deploy. |
