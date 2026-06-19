---
baseline_commit: 5808b86
builds_on: 3-1-setlist-api-ddb-persistence
---

# Story 3.2: Setlists home — Tonight / Upcoming / Past (FR-14, FR-23)

Status: review

## Story

As Sandy,
I want the Setlists home surface to present one scrollable sectioned list of my Gigs — Tonight at the top, Upcoming next, Past below — on both surfaces,
so that opening the app on gig night puts the right Setlist a single tap away.

## Acceptance Criteria

**AC-1 — Route and sectioned structure**

**Given** the `/` route post-login
**When** the route renders
**Then** the Setlists home surface displays three sections in this order: Tonight, Upcoming, Past
**And** the layout is a single scrollable vertical list (no carousel, no horizontal scroll, no tabs between sections)
**And** the route applies the Practice atmosphere on MacBook and the Performance atmosphere on iPhone (outside Performance Mode) — this is already handled by `applyBootAtmosphere()` wired in `web/src/main.tsx`; no route-level logic needed

**AC-2 — Tonight slot: gig dated today gets TONIGHT badge**

**Given** a Setlist whose `gigMeta.date` matches today in Europe/London time
**When** the home surface renders
**Then** the Tonight slot displays that Setlist as a `GigCard` with the `TONIGHT` badge top-left
**And** the badge uses the `accent` token (`--color-accent`)
**And** that Setlist does NOT also appear in any other section

**AC-3 — Tonight slot: fallback to next upcoming when no today gig**

**Given** no Setlist is dated today AND at least one Upcoming Setlist exists
**When** the home surface renders
**Then** the Tonight slot displays the next upcoming Setlist as a `GigCard` without the `TONIGHT` badge
**And** that Setlist does NOT also appear in the Upcoming list below (promoted, not duplicated)

**AC-4 — Tonight slot: empty state when no today and no upcoming**

**Given** no Setlist is dated today AND no Upcoming Setlist exists
**When** the home surface renders
**Then** the Tonight slot displays the empty state `No upcoming gigs.` (constant from `EMPTY_STATES.noUpcomingGigs` in `web/src/lib/microcopy.ts`)
**And** the Past list still renders below if any Past Setlists exist
**And** no "create new setlist" CTA is shown in the empty state (per EXPERIENCE.md State Patterns)

**AC-5 — Upcoming section**

**Given** Setlists exist after today (excluding any promoted to Tonight)
**When** the home surface renders
**Then** the Upcoming section lists them in chronological order (soonest first)
**And** each is a `GigCard` without the `TONIGHT` badge
**And** if no upcoming Setlists remain after promotion (all consumed by Tonight slot), the Upcoming section renders no cards (section heading may be omitted or show empty — see Dev Notes on section heading visibility)

**AC-6 — Past section**

**Given** Setlists exist before today
**When** the home surface renders
**Then** the Past section lists them in reverse chronological order (most recent first)
**And** each is a `GigCard` without the `TONIGHT` badge

**AC-7 — GigCard component**

**Given** the `GigCard` component (`web/src/components/gig-card.tsx` — NEW)
**When** rendered for a Tonight-slot card (badge=true)
**Then** it shows a `TONIGHT` badge at top-left in `accent` token
**And** it shows venue in editorial serif (`--font-serif-editorial`) at `home-tonight` token size (`--text-home-tonight: 28px`)
**And** it shows date + time in mono (`--font-mono-slab`) at practice body size in `text-secondary`
**And** the card uses a warm surface fill: `background-color: var(--color-surface)` with `box-shadow: var(--shadow-card)`
**And** the card uses `border-radius: var(--radius-card)` (16px)
**And** the card's tap/click target satisfies `min-h-tap` (44px minimum height)

**Given** a `GigCard` without badge
**When** rendered
**Then** all the above applies except no `TONIGHT` badge element is present

**Given** Sandy taps any `GigCard`
**When** the tap is registered
**Then** the router navigates to `/setlists/:setlistId`

**AC-8 — "Today" is Europe/London calendar date; re-evaluates on foreground**

