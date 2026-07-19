---
baseline_commit: "60aa878"
builds_on: 4-5-backgrounding-survives-tonight-gig-pre-fetch-upcoming-gigs
---

# Story 5.1: JSON export endpoint + Library footer affordance (FR-33, AR-38)

Status: review

## Story

As Sandy,
I want a one-tap full data dump as human-readable JSON, reachable from a footer affordance on the MacBook Library page,
So that I can keep my own off-platform copy of every Song, Setlist, Section, per-gig annotation, and Gig record whenever I want, without going through a dedicated Settings surface.

## Acceptance Criteria

**AC-1 — `GET /api/v1/export` endpoint**

**Given** `api/src/routes/export.ts`
**When** `GET /api/v1/export` is called with a valid auth cookie
**Then** the handler reads every item belonging to the active Band (`ACTIVE_BAND_ID`) — all Songs and all Setlists
**And** assembles the result in-Lambda (no streaming for V1 — Sandy's volume is ~MB-scale)
**And** the response is JSON with shape:
```
{
  "exportedAt": "<ISO-8601 UTC>",
  "schemaVersion": 1,
  "bands": [
    {
      "band": { "bandId": "...", "name": "..." },
      "songs": [ <SongSchema>, ... ],
      "setlists": [ <SetlistSchema>, ... ]
    }
  ]
}
```
**And** the response headers include `Content-Type: application/json` and `Content-Disposition: attachment; filename="gigbuddy-YYYY-MM-DD.json"` (date in Europe/London)
**And** the response includes `x-server-now` per the standard envelope rules (stamped automatically by the global `serverNowMiddleware` — no route-level code needed)

**AC-2 — Auth enforced**

**Given** the export endpoint
**When** invoked without a valid auth cookie
**Then** the response is 401 (the global `authMiddleware` on `/api/v1/*` already covers this — no route-level auth code needed)

**AC-3 — Completeness and shape stability**

**Given** the export payload
**When** parsed by a human or by a `jq` script
**Then** every Song and every Setlist for the active Band is represented — no record-class is omitted
**And** the structure is stable across exports (same shape for an empty Library and a populated one — `songs: []` / `setlists: []`, never omitted keys)

**AC-4 — Schema versioning**

**Given** the `schemaVersion` field
**When** the export shape needs to evolve in V2+
**Then** `schemaVersion` is bumped and a V1 importer (if any) refuses unknown versions (forward-compat contract — no importer exists in V1; this AC only requires the field to exist as a literal `1`)

**AC-5 — MacBook Library footer affordance**

**Given** the Library page on MacBook (`web/src/routes/library.tsx`, Story 2.5)
**When** the route renders
**Then** a footer affordance appears at the bottom of the page (below the song list / empty state)
**And** the affordance is a small, low-emphasis link with text `Export all data` (no exclamation, no emoji, voice/tone-compliant per UX-DR7)
**And** the affordance satisfies `min-h-tap`

**AC-6 — Tap behaviour on MacBook**

**Given** Sandy taps `Export all data` on MacBook
**When** the tap is registered
**Then** the browser initiates a download of the JSON archive (the `Content-Disposition: attachment` header drives the save dialog — this requires a plain `<a href="/api/v1/export">` navigation, NOT a React Router `<Link>` or a `fetch()` call, so the browser's native download handling applies)
**And** the file is named `gigbuddy-YYYY-MM-DD.json` using today's date in Europe/London
**And** no UI confirmation, no progress bar, no toast — the download is the feedback (per PRD Voice & Tone)

**AC-7 — iPhone: no export affordance**

**Given** the Library page on iPhone
**When** the route renders
**Then** NO export affordance appears (per FR-33 — MacBook only in V1)

**AC-8 — Performance budget**

**Given** the export endpoint runs while the DDB table has hundreds of items (well under Sandy's realistic volume)
**When** the response is built
**Then** the total response time is acceptable (<3s) without streaming
**And** Lambda memory is sufficient (the 512MB reserved is well above the ~MB-scale payload) — no code change needed for this, just don't add streaming machinery

**AC-9 — API contract test**

**Given** the export endpoint
**When** a route-level test runs (mocked DDB modules — see Dev Notes "Test pattern", NOT dynamodb-local)
**Then** it seeds fixture Songs and Setlists (mirror the `songs.test.ts` / `upcoming-gigs.test.ts` fixture style: at least 3 Songs and 2 Setlists, one Setlist with a `perGigAnnotation` and one with multiple Sections)
**And** calls `GET /api/v1/export` with a valid auth cookie
**And** asserts the resulting JSON contains all fixture Songs + Setlists with full structure preserved (including `titleSnapshot` and `perGigAnnotation`)
**And** asserts `schemaVersion === 1` and `exportedAt` is a valid ISO-8601 string
**And** asserts the `Content-Disposition` header matches `attachment; filename="gigbuddy-YYYY-MM-DD.json"` for the current Europe/London date
**And** asserts 401 without a cookie

## Tasks / Subtasks

- [x] **Task 1 — Shared export schema** (AC: 1, 3, 4)
  - [x] Add `shared/src/schemas/export.ts` exporting `ExportSchema` composed from the existing `BandSchema`, `SongSchema`, `SetlistSchema` (do NOT hand-roll a parallel type — CLAUDE.md "Zod schemas in `shared/` are the single source of truth"):
    ```ts
    export const ExportSchema = z.object({
      exportedAt: z.string().datetime(),
      schemaVersion: z.literal(1),
      bands: z.array(
        z.object({
          band: BandSchema,
          songs: z.array(SongSchema),
          setlists: z.array(SetlistSchema),
        }),
      ),
    });
    export type Export = z.infer<typeof ExportSchema>;
    ```
  - [x] Add `export * from './schemas/export.js';` to `shared/src/index.ts`
  - [x] `shared/src/schemas/export.test.ts` — round-trip parse of a minimal valid payload; reject on wrong `schemaVersion` literal

- [x] **Task 2 — API route** (AC: 1, 2, 3, 4, 8)
  - [x] Create `api/src/routes/export.ts`. Reuse existing DDB accessors — do NOT create a new `api/src/ddb/export.ts` or a "band META" reader (see Dev Notes "No Band DDB item exists"):
    ```ts
    import { ACTIVE_BAND_ID, ACTIVE_BAND_NAME, ExportSchema } from '@gigbuddy/shared';
    import { Hono } from 'hono';
    import { londonIsoDate } from '../ddb/gigs.js';
    import { listSetlistsByBand } from '../ddb/setlists.js';
    import { listSongsByBand } from '../ddb/songs.js';

    export const exportRoute = new Hono().get('/', async (c) => {
      const [songs, setlists] = await Promise.all([
        listSongsByBand(ACTIVE_BAND_ID),
        listSetlistsByBand(ACTIVE_BAND_ID),
      ]);
      const payload = ExportSchema.parse({
        exportedAt: new Date().toISOString(),
        schemaVersion: 1,
        bands: [
          {
            band: { bandId: ACTIVE_BAND_ID, name: ACTIVE_BAND_NAME },
            songs,
            setlists,
          },
        ],
      });
      const filename = `gigbuddy-${londonIsoDate(new Date())}.json`;
      c.header('Content-Type', 'application/json');
      c.header('Content-Disposition', `attachment; filename="${filename}"`);
      return c.json(payload);
    });
    ```
  - [x] `londonIsoDate` is exported from `api/src/ddb/gigs.ts` — import and reuse it. Do NOT re-derive Europe/London date logic inline (Story 4.5 established this helper for exactly this reason)
  - [x] Wire into `api/src/app.ts`: `.route('/api/v1/export', exportRoute)`. No auth code needed in the route itself — the global `authMiddleware` already covers `/api/v1/*`, and `export` is not in `SKIP_PATHS`
  - [x] `api/src/routes/export.test.ts` per AC-9 (see Dev Notes "Test pattern" for the exact mocking shape to copy)

- [x] **Task 3 — Service worker routing** (AC: 6 — disaster-prevention, not in epics.md AC text but required for the feature to work; see Dev Notes "SW routing gap")
  - [x] In `web/vite.config.ts` `workbox.runtimeCaching`, add a `NetworkOnly` rule matching `/api/v1/export` BEFORE the catch-all `navigate` rule (the array is ordered; more-specific rules must come first, matching the existing `/api/v1/auth/`, `/api/v1/me`, `/api/v1/health` pattern)

- [x] **Task 4 — Library footer affordance** (AC: 5, 6, 7)
  - [x] Add `exportAllData: 'Export all data'` to the `ACTIONS` object in `web/src/lib/microcopy.ts` (append-only per file convention)
  - [x] In `web/src/routes/library.tsx`, import `isIPhone` from `../lib/platform.js`. Render a footer `<a href="/api/v1/export" className="...">{ACTIONS.exportAllData}</a>` below the song list / empty-state branch, gated on `!isIPhone()`. Use a plain `<a>`, NOT React Router's `<Link>` — this must be a real browser navigation so the native download/save-dialog behaviour fires (a client-side route `<Link>` would try to route it through the SPA router and never hit the network as a download)
  - [x] Style as low-emphasis (distinct from the primary `+ New song` accent-coloured CTA) — reuse the existing `--color-text-secondary` token already used for empty-state copy, at `min-h-tap`
  - [x] Update `web/src/routes/library.test.tsx`: mock `../lib/platform.js` (copy the `isIPhoneMock` pattern from `setlist-overview.test.tsx`) and assert the affordance renders on MacBook (`isIPhoneMock` returns `false`) with correct `href` and text, and is absent when `isIPhoneMock` returns `true`

- [x] **Task 5 — Full verification pass**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass across every package touched (`shared`, `api`, `web`)

## Dev Notes

### What this story delivers

A read-only export endpoint plus a single footer link. No new client-side data-fetching hook, no TanStack Query involvement, no outbox involvement — this is a one-way, one-tap native browser download. Keep it that simple; do not over-build this into a fetch-and-blob-download flow, the `Content-Disposition` header already does the work.

### No Band DDB item exists — do not invent one

The epics.md AC text says the handler "scans the DDB `gigbuddy-data` table for all items belonging to the active Band (Query per partition: BAND + SONG + SETLIST_BY_DATE GSI)" and shows `"band": { "bandId": "...", "name": "...", ...metadata }`. Read literally this implies a `BAND#<bandId> / META` DDB item exists. **It does not** — verified against `api/src/ddb/*` (no `bands.ts` module) and `shared/src/active-band.ts`, whose own header comment states: *"V2 / Multi-Band: replace with a `useActiveBand()` hook backed by the REGISTRY item in DDB... Do NOT add band-metadata fetching here in V1."* `ACTIVE_BAND_ID` and `ACTIVE_BAND_NAME` are hardcoded constants in `shared/src/active-band.ts` for V1. Build the `band` field directly from those two constants — do not create a new DDB read path or a `ddb/bands.ts` module for this story. `BandSchema` is exactly `{ bandId, name }` — no additional metadata fields exist to include.

### Test pattern — mocked DDB modules, not dynamodb-local

The epics.md AC text says the integration test "seeds 3 Songs and 2 Setlists ... into a dynamodb-local instance." **No dynamodb-local setup exists anywhere in this codebase** (checked: no such dependency, no such fixture, no such CI step). Every existing route test (`songs.test.ts`, `setlists.test.ts`, `upcoming-gigs.test.ts`) mocks `../ddb/*.js` directly with `vi.fn()` and asserts against the Hono `app` via `app.request(...)`. Follow that established pattern exactly — mock `listSongsByBand` and `listSetlistsByBand` to return fixture arrays; do not introduce a new test dependency or spin up a real (or local) DynamoDB. Copy the `authedRequest` / `signSession` / `SESSION_COOKIE_NAME` harness verbatim from `upcoming-gigs.test.ts`.

### SW routing gap (not in epics.md AC, but required for AC-6 to actually work)

`web/vite.config.ts`'s `workbox.runtimeCaching` array is checked in order; a `GET /api/v1/export` request from clicking the footer `<a>` will fall through the existing rules (it doesn't match `/api/v1/auth/`, `/api/v1/me`, `/api/v1/health`, or the `/api/v1/songs|setlists` GET rule) and land on the final catch-all rule matching `request.mode === 'navigate'`, which applies `NetworkFirst` against the `app-shell-v1` cache. A link-click navigation to a same-origin URL is `mode: 'navigate'` even though the response carries `Content-Disposition: attachment` — so without an explicit rule, the JSON download response gets shoved into the app-shell cache under the `/api/v1/export` key, which is wrong (it's not app-shell content) and, since the export payload legitimately changes between calls, stale-cache pollution with no eviction path. Add a `NetworkOnly` rule for `/api/v1/export` in the same position as the existing `/api/v1/auth/`, `/api/v1/me`, `/api/v1/health` rules (before the generic GET-songs/setlists rule, per the "more-specific rules first" comment already in the file).

### `Export all data` link text is prescriptive, not just illustrative

Epics.md phrases it as "text like `Export all data`" but there's no alternate copy documented anywhere else (checked `EXPERIENCE.md` references, `microcopy.ts`, UX docs — no existing "export" string). Use `Export all data` verbatim; it is voice/tone-compliant (short, no exclamation, no emoji) and there's no reason to deviate.

### Architecture compliance checklist

- [ ] `api/src/ddb/*` remains the only DDB import surface (AR-42) — the route imports `listSongsByBand`/`listSetlistsByBand`, never touches `@aws-sdk/lib-dynamodb` directly
- [ ] Response envelope: this is a GET returning a file download, not the standard `{status: 'ok', data}` read envelope — per architecture.md's own "Export endpoint (FR-33)" section, the export body is the raw archive shape (`exportedAt`/`schemaVersion`/`bands`), not wrapped in `{status, data}`. Do not wrap it — this is an intentional, documented deviation from the general envelope rule, specific to this one download endpoint
- [ ] `x-server-now` still present (global middleware — automatic, verify in the test)
- [ ] No parallel TypeScript type/interface for the export shape — `ExportSchema` in `shared/` is the only definition (CLAUDE.md)
- [ ] `web` never imports `api` source directly; the footer link is a plain URL string, not an import
- [ ] File naming: `kebab-case` (`export.ts`, `export.test.ts`)
- [ ] Biome passes (sole lint/format tool)

### Files to create / update

- **Create:** `shared/src/schemas/export.ts`, `shared/src/schemas/export.test.ts`, `api/src/routes/export.ts`, `api/src/routes/export.test.ts`
- **Update:** `shared/src/index.ts` (barrel export), `api/src/app.ts` (route registration), `web/vite.config.ts` (SW routing rule), `web/src/lib/microcopy.ts` (new `ACTIONS.exportAllData`), `web/src/routes/library.tsx` (footer affordance), `web/src/routes/library.test.tsx` (new + updated assertions)

### Previous story intelligence (Story 4.5)

Story 4.5 established `londonIsoDate` in `api/src/ddb/gigs.ts` and explicitly warned against re-deriving Europe/London date logic inline — reuse it here for the export filename date, same as this story's Task 2 does. Story 4.5 also reconfirmed the codebase convention of mocking DDB modules per-route-test rather than any shared integration harness; there is still no dynamodb-local or similar fixture infrastructure as of this story (see "Test pattern" above).

### Project Structure Notes

No deviation from `architecture.md`'s directory tree — `api/src/routes/export.ts` is explicitly named in the canonical tree already. Alignment is exact.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1] — story ACs
- [Source: _bmad-output/planning-artifacts/architecture.md#Export endpoint (FR-33)] — endpoint contract, in-Lambda assembly, no streaming
- [Source: _bmad-output/planning-artifacts/architecture.md#API response envelope] — general envelope rules (export is a documented exception)
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming conventions] — DDB key shapes, camelCase wire format
- [Source: api/src/ddb/gigs.ts] — `londonIsoDate` helper (reuse, do not reimplement)
- [Source: api/src/routes/upcoming-gigs.ts, api/src/routes/upcoming-gigs.test.ts] — closest existing analogue for route shape + test harness
- [Source: shared/src/active-band.ts] — confirms no Band DDB item exists in V1; constants only
- [Source: web/src/routes/setlist-overview.test.tsx] — `isIPhone` mocking pattern to copy for `library.test.tsx`

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 via bmad-dev-story workflow

### Debug Log References

- `pnpm --filter shared test` — 30/30 pass (including 4 new ExportSchema tests)
- `pnpm --filter api test` — 121/121 pass (including 4 new export route tests)
- `pnpm --filter web test` — 573/573 pass (existing library-links length assertion updated + 5 new footer-affordance tests)
- `pnpm lint` — clean after one `pnpm lint:fix` pass reflowed a long `.toBe(...)` in `export.test.ts`
- `pnpm typecheck` — clean across all 5 workspaces
- `pnpm build` — api + web bundles built without diagnostics; PWA generation emitted `sw.js` including the new NetworkOnly rule for `/api/v1/export`

### Completion Notes List

- `ExportSchema` composed from `BandSchema` + `SongSchema` + `SetlistSchema`; no parallel TypeScript type introduced (CLAUDE.md single-source-of-truth rule honoured).
- `GET /api/v1/export` returns the raw archive body (`exportedAt`/`schemaVersion`/`bands`), NOT the standard `{status,data}` envelope — this is the documented deviation in architecture.md "Export endpoint" and is called out in the route comment for future readers.
- Auth is enforced entirely by the pre-existing global `authMiddleware` on `/api/v1/*`. Verified `SKIP_PATHS` does not include `/api/v1/export`; a route test asserts 401 without an auth cookie.
- `Content-Disposition: attachment; filename="gigbuddy-YYYY-MM-DD.json"` uses `londonIsoDate(new Date())` from `api/src/ddb/gigs.ts`. The route test asserts this against today's Europe/London date at run-time.
- Service-worker runtime cache: added a `NetworkOnly` rule for `/api/v1/export` between the existing `/api/v1/health` rule and the songs/setlists GET rule. Without it, a link-click navigation to the export URL would fall through to the catch-all `navigate` rule and pollute the `app-shell-v1` cache with a stale JSON dump.
- Library footer affordance uses a plain `<a href="/api/v1/export">` (not React Router's `<Link>`) so the browser handles the download natively via `Content-Disposition`. Gated on `!isIPhone()` — iPhone renders no export UI in V1. Styled low-emphasis with `--color-text-secondary`, `min-h-tap` compliant.
- The existing "renders one row per song" assertion in `library.test.tsx` counted links to 4; updated to 5 to include the new export footer link (which is present in the MacBook default branch).

### File List

- `shared/src/schemas/export.ts` (new)
- `shared/src/schemas/export.test.ts` (new)
- `shared/src/index.ts` (barrel export)
- `api/src/routes/export.ts` (new)
- `api/src/routes/export.test.ts` (new)
- `api/src/app.ts` (route registration)
- `web/vite.config.ts` (SW `NetworkOnly` rule for `/api/v1/export`)
- `web/src/lib/microcopy.ts` (`ACTIONS.exportAllData`)
- `web/src/routes/library.tsx` (footer affordance)
- `web/src/routes/library.test.tsx` (platform mock + new Story 5.1 test group + link-count assertion update)

## Change Log

| Date       | Change                                                        | Author           |
| ---------- | ------------------------------------------------------------- | ---------------- |
| 2026-07-19 | Story 5.1 implemented: export endpoint + Library footer link. | Amelia (dev-agent) |
