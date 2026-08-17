---
baseline_commit: "fba00ff"
builds_on: 6-2-chrome-polish-key-patch-single-row-section-count-format
---

# Story 6.3: Jump affordance `≡ jump` in bottom toolbar (P1 jump-affordance A2 lock)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want a third control in the Performance Card bottom toolbar — placed between `‹` and `NEXT ›`, rendered as `≡ jump` — that opens a dismissable overlay above the performance card without releasing wake lock or unmounting the card,
So that from the sacred-state surface I can reach for any song in the setlist or the library with a single tap in a spatially predictable location.

## Locked constraints (do not relitigate)

- Visual direction is locked — do not propose alterations to color, typography, or layout philosophy. This story implements the already-locked A2 placement (`≡ jump` as the third bottom-toolbar control) and a **minimal shell** overlay only — no new colors, no new type scale, no redesign of the Performance Card's existing three-region layout.
- Sandy IS the user — skip persona ceremony.
- iOS PWA + Safari cookie sharing pattern is intentional (not touched by this story).
- British English spelling and idiom in UI copy is intentional. This story introduces no new prose copy beyond the `≡ jump` label and two aria-labels — verify final wording reads naturally in British English (it does: no American idiom involved).
- **Scope boundary (critical):** this story delivers the toolbar control + a minimal overlay shell (dismiss control + empty content region) + the removal of the shipped next-song preview span (see AC-1 and Dev Notes). Nothing else. The full setlist-overview + search content inside the overlay is Story 6.4's scope — do NOT build search, do NOT build the setlist-row list, do NOT wire the library cache. Building ahead of scope here would duplicate/conflict with Story 6.4's implementation.
- The overlay is a *view*, not an exit: opening it must not call `setActive(false)`, must not release Wake Lock, must not change `activeSongIndex`/plan cursor, and must not unmount `<PerformanceCard>`. This is the single most important invariant in this story — get it wrong and Epic 4's sacred-state contract (AR-28) breaks.
- No new CSS custom properties are added to `web/src/styles/tokens.css`. This story needs no new type-scale or color tokens — reuse `--color-bg`, `--color-surface`, `--color-text-secondary`, `--text-perf-meta`, `--radius-*` as already defined.

## Acceptance Criteria

**AC-1 — Bottom toolbar renders three controls in the locked A2 order, four-corners spatial safety preserved, next-song preview span REMOVED**

**Given** any Performance Card state (plan, detour, last song, wake-lock-lost)
**When** the bottom toolbar renders
**Then** the toolbar contains three controls left-to-right: `‹` (back, low-emphasis), `≡ jump` (new, low-emphasis, mid-toolbar), `NEXT ›` (right-biased, `accent` fill, `bg` text)
**And** the four-corners spatial-safety rule holds: `×` top-left, position indicator top-right, `‹` bottom-left, `NEXT ›` bottom-right; `≡ jump` occupies the toolbar interior between `‹` and `NEXT ›` (never a corner)
**And** the previously-shipped next-song preview `<span>` (Story 4.1) is **removed** — the toolbar renders exactly three controls, with no preview text between them. This is a deliberate design revision made during Story 6.3 spec-review: the preview took thumb space without earning it, and `NEXT ›` on its own communicates the next-tap advance. This supersedes the `next: Wat…` compression shown in `mockups/rendered/p1-performance/iteration-1/state-A2-jump-bottom-toolbar.png` and the preview-slot references throughout `mockups/p1-performance.md`; epics.md AC-1 for Story 6.3 is now authoritative.

**AC-2 — Tapping `≡ jump` opens an overlay without disturbing Performance Mode state**

**Given** Sandy taps the `≡ jump` control
**When** the tap is registered
**Then** an overlay mounts on top of the Performance Card
**And** the performance card DOES NOT unmount; wake lock DOES NOT release; `performanceActive` DOES NOT change; the plan cursor (`activeSongIndex`) DOES NOT change
**And** the overlay presents its own dismiss control (`‹` top-left, glyph only, low-emphasis)
**And** tapping the overlay's `‹` dismisses it and returns focus to the Performance Card in its prior state (same song, same scroll position — the card was never unmounted so this is automatic)

