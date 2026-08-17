---
baseline_commit: "1c86ce9"
builds_on: 6-5-detour-state-d3-currently-performing-strip-detour-signal
---

# Story 6.6: Section-break orientation view (S2 CTA) — auto-open overlay between sets (P1 §B8, one-overview-three-contexts)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want tapping `NEXT ›` on the last song of a section (other than the final section) to auto-open the jump overlay scrolled to the next section with the first song highlighted, plus a bottom-fixed `Start Set 2 ›` (etc.) CTA parallel to `Start performance ›`,
So that between sets I can orient myself without hunting for a control, put the phone down for 10–15 minutes, and start the next set with a single deliberate tap.

## Locked constraints (do not relitigate)

- Visual direction is locked — do not propose alterations to color, typography, or layout philosophy. The CTA reuses the EXACT class list already shipped on the `Start performance ›` button in `web/src/routes/setlist-overview.tsx` (`fixed inset-x-0 bottom-0 z-40 flex min-h-[64px] items-start justify-center bg-[color:var(--color-accent)] ...`, same safe-area `paddingBottom` inline style) — this is a copy-the-shape reuse, not a new visual treatment. No new CSS custom properties in `web/src/styles/tokens.css`.
- Sandy IS the user — skip persona ceremony.
- iOS PWA + Safari cookie sharing pattern is intentional (not touched by this story).
- British English spelling and idiom in UI copy is intentional. This story's only new prose is the CTA copy `Start <section name> ›` / `Start <section name>` (aria-label) — see Dev Notes "Copy this story invents."
- **One-overview-three-contexts (P1 §B8, locked 2026-07-19):** the section-break orientation view is the SAME `<JumpOverlay>` component already shipped by Stories 6.3/6.4, not a new component or route. It differs from the mid-performance jump overlay ONLY by scroll position, highlight target, and the presence of the CTA — never by a different component tree. Do not create a `SectionBreakOverlay` component.
- **Scope boundary (critical):** this story does NOT touch `web/src/components/currently-performing-strip.tsx`, `web/src/routes/setlist-overview.tsx`, or `web/src/performance/performance-context.tsx`. The section-break override is resolved entirely from data already available inside `PerformanceCard` (the loaded `setlist` + `parsedSongIndex`) and passed into `<JumpOverlay>` as a new prop — no new context field, no new hook, no new `SongRef.key`/schema change.
- **Existing regression to fix, not preserve:** Story 4.1's "NEXT › traverses Section boundaries transparently" test (`performance-card.test.tsx`, describe `'PerformanceCard — single-tap navigation'`) currently asserts that tapping `NEXT ›` at the last song of Set 1 (`songIndex='1'` in the shipped 2-section/3-song test fixture) calls `navigate('/performance/setlistid0000001/2')` DIRECTLY. This story makes that assertion FALSE by design — the section boundary is no longer traversed transparently; it now opens the section-break overlay instead. This existing test MUST be rewritten (Task 5) to assert the new behaviour. This is a deliberate, epics-mandated behaviour change, not an unintended regression — do not "fix" the new behaviour to preserve the old test.

## Acceptance Criteria

**AC-1 — `NEXT ›` on the last song of a non-final section auto-opens the overlay in section-break mode**