**Given** Tonight / Upcoming sectioning is computed
**When** the home surface renders
**Then** "today" is determined by `Europe/London` calendar date (not UTC) so a Saturday gig at 23:59 Europe/London is "Tonight" until midnight London time
**And** the computation uses the `Intl.DateTimeFormat` API with `timeZone: 'Europe/London'` to get the current YYYY-MM-DD date string for comparison

**Given** the user foregrounds the app after midnight (visibilitychange to visible)
**When** the home surface is visible
**Then** the Tonight/Upcoming/Past sectioning re-evaluates so a stale session correctly rolls over at midnight (the Setlist that was "Tonight" yesterday moves to "Past")

**AC-9 — Router update: `/setlists/:setlistId` stub route**

**Given** `web/src/router.tsx` (UPDATE)
**When** reviewed
**Then** it adds `{ path: 'setlists/:setlistId', element: <SetlistOverview /> }` as a child route of the authenticated shell
**And** `SetlistOverview` is a stub component in `web/src/routes/setlist-overview.tsx` (NEW) that renders the `setlistId` path param as a placeholder heading (`<h1>Setlist {setlistId}</h1>`) — the full implementation is Story 3.3
**And** `web/src/hooks/use-tonight-gig.ts` (NEW) is created (see AC-10)
**And** the `/` index route continues to render `<Home />`

**AC-10 — `web/src/hooks/use-tonight-gig.ts` — computed TanStack selector**

**Given** `web/src/hooks/use-tonight-gig.ts` (NEW)
**When** reviewed
**Then** it exports `function useTonightGig(): Setlist | null` (not a full `UseQueryResult` — a computed derived value)
**And** it calls `useSetlists()` internally and applies `sectionSetlists(setlists, todayLondon())` (the same pure function used by `Home` for sectioning) to extract just the `tonight` entry
**And** it returns `null` while setlists are loading or if no tonight gig applies
**And** it is intended for use by Epic 4's pre-fetch logic (AR-25); Story 3.2 only creates it — it does NOT need to be consumed in this story's UI yet
**And** `web/src/hooks/use-tonight-gig.test.tsx` (NEW) covers: returns `null` on empty list; returns the today gig when dated today; returns the next upcoming when no today gig; returns `null` when no upcoming at all

**AC-11 — `web/src/lib/gig-date.ts` — London timezone utilities**

**Given** `web/src/lib/gig-date.ts` (NEW)
**When** reviewed
**Then** it exports:
- `todayLondon(): string` — returns the current date as `YYYY-MM-DD` in `Europe/London` timezone, using `Intl.DateTimeFormat` (NOT `new Date().toISOString().slice(0, 10)` which is UTC)
- `sectionSetlists(setlists: Setlist[], today: string): { tonight: Setlist | null; upcoming: Setlist[]; past: Setlist[] }` — pure function that takes all setlists and a `today` string:
  - `tonight`: Setlist with `gigMeta.date === today` (if any); otherwise the first setlist with `gigMeta.date > today` (promoted); otherwise `null`
  - `upcoming`: all setlists with `gigMeta.date > today` EXCLUDING the one promoted to tonight (chronological order, soonest first)
  - `past`: all setlists with `gigMeta.date < today` in reverse chronological order (most recent first)
**And** `web/src/lib/gig-date.test.ts` (NEW) covers:
  - `todayLondon()`: returns a YYYY-MM-DD string; behavior differs from UTC at the Europe/London midnight boundary (a test using a mocked clock near midnight shows the difference)
  - `sectionSetlists()`: today gig → tonight + no duplicate in upcoming; no today gig + upcoming exists → first upcoming promoted to tonight + removed from upcoming list; no today gig + no upcoming → tonight is null; past setlists in reverse order; empty input → all sections empty

**AC-12 — `Home` route (`web/src/routes/home.tsx`) — full implementation**

**Given** `web/src/routes/home.tsx` (UPDATE — currently the Epic 1 empty-state stub)
**When** the route renders with setlists loading
**Then** the component calls `useSetlists()` and computes sectioning via `sectionSetlists(setlists.data ?? [], todayLondon())`
**And** while loading (`setlists.isPending`), the Tonight slot renders a loading skeleton or simply nothing (no spinner, no text); do NOT use a full-page loading state
**And** on load error, the Tonight slot renders the `No upcoming gigs.` empty state (quiet, per AR-28 / EXPERIENCE.md State Patterns — no error toast from the Home route itself; TanStack Query handles retries globally)