**AC-3 — Overlay is a minimal shell in this story's scope (Story 6.4 delivers content)**

**Given** the overlay is open in this story's scope
**When** it renders
**Then** it renders as a minimal shell (dismiss control + empty content region) — no search field, no setlist rows, no library rows (those are Story 6.4's scope)
**And** the shell is styled in the Club Warm (performance) atmosphere with no bottom tab bar and no top nav
**And** the shell mounts and dismisses with a **real 150ms opacity transition** (Tailwind `transition-opacity duration-150` on the overlay root); `prefers-reduced-motion` collapses to instant — already handled globally by the `globals.css` reduced-motion rule, no story-specific override needed. Instant mount/unmount is NOT acceptable for this story: the ≤150ms budget in the epic is a maximum, but the intent (per the P1 lock) is a smooth appearance — a real fade is required. Do NOT add a new dependency (e.g. Framer Motion) — plain Tailwind CSS transition classes are sufficient.

**AC-4 — Overlay inherits the same in-performance auth-hold rule as the card (AR-28)**

**Given** the overlay is open
**When** any performance-mode API call would normally 401 (per AR-28)
**Then** the 401 is held (no redirect to `/login`) — the overlay inherits the same in-performance auth-hold rule as the underlying card
**Note:** this story's overlay makes **no API calls of its own** (empty shell, no data fetch) — this AC is satisfied structurally by NOT introducing any new fetch/auth-sensitive logic inside the overlay, and by confirming `performanceActive` stays `true` for the overlay's entire lifetime (see AC-2). No new test double or auth-hold logic needs to be written by this story; Story 6.4 (which adds the library-cache read) is where this rule becomes actively exercised.

**AC-5 — Accessibility: `≡ jump` control is correctly labelled, avoids "menu" framing**

**Given** the `≡ jump` control
**When** an accessibility audit runs
**Then** the control has `aria-label="Open setlist and library jump overlay"`
**And** the label does not read as "menu" (avoid hamburger connotations per the mockup brief — the `≡` glyph is visual only; the spoken label never says "menu")
**And** the overlay's dismiss control has an aria-label distinguishing it from the card's own `‹` (e.g. `aria-label="Dismiss jump overlay"`) so VoiceOver does not announce two identical "Previous song" controls when the overlay is open

## Tasks / Subtasks

- [ ] Task 1 — Restructure the bottom toolbar: delete the next-song preview span, add `≡ jump` control (AC: 1, 5)
  - [ ] Add `PERFORMANCE_CARD.jumpButton = '≡ jump'` and `PERFORMANCE_CARD.ariaOpenJumpOverlay = 'Open setlist and library jump overlay'` to `web/src/lib/microcopy.ts` (UPDATE, non-locked `PERFORMANCE_CARD` surface — append only, do not touch `EMPTY_STATES`/`BANNERS`/`ACTIONS`/`FIELD_LABELS`)
  - [ ] In `web/src/routes/performance-card.tsx` (UPDATE), **delete** the next-song preview `<span aria-hidden="true" className="flex-1 truncate …">{nextSongRef?.titleSnapshot ?? ''}</span>` block (lines 335–340 as of `baseline_commit`). Also delete the now-unused `nextSongRef` binding at line ~210 if no other reference remains (grep to confirm before deleting).
  - [ ] In its place, **insert a new `<button>`** for `≡ jump` between the existing `‹` button and the `NEXT ›` button. Style it low-emphasis to match `‹` (same `text-[length:var(--text-perf-meta)]`, `text-[color:var(--color-text-secondary)]`, `min-h-tap min-w-tap` classes as the existing `‹` button) — do NOT give it `accent` fill (that treatment is reserved for `NEXT ›`). Use `flex-1` or `mx-auto` on the button (or a spacer) so it visually centres in the toolbar interior with `‹` at the left and `NEXT ›` at the right — the exact spacing approach is at implementer's discretion, but the resulting layout must match the A2 mockup's spatial intent (jump control in the toolbar interior, corners preserved).
  - [ ] Button label is `{PERFORMANCE_CARD.jumpButton}`; `aria-label={PERFORMANCE_CARD.ariaOpenJumpOverlay}`
  - [ ] `onClick` sets new local `useState<boolean>` `isJumpOverlayOpen` to `true` — this is component-local state, NOT `PerformanceModeContext` state (the overlay's open/closed-ness is not part of the cross-cutting Performance Mode contract; only `performanceActive`/`activeSongIndex`/`performanceView` live in context, per `performance-context.tsx`'s existing shape)
  - [ ] Post-restructure DOM order in the `<footer>` is exactly: `‹` (bottom-left) → `≡ jump` (interior) → `NEXT ›` (bottom-right). Three children, no preview span. Confirm the four-corners rule still holds (no corner control moved).
  - [ ] Update the `<footer>`'s inline comment block (lines 315–317 as of `baseline_commit`) to reflect the new three-control layout — remove the "preview between them" phrasing, replace with "`≡ jump` between them (interior, no preview span — removed in Story 6.3)".

- [ ] Task 2 — Build the minimal `JumpOverlay` shell component (AC: 2, 3, 5)
  - [ ] Create `web/src/components/jump-overlay.tsx` (NEW) — a standalone component (not inlined in `performance-card.tsx`) because Story 6.4 will substantially extend its content (search field, setlist rows, library rows); keeping it separate now avoids a large diff/re-review in 6.4 and matches the existing pattern of extracting dialog-shaped UI into its own component (see `AnnotationSheet` inside `setlist-song-row.tsx` for the closest existing analogue — role/aria-modal pattern, not file-separation pattern, since that one is co-located; this story's overlay is significant enough in its own right, plus explicitly earmarked for extension, to warrant its own file)
  - [ ] Component signature: `JumpOverlay({ onDismiss }: { onDismiss: () => void }): JSX.Element`. No other props in this story's scope (Story 6.4 will add setlist/library data props)
  - [ ] Render: `<div role="dialog" aria-modal="true" aria-label="Jump to a song" className="fixed inset-0 z-50 flex flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">` — full-screen overlay (not a bottom sheet like `AnnotationSheet`; the mockup brief calls for a full-screen overlay "on top of the performance card")
  - [ ] Top chrome: a single `<button>` row containing only the dismiss control — `‹` glyph, `aria-label="Dismiss jump overlay"`, `onClick={onDismiss}`, styled low-emphasis (reuse `text-[length:var(--text-perf-meta)] text-[color:var(--color-text-secondary)] min-h-tap min-w-tap`), positioned top-left, respecting `env(safe-area-inset-top)` the same way the Performance Card header does
  - [ ] Content region: an empty `<div className="flex-1">` (or equivalent) — explicitly empty in this story; add a code comment noting Story 6.4 fills this with the pinned search + scrolling setlist overview + library reach
  - [ ] No bottom tab bar, no top nav — this is implicit (the component renders nothing else), but add a comment confirming this is intentional per AC-3
  - [ ] Transition: apply Tailwind `transition-opacity duration-150 ease-out` on the overlay root, plus a small mount-frame trick (initial `opacity-0` on first paint, then `opacity-100` after a `useEffect` schedules it — or use the `hidden`/`block` toggle inside a keyframed CSS animation, whichever reads cleaner in this codebase). The overlay must visibly fade in over ~150ms rather than appearing instantly. Instant mount/unmount is NOT acceptable — per AC-3, a real fade is required. Do NOT add a new animation dependency (e.g. Framer Motion) — plain Tailwind classes suffice. `prefers-reduced-motion` is already handled globally by the `globals.css` reduced-motion rule; verify that rule targets `transition-*` utilities generically and add a small comment in `jump-overlay.tsx` confirming the shell inherits that global.

- [ ] Task 3 — Wire the overlay into `PerformanceCard` (AC: 2, 3, 4)
  - [ ] Import `JumpOverlay` in `web/src/routes/performance-card.tsx`; conditionally render `{isJumpOverlayOpen ? <JumpOverlay onDismiss={() => setIsJumpOverlayOpen(false)} /> : null}` as the last child of the root `<div>` (so it visually stacks on top of the existing header/main/footer via `fixed inset-0 z-50`)
  - [ ] Confirm (by code inspection, and by a test — see Task 4) that none of the existing mount-effects that manage `performanceActive`, `activeSongIndex`, `performanceView`, atmosphere, or viewport-zoom are re-run or torn down when the overlay opens/closes — the overlay is purely additive local UI state; it does not touch any `useEffect` dependency array already in the file
  - [ ] Do NOT wire any API/data fetching inside `JumpOverlay` in this story (AC-4's "no new fetch" note above) — Story 6.4 owns that

- [ ] Task 4 — Tests (AC: 1, 2, 3, 4, 5)
  - [ ] `web/src/components/jump-overlay.test.tsx` (NEW) — co-located, Vitest + RTL, `describe('JumpOverlay', ...)`, no snapshot tests:
    - renders with `role="dialog"` and `aria-modal="true"`
    - renders the dismiss control with `aria-label="Dismiss jump overlay"`
    - tapping the dismiss control calls `onDismiss`
    - content region renders with no setlist/search content present (assert absence, e.g. no `role="searchbox"`/no text input, no list — guards against scope creep into Story 6.4's territory)
  - [ ] `web/src/routes/performance-card.test.tsx` (UPDATE) — two edits, both required:
    - **Delete or rewrite** the existing `describe('PerformanceCard — next-song preview', …)` block (around lines 372–390 as of `baseline_commit`). The preview span no longer exists; the two tests in this block (`shows the next Song titleSnapshot in the bottom toolbar` and `renders an empty preview on the last Song`) are now false. Replace the block with a single test asserting the toolbar does NOT render the preview — e.g. `expect(screen.queryByText('Black Orpheus')).toBeNull()` for the mid-set case (or a scoped assertion inside the `<footer>`), plus a code-comment noting Story 6.3 removed the preview.
    - Also update the `next-song preview is empty on the last Song` test at line ~557 in the "graceful not-found" region if it references the preview span (rename/rewrite to assert absence). Search the whole file for any other `titleSnapshot`/preview references in the footer scope and reconcile.
    - **Add a new** `describe('PerformanceCard — jump overlay (Story 6.3)', ...)` block:
      - renders the `≡ jump` button with `aria-label="Open setlist and library jump overlay"`
      - `≡ jump` renders between `‹` and `NEXT ›` in DOM order (four-corners / A2 placement — mirror the existing DOM-order test pattern used for `×`/`‹` at line ~469; assert exactly three footer buttons — `‹`, `≡ jump`, `NEXT ›` — via `within(footer).getAllByRole('button')` length assertion)
      - tapping `≡ jump` mounts the overlay (`screen.getByRole('dialog', { name: 'Jump to a song' })`)
      - tapping `≡ jump` then the overlay's dismiss control unmounts the overlay (`screen.queryByRole('dialog')` is null) and the Performance Card's own header/footer are still present (card not unmounted)
      - tapping `≡ jump` does NOT call `setPerformanceActiveMock`, does NOT call `setActiveSongIndexMock` a second time beyond the existing mount-effect call, and does NOT call `navigateMock` (use the existing hoisted mocks — `setPerformanceActiveMock`, `setActiveSongIndexMock`, `navigateMock` — asserting call counts before/after the tap)
      - reuse the existing `makeSetlist()`/mock-setup scaffolding already in the file; no new test infrastructure needed
  - [ ] Run `pnpm --filter web run test` and `pnpm lint` — both must be clean before marking this story `review`. Expect the two deleted/rewritten preview tests to be the only pre-existing tests this story invalidates; if any other test suite (`section-heading.test.tsx`, `chord-chart.test.tsx`, e2e) references the preview, treat that as unexpected and re-scope.

## Dev Notes

### Why a separate `JumpOverlay` component (not inline JSX in `performance-card.tsx`)

`performance-card.tsx` is already 364 lines (as of `baseline_commit`) and Story 6.4's AC (epics.md Story 6.4) will add a pinned search field, a scrolling sectioned setlist overview, and an `In library` results group to this same overlay — a non-trivial amount of new markup and state (search query, filtered results, library-cache lookups). Building that directly into `performance-card.tsx` would make the route file unmanageably large and would force Story 6.4 to touch the same file/region this story just wrote, increasing merge/review friction. Extracting `JumpOverlay` now, with a deliberately empty content slot, gives Story 6.4 a clean, isolated file to extend (`web/src/components/jump-overlay.tsx`) without re-touching `performance-card.tsx` beyond passing whatever new props Story 6.4 needs.

### State ownership: component-local, not `PerformanceModeContext`

`performance-context.tsx` ([Source: web/src/performance/performance-context.tsx], read in full during this story's creation) defines exactly four pieces of cross-cutting state: `performanceActive`, `activeSetlistId`/`activeSongIndex`, and `performanceView` (`'card' | 'overview' | null`). None of these represent "is the jump overlay open." Do NOT add a fifth context field for overlay visibility — it is transient, single-route UI state that lives and dies with the `PerformanceCard` component instance, exactly like other local `useState` already in sibling components (e.g. `sheetOpen` in `setlist-song-row.tsx`'s `SetlistSongRow`, which gates `AnnotationSheet` the same way this story's `isJumpOverlayOpen` gates `JumpOverlay`). Follow that established pattern.

### AR-28 auth-hold — what this story does and does not need to do

AR-28 (epics.md line 160): "`performanceActive` boolean in `PerformanceModeContext` is the single source of truth. While `true`: no toasts, no banners, no auth-failure redirects, no SW activation, reads from cache only." This story's overlay makes zero network calls (it is an empty shell) — there is nothing to 401. The epics.md AC for this story restates the AR-28 invariant defensively ("any performance-mode API call would normally 401... the 401 is held") because Story 6.4 is the story that actually introduces a data read (the library cache lookup) inside this same overlay. This story satisfies the AC by construction: as long as `performanceActive` stays `true` for the overlay's entire open/closed lifecycle (verified by Task 4's test asserting `setPerformanceActiveMock` is never called when the overlay opens/closes), the invariant holds trivially. Do not write a fake fetch-and-401 test for this story — there is no fetch to test yet.

### Wake-lock indicator does NOT propagate to the overlay

Per the mockup brief (`mockups/p1-performance.md` line 319): "If the wake lock is lost while the jump overlay is open, the `☽` glyph renders on the performance card underneath (out of sight) but NOT on the overlay's chrome." This is automatically satisfied by this story's design — `JumpOverlay` renders no wake-lock indicator at all (it isn't passed `wakeLockHeld` and doesn't call `useWakeLockIndicator()`); the indicator stays exactly where it already is, in the `PerformanceCard` header, which continues to exist underneath the overlay (unmounted from view but not from the DOM tree... actually it IS still in the DOM, just visually covered by the `fixed inset-0` overlay — no `display:none` is applied to the card, it is simply painted-over). No extra work needed; just don't accidentally add a wake-lock indicator to the overlay.

### Four-corners rule — where `≡ jump` may NOT go

DESIGN.md's "Don'ts" spatial-separation rule (referenced in the mockup brief line 308) is absolute: `×` top-left, position indicator top-right, `‹` bottom-left, `NEXT ›` bottom-right are the four corners and `≡ jump` must never occupy any of them. The locked A2 placement is squarely in the toolbar *interior* (between `‹` and `NEXT ›`), which is compliant by construction — just don't be tempted to right-bias or left-bias the new button in a way that visually crowds either bottom corner.

### Next-song preview span is removed in this story (Story 4.1 rollback)

The next-song preview `<span>` shipped by Story 4.1 (line ~335 as of `baseline_commit`, renders `nextSongRef?.titleSnapshot`) is **deleted** as part of this story. Rationale: the P1 mockup's `next: Wat…` compression trade-off (locked in `mockups/p1-performance.md`) was reviewed on 2026-08-17 and rejected — the preview took thumb space without earning it, and `NEXT ›` on its own communicates the next-tap advance. The shipped code, the epics.md AC-1, and the P1 mockup have all been updated in the same session; this story now removes the DOM span and its two associated tests. No `next: ` prefix is ever added; the preview simply ceases to exist. If a later story needs a next-song indicator it will be a new design, not a restoration of the deleted span.

### Overlay transition — real fade required (150ms opacity)

AC-3 requires a **real** 150ms opacity fade on mount/dismiss, not instant. The intent (per the P1 lock) is a smooth overlay appearance; an instant mount reads as a jarring cut on iPhone. Implementation approach:

1. `JumpOverlay` root renders with `transition-opacity duration-150 ease-out` at all times.
2. On first mount, the root starts at `opacity-0` and flips to `opacity-100` inside a `useEffect(() => { setMounted(true); }, [])` — this triggers a paint at 0, then a fade to 1 over 150ms.
3. Dismiss reverses this: when `onDismiss` is called, set `opacity-0` and delay the unmount by 150ms via `setTimeout` so the fade-out plays before React removes the DOM node. (An `isClosing` local state gate + a callback timer is the simplest shape; if the test-suite prefers not to wait 150ms, mock timers or use `act` in tests.)
4. `prefers-reduced-motion` is handled globally in `globals.css` — verify (grep for `prefers-reduced-motion` in that file) the rule targets `transition-*` utilities generically. If it targets only specific selectors, extend it in a small `globals.css` diff (still no new tokens).
5. Do NOT add Framer Motion or any new dependency for this. Plain Tailwind classes plus a `useEffect` are sufficient.

### Overlay full-screen vs. bottom-sheet — do not copy `AnnotationSheet`'s positioning

`AnnotationSheet` (in `setlist-song-row.tsx`) is a **bottom sheet** (`fixed inset-x-0 bottom-0`). The jump overlay per the mockup brief is a **full-screen overlay** ("Full-screen overlay on top of the performance card. Slides up from the bottom or fades in — motion spec deferred to implementation" — `mockups/p1-performance.md` line 192). Use `fixed inset-0` (not `inset-x-0 bottom-0`) for `JumpOverlay`'s root. Reuse `AnnotationSheet`'s `role="dialog" aria-modal="true"` accessibility pattern, not its positioning.

### Files touched

| File | Change |
|---|---|
| `web/src/lib/microcopy.ts` | UPDATE — append `jumpButton` and `ariaOpenJumpOverlay` to the existing `PERFORMANCE_CARD` export |
| `web/src/routes/performance-card.tsx` | UPDATE — delete the next-song preview `<span>` (and the now-unused `nextSongRef` binding if applicable); insert the new `≡ jump` button in the footer; add `isJumpOverlayOpen` local state; conditionally render `<JumpOverlay>`; update the footer's inline comment block |
| `web/src/routes/performance-card.test.tsx` | UPDATE — delete/rewrite the two existing `next-song preview` tests to assert preview absence; add a new `describe` block for the jump-overlay control + open/dismiss behaviour |
| `web/src/components/jump-overlay.tsx` | NEW — minimal shell component (dismiss control + empty content region + real 150ms fade) |
| `web/src/components/jump-overlay.test.tsx` | NEW — co-located tests for the shell |
| `web/src/styles/globals.css` | UPDATE (only if needed) — verify `prefers-reduced-motion` rule targets `transition-*` utilities generically; extend if it does not. No new tokens. |

No other files should need to change. In particular:
- No changes to `performance-context.tsx` (overlay state is local, not contextual — see Dev Notes above).
- No changes to `web/src/hooks/use-setlist.ts` / `use-song.ts` (no new data fetching in this story).
- No new API routes, no shared-package schema changes.
- No new CSS custom properties in `web/src/styles/tokens.css`.
- `web/src/components/section-heading.tsx` (Story 6.2's `SECTION_HEADING.songCount` helper) is NOT consumed by this story — Story 6.4 is the first consumer of that helper inside the jump overlay, once it adds the sectioned setlist rows.

### Architecture compliance

- File naming: `kebab-case` — `jump-overlay.tsx` / `jump-overlay.test.tsx` conform. [Source: architecture.md line 479 pattern]
- TypeScript `strict: true` — `JumpOverlay` props typed as `{ onDismiss: () => void }`; no `any`.
- No parallel Zod schema needed — this is UI-only, no new wire record shape. [Source: CLAUDE.md "Zod schemas in shared/ are the single source of truth"]
- State management: React Context only for cross-cutting Performance Mode state (already established — `performance-context.tsx`); local `useState` for single-component UI state, matching `architecture.md`'s "State management taxonomy" (React Context, not Redux/Zustand) and the existing `sheetOpen` precedent in `setlist-song-row.tsx`.
- Accessibility: `aria-label` on icon-only controls per architecture.md's Accessibility Implementation Primitives; `role="dialog"` + `aria-modal="true"` on the overlay, matching the existing `AnnotationSheet` precedent; focus management is NOT explicitly required by this story's AC (no focus-trap library called for), but tapping the overlay's dismiss returns to a Performance Card that was never unmounted, so no focus is lost by construction — no extra focus-restoration code needed.
- Testing: Vitest + React Testing Library, co-located `*.test.tsx`, `describe('<unit>', () => { it('<behavior> under <condition>') })` naming, **no snapshot tests**. [Source: architecture.md lines 768–777]
- Biome is the sole lint/format tool — run `pnpm lint` before considering the story done. [Source: CLAUDE.md]
- Microcopy: `PERFORMANCE_CARD` is explicitly a non-locked, append-only surface (alongside `SECTION_HEADING`) — append `jumpButton`/`ariaOpenJumpOverlay` there, do not create a new microcopy module. [Source: web/src/lib/microcopy.ts lines 1–14, 95–109]

### Previous story intelligence (6.2, immediately prior)

Story 6.2 (chrome polish) shipped immediately before this one (`baseline_commit` = 6.2's completion commit `fba00ff`) and establishes patterns this story follows:
- **Scope discipline, one commit at the end** — touch only the files in "Files touched," per CLAUDE.md's "Commit cadence."
- **Reuse existing invariant tokens rather than inventing new ones** — 6.2 reused `--text-perf-meta`/`--text-perf-body` instead of adding a new type-scale token; this story reuses the same tokens plus `--color-bg`/`--color-surface`/`--color-text-secondary` for the overlay, adding nothing new to `tokens.css`.
- **Extend file-header comments in place, don't replace** — if this story's changes to `performance-card.tsx`'s top-of-file comment/diagram are needed (e.g. to note the new toolbar control), extend the existing comment block (lines 15–67) rather than rewriting it.
- **Manual visual sign-off pattern available if needed** — Stories 6.1 and 6.2 both used a `MANUAL_REVIEW_RECOMMENDED` task marker for pixel-level comparison against approved mockup renders, logged in the Dev Agent Record rather than blocking `dev-story` completion. This story's shell is simple enough (dismiss control + empty region) that a full visual-parity task is likely unnecessary, but if code review judges the overlay's visual weight needs comparison against `iteration-2/state-5-a-i-overlay-setlist-match.png` framing (ignoring that render's search/list content, which is out of scope), follow the same non-blocking pattern.

Story 6.2 left `web/src/routes/performance-card.tsx`'s footer/toolbar region (lines ~318–361) untouched apart from the key/patch header block — this story is the first to modify the footer since Story 4.4 shipped the last-song inert-`NEXT ›` treatment.

### Git intelligence summary

Recent commits (`fba00ff` Story 6.2, `255c948` Story 6.1, `b8410cf` drafting all six Epic 6 stories) each touched exactly one story's scope and closed with a single `Implement story X.Y: <title>` commit. `fba00ff` is this repo's current HEAD — Story 6.2 is at `review` status (only its Task 3 manual visual sign-off remains open, non-blocking). This does not block starting 6.3: 6.3 touches `performance-card.tsx`'s footer/toolbar region, which 6.2 did not touch (6.2 touched the header key/patch block and `section-heading.tsx`); the two stories' diffs are disjoint.

### Project Structure Notes

- No conflicts detected with `web/src/routes/`, `web/src/components/`, or `web/src/lib/` (kebab-case, co-located tests).
- `web/src/components/jump-overlay.tsx` is a new file in the existing flat `components/` directory (no subfolders used elsewhere in this package — e.g. `chord-chart.tsx`, `setlist-song-row.tsx` sit at the same level) — follow that convention, do not create a `components/jump-overlay/` subfolder.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.3] (lines 1934–1969) — canonical AC statements this story implements
- [Source: _bmad-output/planning-artifacts/epics.md] line 160 — AR-28 (`performanceActive` invariants: no toasts/banners/auth-redirects while active, reads from cache only, Wake Lock held)
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] line 21 — locked A2 jump-affordance placement + `≡ jump` label + preview-compression trade-off
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] lines 114–117 — A2 bottom-toolbar description; "avoid hamburger connotations" framing rule
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] lines 119–130, 190–208 — jump-overlay behaviour (state preserved, full-screen, wake-lock indicator does not propagate), 5-a shape detail (Story 6.4 scope, referenced for context only)
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] line 308 — four-corners spatial-separation rule (`×`/position/`‹`/`NEXT ›`, `≡ jump` must not occupy a corner)
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] line 311 — "Jump overlay preserves state" — the core invariant this story must not violate
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] line 319 — wake-lock indicator does not propagate to the overlay
- [Source: architecture.md] lines 809–826 — Accessibility Implementation Primitives (aria-label conventions, prefers-reduced-motion global CSS rule already in place)
- [Source: architecture.md] lines 768–778 — Testing patterns: Vitest + RTL, no snapshots, co-located tests
- [Source: web/src/routes/performance-card.tsx] — current implementation (read in full during this story's creation); footer/toolbar region at lines 315–361 as of `baseline_commit`
- [Source: web/src/routes/performance-card.test.tsx] — existing test scaffolding/mocks (hoisted mocks for `useSetlist`, `useSong`, `navigate`, `usePerformanceActive`, `setPerformanceActive`, `setActiveSongIndex`, `setPerformanceView`) to reuse for this story's new tests
- [Source: web/src/performance/performance-context.tsx] — confirms the four pieces of cross-cutting state; overlay-open state deliberately excluded (component-local instead)
- [Source: web/src/components/setlist-song-row.tsx] lines 319–389 — `AnnotationSheet` precedent for `role="dialog"`/`aria-modal="true"` pattern (positioning differs — bottom sheet vs. this story's full-screen overlay)
- [Source: web/src/lib/microcopy.ts] lines 1–14, 95–125 — existing microcopy conventions; `PERFORMANCE_CARD` and `SECTION_HEADING` as non-locked, append-only surfaces
- [Source: _bmad-output/implementation-artifacts/6-2-chrome-polish-key-patch-single-row-section-count-format.md] — previous story's Dev Notes patterns this story follows (reuse-existing-tokens discipline, extend-not-replace comments, non-blocking manual sign-off pattern)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