**Given** Sandy is on the last song of a non-final section (e.g. song 6 of Set 1 in a two-section setlist; in this repo's test fixture, `songIndex=1`, "Black Orpheus", the last song of Set 1 in a Set-1/Set-2 setlist)
**When** Sandy taps `NEXT ›`
**Then** the jump overlay auto-opens on top of the Performance Card (NO `navigate()` call — the plan cursor / URL does not change)
**And** the overlay auto-scrolls so the first song of the next section is prominent at the top of the viewport (breathing gap allowed)
**And** the first song of the next section is highlighted with `accent` fill / `bg` text (same "current row" treatment used for the plan cursor in the mid-performance jump overlay)
**And** Set 1 rows render at full strength (not dimmed) — no dimming logic is added; this already holds true because the codebase has no dimming logic anywhere (write a regression test proving it, do not add code)
**And** wake lock stays held; the Performance Card underneath does NOT unmount

**AC-2 — Bottom-fixed `Start Set 2 ›` CTA renders; row and CTA are equivalent affordances**

**Given** the section-break overlay is open
**When** it renders
**Then** a bottom-fixed CTA renders with copy `Start <section name> ›` (e.g. `Start Set 2 ›`) — all-title-case serif on `accent` fill, full-width, SAME class list as the shipped `Start performance ›` CTA (`web/src/routes/setlist-overview.tsx`)
**And** the CTA is the primary tap target for entering the next section
**And** the highlighted first-row is ALSO tappable and produces the SAME outcome as the CTA

**AC-3 — Tapping the CTA (or highlighted first-row) is a PLAN ADVANCE (navigates), not a detour**

**Given** the section-break overlay is open
**When** Sandy taps the `Start Set 2 ›` CTA (or the highlighted first-row)
**Then** the overlay dismisses
**And** the Performance Card advances to the first song of the next section via `navigate()` (the same `/performance/${setlistId}/${parsedSongIndex + 1}` call already used by the shipped `NEXT ›` handler)
**And** the plan cursor updates to that song (a genuine URL navigation — NOT `setActiveDetourSongId()`)
**And** wake lock stays held

**AC-4 — Tapping a Set 1 (non-target) row is a normal jump — enters detour, plan cursor unchanged**

**Given** the section-break overlay is open
**When** Sandy taps a Set 1 row (any row other than the highlighted next-section target)
**Then** the card advances to that Set 1 song via the EXISTING `onSelectSong` → `setActiveDetourSongId()` path (unchanged from Story 6.4/6.5 — no new code)
**And** the card enters the detour state (Story 6.5's existing logic — `songId !== currentSongRef.songId` sets the override)
**And** the plan cursor does not change

**AC-5 — `‹` dismisses without advancing; card returns to its pre-tap state**

**Given** the section-break overlay is open
**When** Sandy taps the `‹` dismiss control (top-left)
**Then** the overlay dismisses without advancing (the existing `onDismiss` callback — no side effects)
**And** the Performance Card is back on the last song of the previous section (true automatically — the card's URL/plan cursor was never touched when the overlay auto-opened)
**And** wake lock stays held

**AC-6 — Final section's last song: `NEXT ›` is inert; no section-break overlay**

**Given** Sandy is on the last song of the FINAL section of the setlist
**When** Sandy taps `NEXT ›`
**Then** the tap is inert per Story 4.4 (disabled, no-op — unchanged existing behaviour)
**And** the section-break overlay does NOT auto-open (there is no next non-empty section)

**AC-7 — Typing a query collapses section-break mode to a normal jump overlay**

**Given** the section-break overlay is open and Sandy types a query in the search field
**When** the query has any match
**Then** the overlay behaves as a normal jump overlay from that point (Story 6.4 filtering — setlist matches first, library matches under `In library`)
**And** the auto-scroll highlight and the CTA are BOTH hidden while a query is active (`hasQuery === true` suppresses section-break mode entirely — every row tap, including one that happens to match the next-section target song, goes through the NORMAL `onSelectSong` detour path, never `onEnterSection`)
**And** clearing the query restores the highlight + CTA (this falls out for free from the `!hasQuery` gate — no extra state needed)

**AC-8 — Accessibility: focus lands on the CTA; CTA has a locked-form `aria-label`**

**Given** the section-break overlay renders in an accessibility audit
**When** the overlay opens
**Then** focus is placed on the `Start Set 2 ›` CTA (primary action) — via a ref + `useEffect`, NOT the `autoFocus` prop (Biome `noAutofocus`, matching `PerformanceCard`'s existing `nextButtonRef` pattern)
**And** the CTA has `aria-label="Start <section name>"` (e.g. `"Start Set 2"` — deliberately WITHOUT the trailing `›`, per epics AC's exact locked wording; note this differs from the shipped `Start performance ›` CTA's aria-label, which DOES include the glyph — this is an intentional, epics-locked exception, not an inconsistency to "fix")

**AC-9 — Visual check against the approved mockup**

**Given** the shipped rendering in `iteration-2/state-6-section-break-S2-cta.png`
**When** the story is code-reviewed
**Then** the shipped rendering matches the approved mockup (auto-scroll position, first-row highlight, CTA placement/copy, `‹` dismiss) at glance-level (visual inspection; no pixel-diff test required)

## Tasks / Subtasks

- [x] Task 1 — `PerformanceCard`: compute `sectionBreakInfo` + route `NEXT ›` through section-break mode (AC: 1, 3, 6)
  - [x] In `web/src/routes/performance-card.tsx` (UPDATE), add a memoised `sectionBreakInfo` derivation. This walks `setlist.sections` to find whether `parsedSongIndex` is the LAST flat index of some section, and if so, resolves the next NON-EMPTY section (skipping any empty sections in between — defensive, matches the existing `hasAnySong`-style permissiveness already used for the `Start performance ›` gate in `setlist-overview.tsx`):
    ```ts
    const sectionBreakInfo = useMemo(() => {
      if (setlist === undefined || setlist === null) return null;
      let cursor = -1;
      for (let i = 0; i < setlist.sections.length; i++) {
        const section = setlist.sections[i];
        if (section === undefined || section.songs.length === 0) continue;
        cursor += section.songs.length;
        if (cursor !== parsedSongIndex) continue;
        for (let j = i + 1; j < setlist.sections.length; j++) {
          const nextSection = setlist.sections[j];
          const firstSong = nextSection?.songs[0];
          if (nextSection !== undefined && firstSong !== undefined) {
            return { nextSectionName: nextSection.name, nextSectionFirstSongId: firstSong.songId };
          }
        }
        return null;
      }
      return null;
    }, [setlist, parsedSongIndex]);
    ```
    Place this after `flatSongs` is computed (needs `setlist`, not `flatSongs`). Guard the `setlist === undefined || setlist === null` check even though the loading branch already returns early above — this hook runs on every render including the loading-state renders, and Rules of Hooks forbid conditionally skipping it.
  - [x] Replace the component-local boolean `const [isJumpOverlayOpen, setIsJumpOverlayOpen] = useState(false);` with a three-state mode: `const [overlayMode, setOverlayMode] = useState<'closed' | 'jump' | 'section-break'>('closed');`. Update the `≡ jump` button's `onClick` from `() => setIsJumpOverlayOpen(true)` to `() => setOverlayMode('jump')`.
  - [x] `NEXT ›`'s `onClick` becomes:
    ```ts
    onClick={() => {
      if (isLast) return;
      if (sectionBreakInfo !== null) {
        setOverlayMode('section-break');
        return;
      }
      navigate(`/performance/${setlistId}/${parsedSongIndex + 1}`);
    }}
    ```
    `isLast`/`disabled` on the button itself is UNCHANGED (still gates on `parsedSongIndex === flatSongs.length - 1`) — Task 1 only changes what a non-last tap DOES, not whether the button is disabled. This is why AC-6 (final section) needs no new code: when `parsedSongIndex` is the overall last song, `sectionBreakInfo` is `null` (no non-empty section follows) AND `isLast` is `true`, so the button is already disabled and the `onClick` branch is unreachable.
  - [x] The `<JumpOverlay>` render becomes conditional on `overlayMode !== 'closed'` (was `isJumpOverlayOpen`), with `onDismiss={() => setOverlayMode('closed')}`. Add the new `sectionBreak` prop via a spread (matching the `exactOptionalPropertyTypes`-safe `dragProps`-style spread already used in `setlist-overview.tsx`) so the prop is OMITTED (not passed as `undefined`) when not in section-break mode:
    ```tsx
    <JumpOverlay
      sections={setlist.sections}
      currentSongId={displaySongId ?? ''}
      onDismiss={() => setOverlayMode('closed')}
      onSelectSong={(songId) => {
        setActiveDetourSongId(songId === currentSongRef?.songId ? null : songId);
      }}
      {...(overlayMode === 'section-break' && sectionBreakInfo !== null
        ? {
            sectionBreak: {
              targetSongId: sectionBreakInfo.nextSectionFirstSongId,
              sectionName: sectionBreakInfo.nextSectionName,
              onEnterSection: () => {
                navigate(`/performance/${setlistId}/${parsedSongIndex + 1}`);
              },
            },
          }
        : {})}
    />
    ```
    Note `onEnterSection` reuses the EXACT SAME `navigate()` expression the shipped `NEXT ›` handler used to call directly for this transition (Story 4.1's section-traversal math, unchanged — only the trigger moved from "immediate tap" to "CTA/target-row tap inside the auto-opened overlay").
  - [x] Update the file's top-of-file doc comment (ASCII diagram + prose) to note the Story 6.6 additions, following the pattern of how Stories 6.3/6.4/6.5's additions are already documented there — specifically note that `NEXT ›` no longer unconditionally navigates; it now branches on `sectionBreakInfo`.

- [x] Task 2 — `JumpOverlay`: `sectionBreak` prop — highlight override, CTA, target-row routing (AC: 1, 2, 3, 4, 7, 8)
  - [x] In `web/src/components/jump-overlay.tsx` (UPDATE), add to `JumpOverlayProps`:
    ```ts
    sectionBreak?: {
      targetSongId: string;
      sectionName: string;
      onEnterSection: () => void;
    };
    ```
  - [x] Compute `const isSectionBreak = sectionBreak !== undefined && !hasQuery;` (AC-7: a typed query always suppresses section-break mode, regardless of match results — the gate is on `hasQuery`, not on whether the query matches anything).
  - [x] Compute `const effectiveHighlightSongId = isSectionBreak ? sectionBreak.targetSongId : currentSongId;` — this is the ONLY change needed to the highlight logic. Pass `currentSongId={effectiveHighlightSongId}` (not the raw `currentSongId` prop) to every `<SetlistSection>` in the `!hasQuery` render branch. **Do not touch `SetlistSection` or `SongRow`'s prop signatures for highlighting** — they already key off whatever `currentSongId` value they're given.
  - [x] Add a row-select wrapper used ONLY in the `!hasQuery` branch (replaces the direct `handleSelectRow` reference passed as `onSelectRow` to `<SetlistSection>`):
    ```ts
    function handleFullViewRowSelect(songId: string): void {
      if (isSectionBreak && songId === sectionBreak?.targetSongId) {
        sectionBreak.onEnterSection();
        handleDismiss();
        return;
      }
      handleSelectRow(songId);
    }
    ```
    Pass `onSelectRow={handleFullViewRowSelect}` to every `<SetlistSection>` instance in the `!hasQuery` branch. The filtered-query branch (`setlistMatches`/`libraryMatches` `<SongRow>`s) is UNCHANGED — it always uses `handleSelectRow` directly, per AC-7 (a query always means normal jump/detour semantics, even for a row that happens to match the section-break target song).
  - [x] Add an `id` attribute to `SongRow`'s root `<button>`: `id={`jump-overlay-row-${songId}`}` (unconditional — added to every row, harmless when unused). This gives the auto-scroll effect (Task 3) a stable DOM handle without needing `forwardRef` plumbing through `SetlistSection`.
  - [x] Add the bottom-fixed CTA, rendered only when `isSectionBreak`. Reuse the EXACT class list from `web/src/routes/setlist-overview.tsx`'s shipped `Start performance ›` button (see Locked Constraints):
    ```tsx
    {isSectionBreak && sectionBreak !== undefined ? (
      <button
        type="button"
        ref={ctaRef}
        aria-label={SECTION_BREAK.ctaAriaLabel(sectionBreak.sectionName)}
        onClick={() => {
          sectionBreak.onEnterSection();
          handleDismiss();
        }}
        className="fixed inset-x-0 bottom-0 z-40 flex min-h-[64px] items-start justify-center bg-[color:var(--color-accent)] pt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-bg)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 50px)' }}
      >
        {SECTION_BREAK.ctaLabel(sectionBreak.sectionName)}
      </button>
    ) : null}
    ```
    Add bottom padding/margin to the scrollable content region (`className` on the `flex-1 overflow-y-auto ...` div) sufficient that the CTA does not permanently obscure the last row of the final section — the exact pixel value is an implementation choice (e.g. an additional `pb-[96px]`-class utility applied conditionally when `isSectionBreak`); the functional requirement is "every row remains scrollable into view above the fixed CTA," not a specific number.
  - [x] Deliberately UNCHANGED: the dialog's `aria-label="Jump to a song"` and the dismiss control's `aria-label="Dismiss jump overlay"` stay the same in section-break mode — epics does not lock a different dialog-level accessible name for this context, only the CTA's `aria-label` (AC-8). Do not invent new copy here.

- [x] Task 3 — Auto-scroll to the target row + focus the CTA on mount (AC: 1, 8)
  - [x] In `web/src/components/jump-overlay.tsx`, add `const ctaRef = useRef<HTMLButtonElement>(null);` and a mount-only effect:
    ```ts
    useEffect(() => {
      if (sectionBreak === undefined) return;
      document
        .getElementById(`jump-overlay-row-${sectionBreak.targetSongId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      ctaRef.current?.focus();
    }, []);
    ```
    Empty dependency array is deliberate — this must run exactly once, on the overlay's initial mount (it opens once per NEXT-tap; there is no "re-open with different target while already mounted" case in this story's scope). Biome's `useExhaustiveDependencies` will flag the empty array; add a `biome-ignore` comment citing this rationale (matches the precedent already set in `performance-card.tsx`'s mount-only effects, e.g. the atmosphere-flip effect).
    Do not add a manual `prefers-reduced-motion` branch for the scroll `behavior` — the codebase's existing reduced-motion handling is the global CSS rule in `web/src/styles/globals.css` (zeroes `transition-duration`/`animation-duration`), which does not cover `scrollIntoView`'s JS-driven smooth scroll, and no ACs in this story require a specific reduced-motion contingency for the auto-scroll (unlike Story 6.4's search-filter AC, which explicitly does). Leave `behavior: 'smooth'` as the single implementation; note this in Dev Notes as an intentional scope boundary, not an oversight.

- [x] Task 4 — `microcopy.ts`: append `SECTION_BREAK` CTA copy helpers (AC: 2, 8)
  - [x] In `web/src/lib/microcopy.ts` (UPDATE), append a new export:
    ```ts
    /*
     * Section-break orientation CTA copy — Story 6.6 (P1 §B8 lock,
     * one-overview-three-contexts). The bottom-fixed CTA that appears
     * when the jump overlay auto-opens between sections, parallel in
     * shape to `ACTIONS.startPerformance`. `ctaLabel` is the on-screen
     * glyph copy (locked verbatim in epics.md: `Start <section name> ›`);
     * `ctaAriaLabel` is the spoken form, DELIBERATELY dropping the
     * trailing `›` per epics AC's exact locked wording (a documented
     * exception to the `Start performance ›` CTA's aria-label pattern,
     * which does include the glyph — see Story 6.6 Dev Notes).
     */
    export const SECTION_BREAK = {
      ctaLabel: (sectionName: string) => `Start ${sectionName} ›`,
      ctaAriaLabel: (sectionName: string) => `Start ${sectionName}`,
    } as const;
    ```

- [x] Task 5 — Tests (AC: 1–9)
  - [x] `web/src/routes/performance-card.test.tsx` (UPDATE):
    - **REWRITE** the existing test `'NEXT › traverses Section boundaries transparently (Set 1 last → Set 2 first)'` (describe block `'PerformanceCard — single-tap navigation'`) — it currently asserts `navigateMock` is called directly at `songIndex='1'`. Under this story that assertion is FALSE. Repurpose it (keep the describe-block placement or move it into a new describe block — either is fine) to assert instead: tapping `NEXT ›` at `songIndex='1'` does NOT call `navigateMock`, and instead the jump overlay dialog appears (`screen.getByRole('dialog', { name: 'Jump to a song' })`).
    - Add `beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });` (or add to the existing top-level `beforeEach`) — JSDOM does not implement `scrollIntoView`; without this polyfill, Task 3's effect throws and every test that opens the overlay fails.
    - New `describe('PerformanceCard — section-break orientation view (Story 6.6)')` block, using the shipped 2-section (`Set 1`: Autumn Leaves, Black Orpheus; `Set 2`: Take Five) test fixture:
      - at `songIndex='1'` (Black Orpheus, last of Set 1), tapping `NEXT ›` opens the overlay (`role="dialog"`) WITHOUT calling `navigateMock`.
      - the overlay's CTA renders with text `Start Set 2 ›` and `aria-label="Start Set 2"` (NOT `"Start Set 2 ›"`).
      - the CTA's row-equivalent (the row for `song0000000003cc`, "Take Five") carries `aria-current="true"` — verify via `screen.getByRole('button', { current: true })`.
      - tapping the CTA calls `navigateMock` with `/performance/setlistid0000001/2` and the dialog is dismissed (`waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())`).
      - tapping the highlighted Take Five row (instead of the CTA) produces the SAME outcome: `navigateMock` called with `/performance/setlistid0000001/2`, and (regression guard) `useSetActiveDetourSongIdMock` is NOT called for this tap.
      - tapping a Set 1 row (e.g. Autumn Leaves, `song0000000001aa`) instead calls `useSetActiveDetourSongIdMock` with `'song0000000001aa'` and does NOT call `navigateMock` (AC-4 — normal detour path, unchanged plumbing).
      - typing a query into the search field hides the CTA (`screen.queryByRole('button', { name: /Start Set 2/ })` is null) and typing then clearing it restores the CTA.
      - at `songIndex='2'` (Take Five, last song of the FINAL section — existing Story 4.4 fixture state), tapping `NEXT ›` remains a no-op: `NEXT ›` stays `disabled`, no dialog opens, `navigateMock` is not called (extends the existing last-song describe block's coverage; a new assertion, not a rewrite, since the existing tests there already prove `disabled`/`aria-disabled` — this one proves the overlay specifically does NOT auto-open).
  - [x] `web/src/components/jump-overlay.test.tsx` (UPDATE):
    - Add `beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });`.
    - New `describe('JumpOverlay — section-break orientation (Story 6.6)')` block, passing a `sectionBreak={{ targetSongId: 'song0000000003cc', sectionName: 'Set 2', onEnterSection: onEnterSectionMock }}` prop (extend `renderOverlay()`'s `overrides` param — it already spreads `...overrides` onto the component, so no helper signature change needed; just pass `{ sectionBreak: {...} }` as an override in the relevant tests):
      - the "Take Five" row (matching `targetSongId`) — not `currentSongId` — carries `aria-current="true"`; the `currentSongId` row does NOT.
      - the CTA button renders with text `Start Set 2 ›`, `aria-label="Start Set 2"`, and calls `document.getElementById` (or asserts the mocked `scrollIntoView`) — assert `Element.prototype.scrollIntoView` was called on mount (or, more robustly, that the target row's DOM node had `.scrollIntoView` invoked — use `vi.spyOn(HTMLElement.prototype, 'scrollIntoView')` if a per-instance spy is needed for precision).
      - on mount, the CTA button receives focus (`expect(ctaButton).toHaveFocus()` or `document.activeElement === ctaButton`).
      - tapping the CTA calls `onEnterSectionMock` once and, after the fade, `onDismiss`; `onSelectSong` is NOT called.
      - tapping the highlighted target row produces the SAME outcome as the CTA (`onEnterSectionMock` called, `onSelectSong` NOT called).
      - tapping a non-target row (e.g. Black Orpheus) calls `onSelectSong` with that row's songId (NOT `onEnterSectionMock`) — regression guard proving section-break mode doesn't hijack unrelated rows.
      - typing a query hides the CTA (`screen.queryByRole('button', { name: /Start Set 2/ })` is null) and a subsequent tap on a row that happens to match `targetSongId`'s title now calls `onSelectSong`, NOT `onEnterSectionMock` (AC-7 — query collapses section-break mode entirely).
      - WITHOUT the `sectionBreak` prop (all existing tests), CTA never renders, `effectiveHighlightSongId` behaves exactly as the current shipped `currentSongId` logic (regression guard — existing assertions must still pass verbatim).
  - [x] Run `pnpm --filter web run test`, `pnpm --filter web run typecheck`, and `pnpm lint` — all clean before marking `review`.

## Dev Notes

### Why this is "one overview, three contexts," not a new component

P1 §B8 (journey doc, locked 2026-07-19) and the mockup brief are explicit: the section-break orientation state is a *reuse* of the exact same setlist-overview-shaped surface used for the mid-performance jump (B3/B4) — "one layout, contextual scroll and highlight," never a distinct component. This story's entire job is threading ONE new optional prop (`sectionBreak`) through the already-shipped `<JumpOverlay>`, not building a parallel surface. If an implementation reaches for a new file/component, it has misread the brief.

### Why `NEXT ›`'s behaviour change is intentional, not a regression to avoid

Story 4.1 shipped `NEXT ›` traversing Section boundaries "transparently" — tap NEXT at the last song of Set 1, land directly on the first song of Set 2. Story 6.6 makes that transition NON-transparent on purpose: instead of landing directly on the next song, Sandy now sees an orientation moment (the auto-opened overlay) before committing to the next section. The existing Story 4.1 test asserting direct, immediate navigation must be rewritten to assert the new two-step flow (open overlay → tap CTA/row → THEN navigate). Do not read the locked-constraints "no regressions" convention as forbidding this — the epics AC for 6.6 explicitly supersedes the old behaviour, exactly as Story 6.3's toolbar-preview removal explicitly superseded Story 4.1's preview span (see the `d2dfd64` precedent commit).

### Why the CTA / target-row navigate, but every other row detours

The distinction is "is this tap the section's designated *entry* interaction, or an arbitrary jump?" The CTA and the highlighted target row both represent "yes, continue on-plan into Set 2" — a genuine plan advance, so they call `navigate()` (mutating the URL / plan cursor), exactly like the original direct `NEXT ›` tap would have. Every OTHER row (a Set 1 replay, an encore lookup, a library reach) is an arbitrary jump away from the plan, so it goes through the existing `onSelectSong` → `setActiveDetourSongId()` path unchanged. This mirrors the exact "plan cursor vs. detour" distinction Story 6.5 already drew for the mid-performance jump overlay — 6.6 does not invent a new state machine, it just adds one more entry point (the auto-opened overlay) that can ALSO produce a genuine plan advance under specific conditions (CTA / target row, no query active).

### Why `hasQuery` is the sole gate for collapsing section-break mode (AC-7)

Once Sandy starts typing, the overlay's whole purpose shifts from "orient into the next section" to "search for anything" — the two intents are mutually exclusive by design (mirrors Story 6.4's existing `!hasQuery` gate for the full sectioned view vs. filtered groups). Gating on `hasQuery` alone (not on whether the query happens to match the target song) keeps the logic in one place and avoids a second "is this really still a section-break tap" check scattered through the row-selection code path.

### Copy this story invents (not epics-locked verbatim)

Epics.md locks the visible CTA copy pattern `Start <section name> ›` and the focus-on-open requirement, but the CTA's `aria-label` wording is explicitly specified in epics as `"Start <section name>"` (AC text: `aria-label="Start <section name>"`), which is DIFFERENT from how the shipped `Start performance ›` CTA's aria-label was implemented (`aria-label={ACTIONS.startPerformance}`, i.e. INCLUDING the `›` glyph). This is a genuine, deliberate divergence baked into the epics AC itself — implement it as written (drop the `›` in the new CTA's aria-label) rather than "fixing" it to match the older pattern. If Sandy wants the two CTAs' aria-label conventions unified later, that is a separate copy-only correction story.

### Known drift vs. the planning docs (do not fix here)

The journey doc (`journey-p1-performance.md` line 145) describes a slightly different nested flow — "if Sandy jumps *from* the section-break view... detour semantics apply: the section-break view is the return anchor" — which reads as if the section-break view's "return anchor" for a subsequent detour is the section-break view itself, distinct from the plan-cursor song. The SHIPPED Story 6.5 detour mechanism has no concept of "the section-break view" as a return anchor separate from `currentSongRef` (the plan-cursor song, i.e. the last song of Set 1, which is exactly where the card still sits when the overlay auto-opens). In practice these coincide — the plan cursor IS the last song of Set 1 throughout the section-break overlay's lifetime — so no separate mechanism is needed; a Set-1-row tap already correctly enters a detour with the plan cursor still on the last song of Set 1 (Story 6.5's existing math). This is not a gap this story needs to close; flag it in code review only if Sandy wants a different return-anchor semantic explored.

### Files touched

| File | Change |
|---|---|
| `web/src/routes/performance-card.tsx` | UPDATE — `sectionBreakInfo` derivation; `overlayMode` replaces `isJumpOverlayOpen`; `NEXT ›` branches into section-break mode; `sectionBreak` prop passed to `<JumpOverlay>`; doc-comment update |
| `web/src/components/jump-overlay.tsx` | UPDATE — new optional `sectionBreak` prop; highlight override; CTA render; target-row routing; auto-scroll + focus mount effect; `id` attribute on `SongRow` |
| `web/src/lib/microcopy.ts` | UPDATE — new `SECTION_BREAK` export (`ctaLabel`, `ctaAriaLabel`) |
| `web/src/routes/performance-card.test.tsx` | UPDATE — rewrite the Story 4.1 section-traversal test; new `describe('PerformanceCard — section-break orientation view (Story 6.6)')` block; `scrollIntoView` polyfill |
| `web/src/components/jump-overlay.test.tsx` | UPDATE — new `describe('JumpOverlay — section-break orientation (Story 6.6)')` block; `scrollIntoView` polyfill |

No other files should need to change. In particular: no changes to `web/src/components/currently-performing-strip.tsx`, `web/src/routes/setlist-overview.tsx`, or `web/src/performance/performance-context.tsx` (see Scope boundary above); no shared-package schema changes; no new API routes; no new CSS custom properties in `tokens.css`.

### Architecture compliance

- File naming: `kebab-case` — all touched files already conform.
- TypeScript `strict: true` — the new `sectionBreak` prop is a fully-typed optional object (no `any`); the spread-to-omit pattern in Task 1 respects `exactOptionalPropertyTypes` (matches the existing `dragProps` precedent in `setlist-overview.tsx`).
- No parallel Zod schema — no new record shapes introduced; `sectionBreakInfo` is component-local derived data, not persisted state.
- State management: `overlayMode` remains component-local `useState` (matches the existing Story 6.3 precedent that overlay open/closed-ness is single-route transient UI state, NOT `PerformanceModeContext`) — this story does not promote anything into context, unlike Story 6.5's detour override.
- Accessibility: focus-on-open via ref + `useEffect` (never `autoFocus`, per Biome `noAutofocus` — matches `PerformanceCard`'s own `nextButtonRef` pattern); `aria-current="true"` on the highlighted row (existing Story 6.4 pattern, color-never-alone compliant, architecture.md "Color-never-alone" bullet).
- Testing: Vitest + RTL, co-located `*.test.ts(x)`, no snapshot tests, `describe('<unit>', () => { it('<behavior> under <condition>') })` naming. [Source: architecture.md "Testing patterns"]
- Biome is the sole lint/format tool — run `pnpm lint` before marking `review`. Expect a `biome-ignore` comment on Task 3's mount-only effect (empty dependency array), matching the precedent already in `performance-card.tsx`'s mount-only effects and Story 6.5's own `biome-ignore` on its mount-preserving effect.
- Microcopy: append-only `SECTION_BREAK` addition, following the established non-locked (for the aria form) / locked (for the visible glyph form) convention already used by `PERFORMANCE_CARD`/`JUMP_OVERLAY`/`CURRENTLY_PERFORMING`.

### Previous story intelligence (6.5, immediately prior)

Story 6.5 (`baseline_commit` = `e5cdd2a`; committed as `8ee72f0`, with a same-day fix `62c0ec0` for a detour-fetch-failure edge case) shipped:
- The promotion of the detour override into `PerformanceModeContext` (`activeDetourSongId`/`setActiveDetourSongId`) — Story 6.6 reads/writes this via the EXISTING `onSelectSong` callback already wired in `performance-card.tsx`; no new context work.
- The `DETOUR` position-slot swap and contextual `‹` — unaffected by this story; a Set-1-row tap from the section-break overlay produces exactly the same detour UI Story 6.5 already built.
- `performance-card.test.tsx`'s hoisted `useActiveDetourSongIdMock`/`useSetActiveDetourSongIdMock` mocks — this story's new tests reuse them as-is (asserting `useSetActiveDetourSongIdMock` is/isn't called for various section-break-overlay row taps).
- A same-day fix commit (`62c0ec0`) shows this codebase's dev-story workflow does sometimes need a fast-follow correction commit within the same story — if Task 3's `scrollIntoView` polyfill or the `biome-ignore` rationale turns out insufficient during implementation, prefer a small, well-scoped fix within THIS story's commit rather than deferring.

### Git intelligence summary

Recent commits: `1c86ce9` (sprint-status housekeeping, current HEAD), `62c0ec0` (Story 6.4 fast-follow fix), `8ee72f0` (Story 6.5), `e5cdd2a` (Story 6.4), `1d47045` (Story 6.3) — each epic-6 story is a single commit (occasionally with one same-day fix commit) touching `performance-card.tsx` + one or two collaborator files. This story is the FOURTH to touch `performance-card.tsx` in this epic and the THIRD to touch `jump-overlay.tsx` (after its Story 6.3 creation and Story 6.4 content-fill) — expect a moderate diff in both, plus a small `microcopy.ts` addition and moderate test-file diffs (rewriting one existing assertion, adding two new describe blocks).

### Project Structure Notes

- No conflicts detected with `web/src/routes/`, `web/src/components/`, or `web/src/lib/` (kebab-case, co-located tests, flat directories — no subfolders).
- `web/src/performance/performance-context.tsx` needs NO changes for this story — confirmed by tracing that `sectionBreakInfo` is derivable entirely from data `PerformanceCard` already holds (`setlist`, `parsedSongIndex`) plus the EXISTING `setActiveDetourSongId` setter for the non-target-row case.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.6] (lines 2095–2156) — canonical AC statements this story implements
- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.2] (lines 1896–1932) — `SECTION_HEADING.songCount` reuse precedent already established for iPhone section headings
- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.5] (lines 2035–2093) — the detour-state machine this story's Set-1-row-tap path (AC-4) reuses unchanged
- [Source: _bmad-output/planning-artifacts/journeys/journey-p1-performance.md] lines 133–149, 179, 198 (§B8, decisions 5 and 4) — section-break state-machine semantics, "one overview, three contexts" pattern, `‹` returns to the last song of the previous section
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] lines 24, 42, 141–163, 203–211, 250, 275, 293–297, 313, 330, 362–364 — S2 CTA lock, no-dimming lock, "one overview surface, three contexts" composition rule, color-never-alone
- [Source: _bmad-output/planning-artifacts/mockups/rendered/p1-performance/iteration-2/state-6-section-break-S2-cta.png] — approved section-break rendering (the epics AC-9 visual-check reference; NOTE iteration-1 and iteration-3 also contain same-named files — iteration-2 is the one epics.md line 2153 names as canonical)
- [Source: architecture.md "State management taxonomy"] — React Context reserved for cross-cutting state; confirms `overlayMode` correctly stays component-local (not promoted), unlike Story 6.5's `activeDetourSongId`
- [Source: architecture.md "Pattern enforcement" — Color-never-alone bullet] — `aria-current` pairing requirement already satisfied by the existing Story 6.4 highlight mechanism this story reuses
- [Source: architecture.md "Testing patterns"] — Vitest + RTL, co-located tests, no snapshots, `describe`/`it` naming convention
- [Source: web/src/routes/performance-card.tsx] — current implementation as of `baseline_commit` (read in full during this story's creation)
- [Source: web/src/components/jump-overlay.tsx] — current implementation as of `baseline_commit` (read in full during this story's creation); `SetlistSection`/`SongRow` prop shapes confirmed to need NO signature changes for the highlight-override approach
- [Source: web/src/routes/setlist-overview.tsx] lines 417–436 — the shipped `Start performance ›` CTA whose exact class list this story's new CTA reuses verbatim
- [Source: web/src/lib/microcopy.ts] — existing `PERFORMANCE_CARD`/`JUMP_OVERLAY`/`SECTION_HEADING`/`ACTIONS.startPerformance` conventions this story's new `SECTION_BREAK` export follows
- [Source: web/src/routes/performance-card.test.tsx] lines 72–151 — the shipped 2-section (`Set 1`: 2 songs / `Set 2`: 1 song) `makeSetlist()` fixture this story's new tests reuse verbatim; lines 375–387 — the EXISTING test this story must rewrite (see Locked Constraints)
- [Source: web/src/components/jump-overlay.test.tsx] — the shipped Story 6.4 test suite's `renderOverlay()` helper and fixture data (`SECTIONS`, `LIBRARY_SONGS`) this story's new describe block reuses
- [Source: web/src/styles/globals.css] lines 24–39 — the existing global `prefers-reduced-motion` CSS rule (zeroes transition/animation durations); confirms why this story does NOT need a separate JS-level reduced-motion branch for `scrollIntoView`
- [Source: _bmad-output/implementation-artifacts/6-5-detour-state-d3-currently-performing-strip-detour-signal.md] — previous story's Dev Notes patterns and Files-touched/Testing conventions this story follows

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (bmad-dev-story workflow, auto mode).

### Debug Log References

- `pnpm --filter web run test` — 63 files, 659 tests, all green (initial run reported a flake in `src/app-bootstrap.test.tsx` unrelated to this story; re-run was fully green).
- `pnpm --filter web run typecheck` — clean.
- `pnpm lint` — clean (217 files checked).

### Completion Notes List

- Implemented section-break orientation via the "one overview, three contexts" pattern — no new component; a single optional `sectionBreak` prop threads the new context through the shipped `<JumpOverlay>`. `SectionBreakOverlay` was NOT created (locked constraint honoured).
- `PerformanceCard`'s Story 6.3 `isJumpOverlayOpen` boolean was replaced by a three-state `overlayMode` (`'closed' | 'jump' | 'section-break'`). The `≡ jump` control still opens the overlay in `'jump'` mode; `NEXT ›` at a non-final section boundary now opens it in `'section-break'` mode. Every other `NEXT ›` tap navigates directly, unchanged.
- `sectionBreakInfo` is derived in-component from `setlist.sections` + `parsedSongIndex`; no context field, no schema change, no `SongRef.key` change. Empty sections between the current and next section are skipped defensively (matches the shipped `hasAnySong` permissiveness on `Start performance ›`).
- `sectionBreak` is passed to `<JumpOverlay>` via an `exactOptionalPropertyTypes`-safe spread, so the prop is OMITTED (not passed as `undefined`) when in `'jump'` mode — matches the shipped `dragProps` precedent in `setlist-overview.tsx`.
- `JumpOverlay` gained: `sectionBreak` prop; `isSectionBreak` gate (`sectionBreak !== undefined && !hasQuery` — `hasQuery` is the sole collapse gate per AC-7); `effectiveHighlightSongId` (overrides `currentSongId` only for highlight when in section-break mode); `handleFullViewRowSelect` wrapper (target-row → `onEnterSection`, every other row → `handleSelectRow`, unchanged); mount-only auto-scroll + CTA focus effect (empty deps, `biome-ignore` on `useExhaustiveDependencies` matching Story 6.5's precedent); bottom-fixed CTA reusing the EXACT class list from `Start performance ›`; `pb-[96px]` on the scroll region only when in section-break mode.
- `SongRow` unconditionally carries `id="jump-overlay-row-<songId>"` — harmless when unused, avoids `forwardRef` plumbing through `SetlistSection`.
- Aria-label divergence honoured: CTA's `aria-label` is `Start Set 2` (no trailing `›`), while its on-screen text is `Start Set 2 ›` — this is deliberately DIFFERENT from the shipped `Start performance ›` CTA's aria-label pattern per epics AC-8. Regression test asserts `getByRole('button', { name: 'Start Set 2' })` succeeds AND `getByRole('button', { name: 'Start Set 2 ›' })` returns null.
- Story 4.1's `NEXT ›` transparent-traversal test was rewritten (not preserved) — the section boundary is no longer traversed transparently by design.
- `Element.prototype.scrollIntoView = vi.fn()` polyfill added to both `performance-card.test.tsx` and `jump-overlay.test.tsx` `beforeEach` — JSDOM does not implement it, and Task 3's effect would otherwise throw on every test that opens the overlay.
- Reduced-motion for `scrollIntoView` intentionally NOT branched at JS level — no AC requires it and the global `prefers-reduced-motion` CSS rule covers only durations. Documented in Dev Notes.

### File List

- `web/src/lib/microcopy.ts` — UPDATE (added `SECTION_BREAK` export)
- `web/src/components/jump-overlay.tsx` — UPDATE (new `sectionBreak` prop, highlight override, target-row routing, auto-scroll + focus mount effect, bottom-fixed CTA, `id` attribute on `SongRow`; doc-comment additions)
- `web/src/components/jump-overlay.test.tsx` — UPDATE (added `scrollIntoView` polyfill; new `describe('JumpOverlay — section-break orientation (Story 6.6)')` block)
- `web/src/routes/performance-card.tsx` — UPDATE (`sectionBreakInfo` derivation; `overlayMode` replaces `isJumpOverlayOpen`; `NEXT ›` branches into section-break mode; `sectionBreak` prop passed to `<JumpOverlay>`; doc-comment update)
- `web/src/routes/performance-card.test.tsx` — UPDATE (added `scrollIntoView` polyfill; rewrote Story 4.1 section-traversal test; new `describe('PerformanceCard — section-break orientation view (Story 6.6)')` block)
- `_bmad-output/implementation-artifacts/6-6-section-break-orientation-view-s2-cta.md` — this file (tasks/subtasks checked, Dev Agent Record + File List filled, Status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status transitions

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-08-17 | Story 6.6 implemented — section-break orientation view via `sectionBreak` prop on shipped `<JumpOverlay>`; `NEXT ›` at a non-final section boundary now opens the overlay in section-break mode with a bottom-fixed `Start <sectionName> ›` CTA. All 659 web tests green; typecheck + lint clean. | Amelia (dev agent) |