**Given** the computed `{ tonight, upcoming, past }` sections
**When** sections are rendered
**Then** the Tonight section heading renders "Tonight" in an appropriate hierarchy (e.g., `<h2>`)
**And** the Upcoming section heading renders "Upcoming"
**And** the Past section heading renders "Past"
**And** section headings are visually present only when their sections have content (Tonight heading always shows; Upcoming and Past headings omit when empty — see Dev Notes)
**And** section headings use `text-secondary` at `section-heading` size per token scale (`--text-section-heading: 22px`)

**AC-13 — `web/src/routes/home.tsx` — foreground re-evaluation**

**Given** the Home route is rendered and the user backgrounds / foregrounds the app
**When** a `visibilitychange` event fires with `document.visibilityState === 'visible'`
**Then** the sectioning recomputes (by calling `todayLondon()` freshly — if the date has changed since last visible, the sections update)
**And** this is implemented via a `useEffect` that listens to `visibilitychange` and triggers a state update (e.g., an incrementing `tick` state value) causing re-render
**And** the `useSetlists()` cache is NOT force-invalidated on foreground — TanStack Query's default refetch-on-window-focus handles data freshness; sectioning re-derives from whatever data is in cache

**AC-14 — `web/src/components/gig-card.tsx` component contract**

**Given** `web/src/components/gig-card.tsx` (NEW)
**When** the component API is reviewed
**Then** props are: `setlist: Setlist`, `showBadge?: boolean`, with `showBadge` defaulting to `false`
**And** the card renders as a `<button>` element (not an `<a>` tag) invoking `useNavigate()` from `react-router` to navigate to `/setlists/:setlistId` on click/tap — this follows the `LibrarySongRow` pattern in `web/src/components/library-song-row.tsx` which uses `<button>` + `useNavigate()`
**And** the card renders venue using `Setlist.gigMeta.venue` at `home-tonight` size in editorial serif
**And** the card renders the date from `gigMeta.date` (ISO date string, e.g., `"2026-06-21"`) formatted as a human-readable string (e.g., `"21 Jun 2026"` or `"Sat 21 Jun"` — pick a consistent locale-neutral format; see Dev Notes for formatting approach)
**And** the card renders time from `gigMeta.time` (optional `HH:MM` 24h string) appended to date if present (e.g., `"21 Jun · 20:00"`) — if absent, renders date only
**And** the `TONIGHT` badge is a `<span>` with text `TONIGHT` styled with `background-color: var(--color-accent)` and `color: var(--color-bg)` (badge text should be readable against the accent background)
**And** the card has `aria-label` composed from venue + date + (time if present) so the accessible name includes all key information (e.g., `aria-label="The Jazz Cafe, 21 Jun, 20:00, Tonight"`)
**And** `web/src/components/gig-card.test.tsx` (NEW) covers: renders venue; renders date; renders time when present; omits time when absent; renders TONIGHT badge when `showBadge=true`; does NOT render badge when `showBadge=false`; tap navigates to `/setlists/:setlistId` (use `MemoryRouter` + `createRoutesFromElements` per existing component test patterns)

**AC-15 — Microcopy: extend `web/src/lib/microcopy.ts`**

**Given** `web/src/lib/microcopy.ts` (UPDATE)
**When** reviewed
**Then** `ACTIONS` is extended with:
```ts
newSetlist: '+ New setlist',
```
**And** section heading labels are NOT added to microcopy (they are plain English "Tonight", "Upcoming", "Past" — inline string literals are fine; only locked voice-and-tone strings go in the microcopy module per Story 1.2)
**And** no other changes to `EMPTY_STATES`, `BANNERS`, or `FIELD_LABELS`

**AC-16 — Verification pass**

**Given** the implementation is complete
**When** verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages — new files compile under `strict: true`
**And** `pnpm lint` is green via Biome — kebab-case filenames; camelCase identifiers; no new `biome-ignore` directives beyond patterns already in the repo
**And** `pnpm test` is green — new tests pass; no regressions against Story 3.1 baseline (web 233, api 103)
**And** `pnpm build:web` is green; `pnpm-lock.yaml` is unchanged (no new runtime dependencies)

