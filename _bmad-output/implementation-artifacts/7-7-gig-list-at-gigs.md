---
baseline_commit: 916ba23bcc1f3fb5b6d1b6151b634826889cabc2
---

# Story 7.7: Gig list at /gigs

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.7". Mirrors Story 7.3 (song list) for gigs. -->

## Story

As Sandy,
I want to open a list of the band's gigs from the home page, upcoming first,
so that I can find the next gig, or a past one, without remembering its date.

## Acceptance Criteria

1. Signed in, `/` is unchanged except for one clear "Gigs" link to `/gigs`, alongside the
   existing "Songs" link. No gigs are listed on `/`.
2. `/gigs` lists every setlist for the band as a gig. Each row shows the date and the venue
   on one line (e.g. `Sat 7 Nov 2026 · <venue>`), in British date format with no time. Rows
   are large tap targets in generous type, using existing `STYLE.md` roles.
3. Upcoming gigs (date today or later, Europe/London) come first, soonest at the top. Past
   gigs follow below a plain "Past" line, most recent first. With no upcoming gigs, the list
   starts at "Past"; with no past gigs, there is no "Past" line.
4. While loading, a plain loading line; on error, a plain one-sentence message; with no gigs,
   a plain empty-state line.
5. `/gigs` has a way back to `/`.
6. Tapping a row goes to `/gigs/:setlistId`, which for now shows the venue as the title
   (`PageTitle`), the date on one line beneath it, and a "Back to gigs" link. The setlist
   itself arrives in a later story. An unknown `setlistId` shows a plain "Gig not found" line
   with the same link.
7. `/gigs` and `/gigs/:setlistId` are valid routes (amends 7.1 AC3); any other path still
   redirects to `/`. Signed out, they show the existing login.
8. No setlist contents, search, filter, editing or performance features. No change to
   `api/`, `shared/` or `infra/`; uses the existing `use-setlists` / `use-setlist` hooks.
9. Same responsive and theming rules as 7.1 (360px–1680px with no horizontal scroll,
   light/dark via `prefers-color-scheme`, WCAG AA contrast).
10. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover
    home → Gigs → a gig, the upcoming/past ordering (including a gig dated today), and
    "Gig not found". `e2e/smoke` checks `/gigs` and `/gigs/:setlistId` end on the login when
    signed out.
11. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Copy and style** (AC: 2, 3, 4, 6)
  - [x] `web/src/lib/microcopy.ts`: append (don't edit existing blocks) a block commented
    `/* Story 7.7 — gig list and gig page copy. */`:
    ```ts
    export const GIGS = {
      heading: 'Gigs',
      loading: 'Loading…',
      error: "Couldn't load your gigs.",
      empty: 'No gigs yet.',
      past: 'Past',
      notFound: 'Gig not found.',
      backToHome: 'Home',
      backToGigs: 'Back to gigs',
    } as const;
    ```
  - [x] `STYLE.md` "Spacing and tap targets": add one bullet:
    "A group label inside a list (e.g. "Past") is Body, secondary text, with the 32px section
    gap above it." No new tokens or colours; `contrast-report.ts` needs no edit.

- [x] **Task 2: Gig date helpers** (AC: 2, 3)
  - [x] New `web/src/lib/gig-date.ts` (+ `gig-date.test.ts`), three pure functions:
    - `todayLondon(): string` — today's `YYYY-MM-DD` in `Europe/London` via
      `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())`.
      **Never** `new Date().toISOString().slice(0, 10)` (UTC; wrong late evening in BST).
      Restore this function from tag `pre-reset` (`git show pre-reset:web/src/lib/gig-date.ts`);
      it was tested and correct.
    - `formatGigDate(iso: string): string` — `2026-11-07` → `Sat 7 Nov 2026`. Build the date
      with `new Date(Date.UTC(y, m - 1, d))` and format with `timeZone: 'UTC'`, options
      `{ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }`, then join the
      `weekday`, `day`, `month`, `year` parts from `formatToParts` with single spaces.
      Don't use `.format()` directly: Node 22's ICU gives `Sat, 7 Nov 2026` (comma), and
      browsers vary. Malformed input → return it unchanged.
    - `orderGigs(setlists: Setlist[], today: string): { upcoming: Setlist[]; past: Setlist[] }`
      — `upcoming` = `date >= today`, ascending; `past` = `date < today`, descending. Plain
      string comparison is correct for `YYYY-MM-DD` (AR-48). Re-sort defensively (copy, don't
      mutate); the API already returns ascending date order. Tie-break equal dates by
      `setlistId` so order is stable. Do **not** restore the pre-reset `sectionSetlists`
      (it promoted a "Tonight" gig — not wanted here).
  - [x] Tests: `todayLondon` with `vi.setSystemTime` (winter GMT; BST case
    `2026-06-21T23:30:00Z` → `2026-06-22`); `formatGigDate('2026-11-07') === 'Sat 7 Nov 2026'`
    and a malformed input; `orderGigs` with a past, a today and a future gig (today is in
    `upcoming`, first), two past gigs most-recent-first, input order not mutated.

- [x] **Task 3: Shared gig lookup** (AC: 6)
  - [x] New `web/src/hooks/use-setlist-or-cached.ts` (+ `.test.tsx`), mirroring
    `use-song-or-cached.ts` exactly: `useSetlist(setlistId ?? null)` + `useSetlists()`;
    `setlist = one.data ?? list.data?.find(...)`; `statusLine` is `GIGS.notFound` when
    `one.data === null`, `GIGS.loading` while either is pending, else `GIGS.error`.
    Test the four cases (single query, list fallback, not found, loading/error).

- [x] **Task 4: Gig list route** (AC: 2–5)
  - [x] New `web/src/routes/gigs.tsx` exporting `Gigs`, modelled on `songs.tsx`:
    - "Home" back link (same class string as `songs.tsx`), then
      `<PageTitle afterBackLink>{GIGS.heading}</PageTitle>`. No "Add" link.
    - `useSetlists()`; status line rules identical to `songs.tsx` (empty / loading / error;
      cached data wins over a background error).
    - With data: `const { upcoming, past } = orderGigs(data, todayLondon())`. Render
      `upcoming` as a `<ul>` (only if non-empty), then, if `past` is non-empty, an `<h2>`
      `GIGS.past` styled per the new STYLE.md bullet, then `past` as a second `<ul>`. Row
      markup and classes exactly as the song rows (`li` with hairline, `Link` block,
      `min-h-tap`, Row role), `to={`/gigs/${s.setlistId}`}`.
    - Row text: `${formatGigDate(date)} · ${venue}`; if `venue.trim()` is empty, the date
      alone. No time, ever (the schema has an optional `time`; ignore it).
    - Header comment in the style of `songs.tsx` (one short paragraph).
  - [x] Call `todayLondon()` during render (cheap); no timers or midnight re-render.

- [x] **Task 5: Gig page route** (AC: 6)
  - [x] New `web/src/routes/gig.tsx` exporting `Gig`, modelled on `song.tsx`:
    "Back to gigs" link (`to="/gigs"`, same class string) at the top; no Edit link.
    `useSetlistOrCached(useParams().setlistId)`.
  - [x] With a setlist: `<PageTitle afterBackLink>{venue}</PageTitle>`, then one
    `<p>` with `formatGigDate(date)` using Reading role, secondary text,
    `mt-[calc(var(--spacing-unit)*4)]` (same classes as the song key/patch line). If
    `venue.trim()` is empty, the title is the formatted date and the date line is left out.
  - [x] Without: the status line `<p aria-live="polite">` exactly as `song.tsx`.
  - [x] Nothing about sections or songs.

- [x] **Task 6: Home link and routes** (AC: 1, 7)
  - [x] `home.tsx`: wrap the existing Songs `Link` and a new Gigs `Link` (`to="/gigs"`,
    text `GIGS.heading`) in a `<div className="mt-[var(--spacing-section-gap)] flex flex-col">`;
    move the `mt-[var(--spacing-section-gap)]` off the Songs link onto the div. Same link
    classes for both. Songs first, Gigs second. Counts line unchanged.
  - [x] `router.tsx`: add `{ path: 'gigs', element: <Gigs /> }` and
    `{ path: 'gigs/:setlistId', element: <Gig /> }` inside the `RequireAuth` children, after
    the song routes. Keep the `*` catch-all and `RequireAuth` as they are.

- [x] **Task 7: Tests** (AC: 10)
  - [x] `home.test.tsx`: links to `/gigs` (name `Gigs`); the existing `/songs` test stays.
  - [x] `gigs.test.tsx`: mock `../hooks/use-setlists.js` (as `songs.test.tsx` mocks
    `use-songs`). Pin today with `vi.useFakeTimers({ toFake: ['Date'] })` +
    `vi.setSystemTime(new Date('2026-11-07T12:00:00Z'))` (restore in `afterEach`). Cover:
    - ordering: gigs on `2026-10-31`, `2026-11-07` (today), `2026-12-05`, `2026-09-12` given
      in a scrambled order ⇒ rows read today, `2026-12-05`, then "Past" heading, then
      `2026-10-31`, `2026-09-12`; row text exact (e.g. `Sat 7 Nov 2026 · Venue B`);
      links to `/gigs/<id>`.
    - only past gigs ⇒ "Past" heading present and no upcoming list; only upcoming ⇒ no
      "Past" heading.
    - loading, error, empty lines; cached data over a background error; "Home" link to `/`.
  - [x] `gig.test.tsx`: mock `use-setlist.js` and `use-setlists.js` (as `song.test.tsx`),
    route `/gigs/:setlistId`. Cover: venue as `h1` and the date line; list-cache fallback;
    "Gig not found" with the "Back to gigs" link to `/gigs`; loading.
  - [x] `app-bootstrap.test.tsx`: add `signed in: home → Gigs → a gig`, following the
    existing songs journey test. Stub a full setlist record (it is Zod-validated):
    `{ bandId: 'jack-ruby-5', setlistId: 'g1', gigMeta: { venue: 'Test Venue', date: '2026-11-07' }, sections: [], clientWrittenAt, serverReceivedAt, version: 1 }`.
    Route `/setlists/g1` to the single record, `/setlists` to `[setlist]`, everything else
    `[]`. Click "Gigs", click the row (match by `/Test Venue/`), expect the `h1`
    `Test Venue` and the "Back to gigs" link. Also: signed out, `/gigs` ends on the login.
  - [x] `e2e/smoke/shell.spec.ts`: add a test `/gigs and /gigs/:setlistId end on /login
    showing the Password field` looping over `/gigs` and `/gigs/anything`, same shape as the
    songs test. No auth fixture.
  - [x] Test venues are placeholders (`Venue A`, `Venue B`, `Test Venue`). Don't invent real
    venue names. No snapshot tests.

- [x] **Task 8: Verify, commit, deploy** (AC: 8, 10, 11)
  - [x] `git diff --stat HEAD -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [x] One commit: `Implement story 7.7: Gig list at /gigs`. Push to `main` only with
    Sandy's go-ahead; watch `deploy.yml` with `gh run watch`. If the blackout check blocks,
    report it; don't use `deploy-force.yml`.
  - [x] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

The gig equivalent of Story 7.3. Read-only, web only. Everything below the UI exists:
`GET /api/v1/setlists` (ascending date via GSI1) and `GET /api/v1/setlists/:id` (404 →
`null`), behind `useSetlists()` and `useSetlist(id | null)`. In V1 a setlist *is* a gig:
`gigMeta` holds the venue and date. Home already counts setlists as "gigs"
(`web/src/lib/counts.ts`).

### Facts verified when the story was written (2026-10-25)

- `SetlistSchema` (`shared/src/schemas/setlist.ts`): `gigMeta.venue: string` (required, may in
  principle be `''`), `gigMeta.date` ISO `YYYY-MM-DD`, `gigMeta.time` optional `HH:MM`.
  Import `type Setlist` from `@gigbuddy/shared`; no parallel types.
- `useSetlists` key `['setlists', bandId]`; `useSetlist` key `['setlist', bandId, id]`,
  disabled for `null`. Same shapes as the song hooks, so `use-song-or-cached.ts` is the exact
  template for `use-setlist-or-cached.ts`.
- `home.tsx` already calls `useSetlists()` for the counts line, so `/gigs` is usually warm
  from cache.
- Real data: 7 JR5 setlists in prod (Apple Notes import, 2026-10-05). Rows will mostly be
  past gigs; that's expected.
- Pre-reset reference (tag `pre-reset`): `web/src/lib/gig-date.ts` had `todayLondon`,
  `formatGigDate` (no weekday) and `sectionSetlists` (Tonight/Upcoming/Past). Reuse only
  `todayLondon`. `routes/setlist-overview.tsx`, `components/gig-card.tsx`,
  `hooks/use-tonight-gig.ts` belong to the old design — don't restore them.
- `api/src/ddb/gigs.ts` has its own `todayLondon` copy; leave it (no `api/` change, and web
  must not import api source).

### Layout notes

- `/gigs`: Home link → `PageTitle` "Gigs" → upcoming rows → "Past" `<h2>` → past rows. The
  `<h2>` keeps the page to one `<h1>` and lets screen readers jump to the past group.
- Row text can wrap at 360px for long venues; that's fine (block link, no `truncate`, no
  `whitespace-nowrap`), so there's no horizontal scroll.
- `·` is U+00B7 with a space either side, same as the song key/patch line.

### Guardrails

- Out of scope: setlist sections/songs, Tonight banner, time display, search, filter,
  add/edit/delete gig, performance mode, any `api/`, `shared/`, `infra/` or sync change.
- No device detection; one layout from 360px up.
- Biome only; `kebab-case` files; co-located tests; `.js` import suffix; imports from
  `react-router`; British English.
- `todayLondon()` in tests: always pin the clock; the ordering test must not depend on the
  real date.

### Project Structure Notes

New: `web/src/lib/gig-date.ts`, `web/src/hooks/use-setlist-or-cached.ts`,
`web/src/routes/gigs.tsx`, `web/src/routes/gig.tsx` (each + test).
Updated: `home.tsx` (+ test), `router.tsx`, `microcopy.ts`, `STYLE.md`,
`app-bootstrap.test.tsx`, `e2e/smoke/shell.spec.ts`, `sprint-status.yaml`.

### Previous story intelligence

- 7.3: the signed-in journey lives in `app-bootstrap.test.tsx` with a `fetch` stub; records
  must be full schema shapes because the API layer Zod-validates responses.
- 7.6: route files share one link class string; status-line pattern via a `use-*-or-cached`
  hook. Review fix was about Back after edit — not relevant here (no forms).
- Commits: one per story, then a separate "Close out" commit after review.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.7]
- [Source: _bmad-output/implementation-artifacts/7-3-song-list-at-songs.md, 7-6-add-and-edit-a-song.md]
- [Source: shared/src/schemas/setlist.ts; api/src/ddb/setlists.ts (ascending GSI1)]
- [Source: web/src/hooks/use-setlists.ts, use-setlist.ts, use-song-or-cached.ts]
- [Source: web/src/routes/home.tsx, songs.tsx, song.tsx; web/src/router.tsx; web/src/app-bootstrap.test.tsx]
- [Source: git tag pre-reset — web/src/lib/gig-date.ts]
- [Source: STYLE.md; e2e/smoke/shell.spec.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Implemented gig list (`/gigs`), gig page (`/gigs/:setlistId`), Home link, routes, copy, STYLE.md bullet.
- `formatGigDate` uses fixed weekday/month name tables rather than `Intl`: Node's en-GB ICU renders September as `Sept`, which would break the `Sat 12 Sep 2026` format. Deterministic across browsers.
- `todayLondon` restored from `pre-reset`, simplified comments.
- lint, typecheck, test (web 211, api 121, shared 30, infra 55) and build pass; no diff in api/shared/infra.
- Task 8 commit/push/deploy left open: per AGENTS.md workflow the commit follows code-review. e2e smoke test added but not run locally.

- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-25).

### File List

- STYLE.md (modified)
- e2e/smoke/shell.spec.ts (modified)
- web/src/app-bootstrap.test.tsx (modified)
- web/src/lib/microcopy.ts (modified)
- web/src/lib/gig-date.ts, gig-date.test.ts (new)
- web/src/hooks/use-setlist-or-cached.ts, use-setlist-or-cached.test.tsx (new)
- web/src/routes/gigs.tsx, gigs.test.tsx (new)
- web/src/routes/gig.tsx, gig.test.tsx (new)
- web/src/routes/home.tsx, home.test.tsx (modified)
- web/src/router.tsx (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

### Change Log

- 2026-10-25: Implemented story 7.7 (gig list and gig page); status → review.
- 2026-10-26: Code review clean (no findings). Deploy blocked by Sunday-evening blackout, then forced by Sandy; live check OK. Status → done.