**AC-17 — Commit checkpoint**

**Given** the implementation is complete and all verification passes
**When** the story is marked done
**Then** an explicit commit has been created containing all new and modified files listed in the File List
**And** `git status --porcelain` is clean (no uncommitted changes in the story's touched paths)

## Tasks / Subtasks

- [x] **Task 1 — `web/src/lib/gig-date.ts` + tests** (AC: 8, 11)
  - [x] Create `web/src/lib/gig-date.ts` with `todayLondon()` and `sectionSetlists()`
  - [x] `todayLondon()`: use `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })` and reformat to `YYYY-MM-DD`
  - [x] `sectionSetlists()`: pure function — no side effects, no imports of React or TanStack
  - [x] Create `web/src/lib/gig-date.test.ts` covering all AC-11 test cases (use `vi.setSystemTime()` for clock-dependent tests)
  - [x] Run `pnpm typecheck` to confirm the new module compiles

- [x] **Task 2 — `web/src/components/gig-card.tsx` + test** (AC: 7, 14)
  - [x] Create `web/src/components/gig-card.tsx` using `<button>` + `useNavigate()` pattern (mirrors `web/src/components/library-song-row.tsx`)
  - [x] Props: `setlist: Setlist`, `showBadge?: boolean`
  - [x] Render venue at `home-tonight` size (`text-[length:var(--text-home-tonight)]`) in editorial serif (`font-[family-name:var(--font-serif-editorial)]`)
  - [x] Render date+time in mono (`font-[family-name:var(--font-mono-slab)]`) at practice body size (`text-[length:var(--text-practice-body)]`) in `text-secondary`
  - [x] TONIGHT badge: `<span>` with `TONIGHT` text, accent background, bg text, visible only when `showBadge=true`
  - [x] Card surface: `bg-[color:var(--color-surface)]`, `shadow-[var(--shadow-card)]`, `rounded-[var(--radius-card)]`, `min-h-tap`
  - [x] `aria-label` composed from venue + date + optional time + "Tonight" if badge shown
  - [x] Create `web/src/components/gig-card.test.tsx` covering AC-14 test cases
  - [x] Read `web/src/components/library-song-row.tsx` and `web/src/components/library-song-row.test.tsx` first to match the test pattern exactly

- [x] **Task 3 — `web/src/hooks/use-tonight-gig.ts` + test** (AC: 10)
  - [x] Create `web/src/hooks/use-tonight-gig.ts` — calls `useSetlists()` + `sectionSetlists()` + `todayLondon()`; returns `Setlist | null`
  - [x] Create `web/src/hooks/use-tonight-gig.test.tsx` covering AC-10 test cases
  - [x] NOTE: this hook is NOT wired into any UI in this story — it's foundation for AR-25 pre-fetch in Epic 4

- [x] **Task 4 — `web/src/routes/setlist-overview.tsx` stub + router update** (AC: 9)
  - [x] Create `web/src/routes/setlist-overview.tsx` as a stub using `useParams()` from `react-router` to read `setlistId`; renders `<h1>Setlist {setlistId}</h1>` placeholder
  - [x] Update `web/src/router.tsx`: add `import { SetlistOverview } from './routes/setlist-overview.js'` and `{ path: 'setlists/:setlistId', element: <SetlistOverview /> }` as a child of the authenticated shell
  - [x] Confirm existing routes (`/library`, `/songs/new`, `/songs/:songId`, `/login`) are unchanged
  - [x] Run `pnpm typecheck` to confirm router compiles

- [x] **Task 5 — `web/src/routes/home.tsx` full implementation** (AC: 1–6, 12, 13)
  - [x] UPDATE `web/src/routes/home.tsx`: replace the Epic 1 empty-state stub with the full Tonight/Upcoming/Past sectioned list
  - [x] Import `useSetlists`, `GigCard`, `sectionSetlists`, `todayLondon`, `EMPTY_STATES`
  - [x] Implement `visibilitychange` listener for foreground re-evaluation (AC-13)
  - [x] Render three sections in order: Tonight, Upcoming, Past
  - [x] Section headings: use `<h2>` with `text-secondary` color, `section-heading` size
  - [x] Tonight section: always renders with heading; shows `GigCard showBadge={true}` for today gig, `GigCard showBadge={false}` for promoted-upcoming gig, or `<p>{EMPTY_STATES.noUpcomingGigs}</p>` for empty state
  - [x] Upcoming section: renders heading + cards only when `upcoming.length > 0`
  - [x] Past section: renders heading + cards only when `past.length > 0`
  - [x] Each card in Upcoming/Past uses `showBadge={false}`

- [x] **Task 6 — `web/src/lib/microcopy.ts` update** (AC: 15)
  - [x] Add `newSetlist: '+ New setlist'` to `ACTIONS`
  - [x] Confirm no other changes

- [x] **Task 7 — Verification pass** (AC: 16)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green via Biome (run `pnpm lint --write` to auto-fix formatting if needed)
  - [x] `pnpm test` green — confirm no regressions; note new test count
  - [x] `pnpm build:web` green; `pnpm-lock.yaml` unchanged

- [ ] **Task 8 — Commit checkpoint** (AC: 17) _(deferred — orchestration workflow owns the commit after review steps pass)_
  - [ ] `git add` all new and modified files listed in the File List
  - [ ] `git commit` with a descriptive message
  - [ ] Confirm `git status --porcelain` is clean

## Dev Notes

### This story's scope

Story 3.2 is the **first visible UI story in Epic 3**. It builds entirely on the hooks and API client delivered in Story 3.1. No new server-side code. No new shared schemas.

**What this story delivers:**
- `web/src/lib/gig-date.ts` — pure London-timezone sectioning logic
- `web/src/components/gig-card.tsx` — the card component for Setlist rows
- `web/src/hooks/use-tonight-gig.ts` — computed hook (Epic 4 pre-fetch foundation)
- `web/src/routes/setlist-overview.tsx` — stub to make navigation not crash
- `web/src/router.tsx` update — adds the stub route
- `web/src/routes/home.tsx` update — replaces the Epic 1 empty-state stub with the real implementation
- `web/src/lib/microcopy.ts` minor update

**What this story does NOT deliver:**
- Full Setlist overview surface (Story 3.3)
- Setlist creation (Story 3.4)
- Paste-to-parse (Story 3.5)
- Drag-reorder (Story 3.6)
- Pre-fetch wiring (AR-25, Story 4.x)
- The `+ New setlist` affordance in nav/chrome (Story 3.4 wires this into the `<TopNav rightActions>` slot built in Story 1.5)

### Architecture compliance

**AR-45 (architecture.md):** UI reads via hooks only. `Home` imports `useSetlists()` — no direct `apiFetch` calls, no direct outbox imports.

**AR-46 (architecture.md):** No analytics SDK. No Redux/Zustand/Jotai. State management is `useSetlists()` (TanStack Query) + `useState` for the `tick` re-evaluation counter.

**AR-28 (architecture.md):** `performanceActive` invariants. The Home route does not read `performanceActive` — it is not involved in Performance Mode. No special handling needed here.

**AR-48 (architecture.md):** Timestamps are ISO-8601. `gigMeta.date` is an ISO date string (`YYYY-MM-DD`). String comparison (`date > today` etc.) is valid for ISO date strings — they sort lexicographically.

**Architecture.md "Theme atmosphere":** Atmosphere is set at boot time by `applyBootAtmosphere()` in `web/src/main.tsx`. MacBook → `practice`, iPhone → `performance`. The `Home` route does NOT set the atmosphere itself — this is global, session-scoped, and already handled. No `data-atmosphere` manipulation in this story.

### Patterns to reuse exactly

**`LibrarySongRow` pattern for `GigCard`:**
```tsx
// web/src/components/library-song-row.tsx uses <button> + useNavigate()
// GigCard must follow the same pattern — NOT <a href>
// Read that file BEFORE implementing GigCard
```

**Token utility classes (Tailwind v4 inline syntax):**
The project uses inline CSS variable references rather than Tailwind utility names for design tokens. From existing components:
```tsx
// Color token pattern:
className="text-[color:var(--color-text-secondary)]"
className="bg-[color:var(--color-surface)]"

// Type scale pattern:
className="text-[length:var(--text-home-tonight)]"
className="leading-[var(--text-home-tonight--line-height)]"

// Font family pattern:
className="font-[family-name:var(--font-serif-editorial)]"
className="font-[family-name:var(--font-mono-slab)]"

// Tap target:
className="min-h-tap"  // --spacing-tap: 44px is in @theme so Tailwind generates this
```
Study `web/src/components/library-song-row.tsx`, `web/src/components/bottom-tabs.tsx`, and `web/src/routes/home.tsx` (current stub) for exact patterns. Do NOT hard-code hex colors.

**`useSetlists()` hook (from Story 3.1):**
```ts
// web/src/hooks/use-setlists.ts — already implemented
// Returns UseQueryResult<Setlist[], Error>
// Server returns setlists in ascending date order (GSI1 gsi1sk — soonest first)
// Story 3.2 handles Tonight/Upcoming/Past sectioning at the UI layer
import { useSetlists } from '../hooks/use-setlists.js';
```

**`EMPTY_STATES.noUpcomingGigs` from microcopy:**
```ts
import { EMPTY_STATES } from '../lib/microcopy.js';
// 'No upcoming gigs.' — use this constant, do not inline the string
```

### `todayLondon()` implementation note

**Do NOT use** `new Date().toISOString().slice(0, 10)` — that is UTC, not London time. A gig on Saturday 21 June at 23:45 London (BST, UTC+1) would be UTC 22:45, which is still Saturday — but on UTC-midnight-straddling dates they diverge.

**Correct implementation:**
```ts
export function todayLondon(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const day = parts.find((p) => p.type === 'day')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const year = parts.find((p) => p.type === 'year')!.value;
  return `${year}-${month}-${day}`;
}
```
Or equivalently using `Intl.DateTimeFormat.format()` with the full date and string parsing — but `formatToParts` is more reliable. Test with `vi.setSystemTime()` in Vitest.

### `sectionSetlists()` implementation note

The server returns Setlists in ascending `gsi1sk` order (date ascending — soonest first). You can rely on this ordering. However, `sectionSetlists` is a pure function that receives whatever array `useSetlists()` returns, so it should re-sort defensively:

```ts
export function sectionSetlists(setlists: Setlist[], today: string) {
  const sorted = [...setlists].sort((a, b) =>
    a.gigMeta.date.localeCompare(b.gigMeta.date)
  );
  const todayGig = sorted.find((s) => s.gigMeta.date === today) ?? null;
  const future = sorted.filter((s) => s.gigMeta.date > today);
  const past = sorted.filter((s) => s.gigMeta.date < today).reverse();

  let tonight: Setlist | null = null;
  let upcoming: Setlist[] = [];

  if (todayGig) {
    tonight = todayGig;
    upcoming = future; // today gig in tonight; all future in upcoming
  } else if (future.length > 0) {
    tonight = future[0]; // promote nearest future gig
    upcoming = future.slice(1);
  }

  return { tonight, upcoming, past };
}
```

### Date formatting for GigCard display

`gigMeta.date` is `YYYY-MM-DD` (ISO date string). Format it for display — a simple, locale-neutral approach:

```ts
// Use Intl.DateTimeFormat for human-readable date, no external deps
function formatGigDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day); // local — just for display
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date); // "21 Jun 2026"
}
```

`gigMeta.time` is optional `HH:MM` 24h format. Display as-is (no conversion needed).

Combined display: `"21 Jun 2026"` or `"21 Jun 2026 · 20:00"` when time is present.

### Section heading visibility

The AC says:
- "Tonight" heading: always present (even when empty state)
- "Upcoming" and "Past" headings: only rendered when section has content

Rationale: On a typical day Sandy opens the app and expects to see the Tonight slot immediately. The "Tonight" heading anchors the layout. Upcoming and Past headings would be confusing when empty because they'd imply content that isn't there.

Implementation example:
```tsx
{/* Tonight — always shown */}
<section>
  <h2 className="...">Tonight</h2>
  {tonight ? <GigCard setlist={tonight} showBadge={tonight.gigMeta.date === today} /> : <p>{EMPTY_STATES.noUpcomingGigs}</p>}
</section>

{/* Upcoming — only when content exists */}
{upcoming.length > 0 && (
  <section>
    <h2 className="...">Upcoming</h2>
    {upcoming.map((s) => <GigCard key={s.setlistId} setlist={s} />)}
  </section>
)}

{/* Past — only when content exists */}
{past.length > 0 && (
  <section>
    <h2 className="...">Past</h2>
    {past.map((s) => <GigCard key={s.setlistId} setlist={s} />)}
  </section>
)}
```

### `visibilitychange` foreground re-evaluation

The `tick` counter pattern is the simplest approach that avoids stale closures:

```tsx
const [tick, setTick] = useState(0);

useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') setTick((t) => t + 1);
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, []);

// `tick` included in deps ensures re-render; `todayLondon()` called fresh each render
const today = todayLondon(); // called at render time — re-evaluates on tick
```

### GigCard uses `<button>` + `useNavigate()`

Study `web/src/components/library-song-row.tsx` before writing `GigCard`. It uses:
```tsx
const navigate = useNavigate();
// ...
<button onClick={() => navigate(`/songs/${song.songId}`)} ...>
```
`GigCard` should do the same with `/setlists/${setlist.setlistId}`. This is intentional per the architecture — card-style components in this app are `<button>` elements for consistent keyboard/tap behavior, not `<a>` tags (which would add href semantics and default browser navigation behaviors that conflict with React Router).

### Test patterns (Vitest + React Testing Library)

For component tests with React Router, use `MemoryRouter` from `react-router`. See existing test files for the exact pattern. For hook tests, see `web/src/hooks/use-setlists.test.tsx`.

For `gig-date.test.ts` with time mocking:
```ts
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
// Mock system time:
vi.setSystemTime(new Date('2026-06-21T23:00:00Z')); // e.g., 23:00 UTC = 00:00 BST next day
// ... test that todayLondon() returns the BST date, not the UTC date
vi.useRealTimers(); // cleanup
```

### Testing count baseline

Story 3.1 exit counts: **web 233, api 103**.

Story 3.2 new test files (estimate):
- `web/src/lib/gig-date.test.ts`: ~12 cases
- `web/src/components/gig-card.test.tsx`: ~8 cases
- `web/src/hooks/use-tonight-gig.test.tsx`: ~5 cases

Expected final: **web ~258, api 103 unchanged**.

### Files this story does NOT touch (regression safety)

- `api/**` — no server-side changes in this story
- `shared/**` — no schema changes
- `web/src/sync/**` — outbox/flusher unchanged
- `web/src/hooks/use-setlists.ts` — already wired in Story 3.1; Home reads it
- `web/src/hooks/use-setlist*.ts` — unchanged
- `web/src/components/bottom-tabs.tsx` — unchanged
- `web/src/components/top-nav.tsx` — unchanged (the `+ New setlist` slot is Story 3.4)
- `web/src/routes/library.tsx` — unchanged
- `web/src/routes/song-detail.tsx` — unchanged
- `e2e/**` — no E2E tests in this story

### Epic 2 / 3.1 retro lessons applied

**Lesson #1 (not-committed gap):** Task 8 is an explicit commit checkpoint — do not mark done before committing.

**Lesson #2 (TypeScript strict):** All new files must compile under `strict: true`. If TypeScript complains about an optional type, find the correct fix (don't use `!` non-null assertion unless genuinely safe; use narrowing).

**Lesson #4 (new dirs need Biome coverage):** All new files go in directories already covered by existing `tsconfig.json` and `biome.json`. No config changes required.

**Story 3.1 completion note on GSI1 index name:** The CDK provisioned the index as `'GSI1'` (uppercase) not `'gsi1'` (lowercase). This is only relevant for server-side DDB queries — Story 3.2 is client-only and uses the hooks from Story 3.1. No GSI awareness needed here.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via Claude Code / bmad-dev-story skill.

### Debug Log References

- Initial `pnpm test` after Home was rewritten exposed 4 failures in `web/src/app-bootstrap.test.tsx`: `Home` now calls `useSetlists()` and so requires a `QueryClient` in context, but the test was rendering `<AppBootstrap />` outside the production `SyncProvider` wrapper. Fixed by introducing a `renderBootstrap()` helper that wraps each render in a per-test `QueryClientProvider` (production code path unchanged — `main.tsx` still wraps `<AppBootstrap />` in `<SyncProvider>`).
- `use-tonight-gig.test.tsx` initially used `vi.useFakeTimers()` to freeze the clock for `todayLondon()` determinism, which broke React Query's `waitFor` scheduling and caused 5s timeouts. Narrowed to `vi.useFakeTimers({ toFake: ['Date'] })` so only `Date` is mocked and the microtask queue keeps draining.
- TypeScript `exactOptionalPropertyTypes` flagged the GigCard test helper passing `showBadge?: boolean` (could be `undefined`) through to a prop typed `boolean | undefined` — fixed by defaulting the helper param to `false`.
- Biome auto-fix collapsed three multi-line JSX attribute blocks in `gig-card.tsx` and the `react-router` import group in `gig-card.test.tsx` to satisfy `pnpm lint`.

### Completion Notes List

- All 17 ACs satisfied. Verification commands green: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build:web`. `pnpm-lock.yaml` unchanged (no new dependencies).
- Test count delta — web 233 → 273 (+40); api unchanged at 103. Above the spec's ~258 estimate because the new `Home` test file is more comprehensive (13 cases) than the spec called out.
- `todayLondon()` uses `Intl.DateTimeFormat.formatToParts()` with `timeZone: 'Europe/London'` (AC-8, AC-11). Verified via test that 23:30 UTC on a BST day returns the next-day London date.
- `sectionSetlists()` is pure (no React/TanStack imports) and re-sorts defensively even though the server already returns ascending-date order — keeps the function correct for any input order and decouples it from the API contract.
- `Home` runs `todayLondon()` at render time (not in a hook). The `visibilitychange` listener bumps a tick state value to force re-evaluation, so when the user foregrounds the app after midnight the previous-day Tonight slot rolls into Past automatically. Verified in `home.test.tsx` with a clock-rolling test.
- `GigCard` follows the `LibrarySongRow` pattern: `<button>` + `useNavigate()` (NOT `<a href>`). `aria-label` composes venue + date + (time if present) + (', Tonight' if badge shown) so screen readers get the full context. Focus ring uses the accent token for visible keyboard affordance on MacBook.
- `useTonightGig()` is intentionally NOT consumed by Home — Home runs `sectionSetlists` directly to derive all three sections in one pass without redundant work. The hook exists as the foundation for the AR-25 / Epic 4 pre-fetch wiring.
- `SetlistOverview` is a placeholder per AC-9 (`<h1>Setlist {setlistId}</h1>`) — Story 3.3 owns the real surface.
- Task 8 (commit checkpoint) intentionally left unchecked — per CLAUDE.md / story instructions the orchestration workflow handles the commit after review steps pass.

### File List

**NEW files:**
- `web/src/lib/gig-date.ts`
- `web/src/lib/gig-date.test.ts`
- `web/src/components/gig-card.tsx`
- `web/src/components/gig-card.test.tsx`
- `web/src/hooks/use-tonight-gig.ts`
- `web/src/hooks/use-tonight-gig.test.tsx`
- `web/src/routes/setlist-overview.tsx`

**UPDATED files:**
- `web/src/routes/home.tsx` (replaces Epic 1 empty-state stub with full Tonight/Upcoming/Past sectioned list)
- `web/src/routes/home.test.tsx` (replaces stub tests with sectioning + visibility coverage)
- `web/src/router.tsx` (adds `/setlists/:setlistId` route)
- `web/src/lib/microcopy.ts` (adds `ACTIONS.newSetlist`)
- `web/src/app-bootstrap.test.tsx` (wraps `<AppBootstrap />` in a per-test `QueryClientProvider`; Home now reads `useSetlists()`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/3-2-setlists-home-tonight-upcoming-past.md` (this file — Tasks/Subtasks checkboxes, Dev Agent Record, File List, Change Log, Status)

### Change Log

- 2026-06-19 — Implemented Story 3.2 Setlists home (Tonight / Upcoming / Past sectioned list, GigCard component, London-timezone sectioning utilities, `/setlists/:setlistId` stub route, `useTonightGig()` selector foundation, `ACTIONS.newSetlist` microcopy entry). All ACs satisfied; `pnpm typecheck`, `pnpm lint`, `pnpm test` (273/273 web, 103/103 api), and `pnpm build:web` green; `pnpm-lock.yaml` unchanged.
