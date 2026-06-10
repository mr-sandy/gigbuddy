---
baseline_commit: 97f9b35e12b6c84d81c0958e59b0ec5db6103c4a
---

# Story 1.2: Design system foundation — tokens, typography, atmospheres

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want the visual identity from DESIGN.md baked into the running app via Tailwind v4 tokens and a two-atmosphere theme system,
so that every subsequent feature inherits the locked visual direction without re-implementing tokens or theme switching.

## Acceptance Criteria

**AC-1 — tokens.css carries both atmospheres' tokens; no hard-coded values elsewhere**

**Given** `web/src/styles/tokens.css`
**When** reviewed
**Then** two Tailwind v4 `@theme` blocks define both atmospheres' tokens: colors (`accent`, `attention-fuzzy`, `attention-unknown`, `surface`, `bg`, `text-secondary`, plus the rest of DESIGN.md Color tables for Performance "Club Warm" and Practice "warm paper cream"), the type scale from DESIGN.md §Scale (including `perf-title` ≥36pt, `key/patch` 22pt, `body` 18pt for Performance; `home-tonight`, `section-heading`, body 17–18pt for Practice), spacing on a 4pt base unit, elevation rules (max 4pt shadow), and corner radii including `rounded-chord-glyph`
**And** no token values are hard-coded in component files — every color/size/space references a token

**AC-2 — Contrast measurement is committed; AAA in Performance, AA in Practice**

**Given** the finalized tokens in `web/src/styles/tokens.css`
**When** Story 1.2 closes
**Then** every foreground/background token pair used together in Performance atmosphere is measured against WCAG AAA (≥7:1 contrast ratio) — pairs include text-primary/bg, text-primary/surface, text-secondary/bg, text-secondary/surface, accent/bg, bg/accent (for the CTA `accent` background with `bg` text)
**And** every foreground/background token pair used together in Practice atmosphere is measured against WCAG AA (≥4.5:1 contrast ratio) — same pair set plus attention-fuzzy/bg and attention-unknown/bg
**And** the measurements are committed to `web/test-output/contrast-report.json` (machine-readable, one entry per pair with token names, hex values, computed ratio, and AAA/AA pass flag)
**And** any pair failing its target ratio is either remediated (token value adjusted) or explicitly waived in the report with a justification (e.g., "decorative use only, not body text")
**And** the contrast report is regenerated and committed whenever `tokens.css` changes (enforced by a CI step or a documented developer-workflow note — pick at implementation)

**AC-3 — MacBook viewport defaults to Practice atmosphere via CSS variable scope**

**Given** the running web app on a MacBook viewport
**When** the document loads
**Then** `<html data-atmosphere="practice">` is set and the Practice palette is applied via CSS variable scope
**And** no JS theme provider is involved (CSS variable scope only, per AR / UX-DR3)

**AC-4 — iPhone viewport defaults to Performance atmosphere**

**Given** the running web app on an iPhone viewport
**When** the document loads outside Performance Mode
**Then** `<html data-atmosphere="performance">` is set and the Performance palette is applied
**And** inside Performance Mode (Epic 4) the atmosphere remains `performance`

**AC-5 — Editorial serif + mono/slab faces self-hosted, subsetted, swap-loaded**

**Given** Story 1.2 execution
**When** the developer shortlists 2–3 open-source candidates each for `serif-editorial` and `mono-slab` (per DESIGN.md guidance)
**Then** Sandy is asked to pick one of each before the story closes
**And** the chosen faces are self-hosted in `web/public/fonts/` as WOFF2 with required-glyph subsetting (no external font CDN)
**And** fallback stacks are defined in tokens.css
**And** font files load with `font-display: swap`

**AC-6 — prefers-reduced-motion zeroes transitions/animations app-wide**

**Given** the user's OS has `prefers-reduced-motion: reduce` enabled
**When** the app renders
**Then** a global CSS rule in `web/src/styles/globals.css` zeroes all `transition-duration` and `animation-duration` values

**AC-7 — Tap-target tokens enforce 44pt minimum**

**Given** any tappable component
**When** rendered
**Then** it satisfies `min-w-tap min-h-tap` (44pt minimum) via Tailwind utility tokens defined in tokens.css (`--size-tap: 44pt`)

**AC-8 — Microcopy audit clean; empty-state constants centralized**

**Given** an audit of microcopy across `web/src/`
**When** all string literals are scanned
**Then** no exclamation marks, no emoji, no marketing voice, no encouragement copy is present
**And** the empty-state constants `No songs in this library yet.` and `No upcoming gigs.` are defined in a single microcopy module for reuse by Stories 1.5, 2.x, 3.x

## Tasks / Subtasks

- [x] **Task 1 — tokens.css with both `@theme` blocks** (AC: 1, 2, 7)
  - [x] Create `web/src/styles/tokens.css` (replaces today's Tailwind-only `globals.css` directive — see Task 4 for how the two files relate)
  - [x] Author **two `@theme` blocks**, scoped via `[data-atmosphere="practice"]` and `[data-atmosphere="performance"]`. Tailwind v4's `@theme` directive supports scoping to a selector via `@theme inline` patterns — use the canonical v4 idiom for selector-scoped tokens (verify against current Tailwind v4 docs at implementation; the architecture commits to `@theme tokens` at line 102/733). If selector-scoped `@theme` is not yet stable in the installed Tailwind v4 minor, the dev MUST flag this and use plain CSS custom properties on the same selectors with a `@theme` block carrying only invariants (radii, spacing) — see Dev Notes "Tailwind v4 atmosphere scoping" below.
  - [x] Token names must match DESIGN.md exactly (no renames). The canonical color names per atmosphere:
    - Performance: `bg`, `surface`, `text-primary`, `text-secondary`, `accent`, `accent-strong`
    - Practice: `bg`, `surface`, `text-primary`, `text-secondary`, `accent`, `accent-strong`, `attention-fuzzy`, `attention-unknown`
  - [x] Hex values lifted from DESIGN.md frontmatter (canonical, locked 2026-06-08):
    - Performance: `bg #1a1209`, `surface #241910`, `text-primary #f1e6cf`, `text-secondary #c9b486`, `accent #e6b855`, `accent-strong #f0c668`
    - Practice: `bg #faf9f5`, `surface #ffffff`, `text-primary #1a1209`, `text-secondary #5a4a35`, `accent #b3892f`, `accent-strong #8e6a20`, `attention-fuzzy #c47a1c`, `attention-unknown #a8351a`
  - [x] **Type scale** — single set of tokens (used by either atmosphere; per-atmosphere defaults documented in DESIGN.md). Per the DESIGN.md convention "points; px equivalent for web", use **`px` units** with the numeric value equal to the pt value (1pt = 1px on iPhone 13 CSS pixels and on MacBook at default scaling). Tokens (Tailwind v4 `--text-*` naming):
    - `--text-perf-title: 36px` (1.1 line-height)
    - `--text-perf-chord: 32px` (1.4 line-height — generous for chord readability)
    - `--text-home-tonight: 28px` (1.15 line-height)
    - `--text-perf-meta: 22px` (1.2 line-height)
    - `--text-section-heading: 22px` (1.2 line-height; small-caps applied at component level, not token level)
    - `--text-perf-annotation: 20px` (1.3 line-height)
    - `--text-perf-body: 18px` (1.5 line-height — the iPhone body floor)
    - `--text-practice-body: 17px` (1.55 line-height — MacBook body floor)
    - Line-heights derived to keep visual rhythm at arm's length; adjust at first device test (see "Type scale calibration" in Dev Notes).
  - [x] **Spacing** on a 4pt (= 4px) base unit. Tokens (Tailwind v4 `--spacing-*` naming):
    - `--spacing-unit: 4px`
    - `--spacing-gutter: 16px`
    - `--spacing-card-pad: 20px`
    - `--spacing-card-stack-gap: 12px`
    - `--spacing-section-gap: 32px`
  - [x] **Radii** (Tailwind v4 `--radius-*` naming):
    - `--radius-card: 16px`
    - `--radius-button: 12px`
    - `--radius-input: 10px`
    - `--radius-chord-glyph: 8px`
  - [x] **Tap-target token** (AC-7): `--size-tap: 44px` (= 11 × 4pt base, per architecture.md "Accessibility implementation primitives"). Tailwind v4 will then make `min-w-tap` / `min-h-tap` / `w-tap` / `h-tap` utilities available via the `--size-*` namespace, or `min-w-[var(--size-tap)]` as the fallback. Both forms are acceptable; prefer the namespace utility if Tailwind v4 supports `--size-*` as a generated utility (verify at implementation).
  - [x] **Elevation rules** — encoded as a single token `--shadow-card: 0 1px 2px rgba(26,18,9,0.06)` (Practice) and a Practice-only hairline border token `--border-hairline: #e8e2d6`. Performance atmosphere uses NO shadow tokens (per DESIGN.md "Performance: cards on warm-dark have a slightly lighter surface — `surface` — rather than a shadow. Shadows in dim bar contexts look muddy"). Lift to `surface` is achieved via the color token; no separate elevation token needed for Performance.
  - [x] **Contrast report** — author `web/scripts/contrast-report.ts` (tsx-runnable). Script reads the token hex values from tokens.css (parse `@theme` blocks), enumerates the foreground/background pairs listed in AC-2, computes WCAG contrast via the standard luminance formula, and writes `web/test-output/contrast-report.json` with `{pair: "text-primary on bg", atmosphere: "performance", fg: "#f1e6cf", bg: "#1a1209", ratio: 12.87, target: "AAA", pass: true}` entries.
  - [x] Add `pnpm -F web report:contrast` script that runs the report. **Decision point for AC-2:** either (a) wire this into `web/package.json`'s `test` script so `pnpm test` regenerates the report on every run (CI-enforced freshness), or (b) document a developer-workflow note in `web/README.md` ("regenerate after editing tokens.css"). Pick (a) — automation beats discipline. The token values change so rarely that the per-test cost is negligible.
  - [x] Run the report; check every Performance pair hits AAA, every Practice pair hits AA. If a pair fails: first try adjusting the offending token (e.g., darken `accent-strong` for Practice if hover state misses AA). If adjustment would break DESIGN.md fidelity, add a `waived: true` + `reason: "..."` field to that entry and surface in story Dev Notes.
  - [x] **Hard rule for AC-1:** after tokens.css ships, no hex codes, no raw pt/px font sizes, no raw radius values are permitted in any component or page file. The placeholder route from Story 1.1 has none; this story creates none. Future stories enforce via code review (architecture line 471 — patterns are the contract).

- [x] **Task 2 — Atmosphere wiring (MacBook → practice, iPhone → performance)** (AC: 3, 4)
  - [x] **Decision: iPhone detection mechanism.** Two viable approaches:
    - (a) **Viewport-based** — `window.matchMedia('(max-width: 480px) and (pointer: coarse)')`. Robust to UA spoofing; no dependency on UA strings.
    - (b) **UA-based** — `/iPhone|iPod/.test(navigator.userAgent)`. Matches how Story 2.2 (PWA install gate) and Epic 4 detect iPhone for Wake Lock, install-detection, etc.
    - **Pick (b).** Reason: Story 2.2 and Epic 4 use UA detection for hard-binary "is this iPhone Safari" questions (Wake Lock prereqs, install gate). Keeping atmosphere detection in lockstep avoids the bug where atmosphere = performance but Story 2.2 thinks it's MacBook. Tablets and other phones are out of scope (NFR-26); the UA check is exhaustive for the V1 device set.
  - [x] Create `web/src/lib/platform.ts` exporting `isIPhone(): boolean`. Use a SSR-safe guard (`typeof navigator !== 'undefined'`) even though Vite is SPA-only — the test environment is jsdom and `navigator.userAgent` is a known fixed string there.
  - [x] **Note for Story 2.2 author:** Story 2.2's AC requires `isIPhone()` and `isStandalone()` in `web/src/lib/platform.ts`. This story creates the file with just `isIPhone()`. Story 2.2 will append `isStandalone()` — that is structurally clean.
  - [x] Atmosphere swap: in `web/src/main.tsx` (or a new `web/src/lib/atmosphere.ts` invoked from `main.tsx` before React renders), call once at boot:
    ```ts
    document.documentElement.dataset.atmosphere = isIPhone() ? 'performance' : 'practice';
    ```
  - [x] **DO NOT add** any Performance-Mode-time atmosphere flipping in this story. The atmosphere is always `performance` on iPhone (in or out of Performance Mode) per architecture.md "Theme atmosphere"; Epic 4 does not change `data-atmosphere`, it only sets `performanceActive=true` and hides chrome. No code path in Story 1.2 needs to react to `performanceActive`.
  - [x] `web/index.html`: keep `<html lang="en" data-atmosphere="practice">` as the static default. The atmosphere swap runs at JS boot and overrides for iPhone. This ensures any first-paint flash on MacBook is the correct palette; iPhone gets a brief practice flash before swap — acceptable because (a) iPhone first-paint is normally identical white-on-cream → warm-dark, but the inline `<style>` block in `index.html` keeps `bg-color: #1a1209` for iPhone UA via an inline `media`-style hack if FOUC is observable. **Default decision:** ship without the inline hack; if FOUC is visible on the device test, add an inline `<style>` block targeting `@media (max-width: 480px) and (pointer: coarse) { html { background: #1a1209; } }` purely to prevent flash. Document the decision in Dev Notes.
  - [x] Add a Vitest test `web/src/lib/platform.test.ts` covering: known iPhone UA strings (iPhone 13 Safari, iPhone 13 standalone) → `isIPhone() === true`; known MacBook UAs (Chrome on macOS, Safari on macOS, Firefox on macOS) → `isIPhone() === false`. Use jsdom's UA override pattern (`Object.defineProperty(navigator, 'userAgent', ...)` or vitest's `vi.stubGlobal`).
  - [x] Add a Vitest test `web/src/lib/atmosphere.test.ts` (or extend `platform.test.ts`) covering: when `isIPhone()` is true, the boot atmosphere setter writes `performance` to `documentElement.dataset.atmosphere`; when false, writes `practice`.

- [x] **Task 3 — Font shortlist, Sandy selection, self-host, subset** (AC: 5)
  - [x] **Shortlist phase (developer):**
    - For `serif-editorial`: shortlist 2–3 open-source transitional / editorial serifs that pair well with the locked DESIGN.md mood (warm, generous, editorial). DESIGN.md frontmatter names `'Source Serif Pro', 'Lora', Georgia` as the approximate stack — these are reasonable starting candidates. Add at least one alternative the developer considers stronger (e.g., Crimson Pro, Spectral, EB Garamond). For each candidate, capture: font family name, OFL/SIL licence, weights to ship (regular + a heavier weight for titles; italic if used in component patterns — per-gig annotation is italic per DESIGN.md), file size estimate per weight at WOFF2 subset.
    - For `mono-slab`: shortlist 2–3 open-source mono / slab faces that read well at chord-chart sizes. DESIGN.md names `'JetBrains Mono', 'IBM Plex Mono'` as the approximate stack. Add at least one alternative. For each: family name, licence, weights (regular + a heavier weight if chord glyphs benefit from medium/semibold), file size estimate.
  - [x] **Selection phase (Sandy):** Present the shortlists to Sandy via plain text — face name + licence + size + one-line character of the face (e.g., "transitional, generous x-height, warm — works well at 36pt"). Per [[feedback_dont_impose_design_taste]], do NOT bake mockups or mood-boards. List the facts; let Sandy pick. Pause for selection before continuing. If Sandy is unavailable at run time, document the candidates in Dev Notes and mark this AC as blocked pending selection.
  - [x] **Self-host:** download the selected WOFF2 files for each weight from the foundry's canonical source (e.g., Google Fonts open-source download, JetBrains GitHub, IBM Plex GitHub). Place under `web/public/fonts/<family-slug>/<file>.woff2`. Commit the WOFF2 binaries.
  - [x] **Subset:** subset each font to the glyphs the app needs. Minimum glyph set: Basic Latin (U+0020-007E), Latin-1 Supplement (U+00A0-00FF) for typographic punctuation (`›`, `‹`, `×`), General Punctuation (U+2000-206F) for the curly braces section markers and em-dashes. Use `glyphhanger` or `pyftsubset` (fonttools). Add a `pnpm -F web subset:fonts` script that re-runs the subset deterministically — Sandy may want to re-subset if microcopy adds glyphs.
  - [x] **CSS:** in `tokens.css` (or a sibling `fonts.css` imported from `globals.css`), declare `@font-face` rules with `font-display: swap`, `src: url('/fonts/<family-slug>/<file>.woff2') format('woff2')`, and per-weight entries. Define the family tokens:
    - `--font-serif-editorial: 'ChosenSerif', Georgia, serif;`
    - `--font-mono-slab: 'ChosenMono', ui-monospace, monospace;`
    - Apply `font-family: var(--font-serif-editorial);` to `html, body` as the global default.
  - [x] **Verify:** load `pnpm dev:web` on MacBook; visit `/`; open DevTools → Network → Fonts; confirm the WOFF2 files load from `/fonts/...` (not from a CDN); confirm `font-display: swap` is in the `@font-face` rule; confirm the placeholder `<h1>GigBuddy</h1>` renders in the chosen serif. Document the network confirmation in Dev Notes.
  - [x] **CAA / security alignment:** the architecture's CAA DNS record (AR-36) restricts cert issuance to `amazon.com` — that's about TLS cert authority, not third-party font loading. The self-host rule is still correct (privacy, offline-tolerance, no third-party dependency that could fail at 9pm) — capture this rationale in Dev Notes so a future dev doesn't "optimize" by re-introducing Google Fonts.

- [x] **Task 4 — globals.css updates and import wiring** (AC: 6, 7)
  - [x] Today's `web/src/styles/globals.css` contains a single `@import "tailwindcss";` line. Extend it to:
    - `@import "tailwindcss";`
    - `@import "./tokens.css";` (the new file from Task 1)
    - `@import "./fonts.css";` if Task 3 splits fonts into a sibling file; otherwise font face declarations live in tokens.css.
  - [x] Add the global `prefers-reduced-motion` rule (AC-6) in `globals.css`. The exact CSS comes from architecture.md "Accessibility implementation primitives":
    ```css
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        transition-duration: 0ms !important;
        animation-duration: 0ms !important;
      }
    }
    ```
  - [x] **Confirm tap-target utility resolves.** The token `--size-tap: 44pt` (Task 1) should generate Tailwind v4 utilities. Verify by writing a temporary component using `<button className="min-w-tap min-h-tap">test</button>` and inspecting the computed style in DevTools — confirm `min-width: 44pt` and `min-height: 44pt` apply. Remove the temp component before commit. If `min-w-tap` does not resolve, fall back to `min-w-[var(--size-tap)]` in component code (acceptable; the architecture pattern allows either form per "Accessibility implementation primitives" comment "Components use `min-w-tap min-h-tap` on every tappable element").
  - [x] Optional but recommended: in `globals.css`, set the body background and base text color from token variables so first paint matches the atmosphere:
    ```css
    html { background-color: var(--color-bg); color: var(--color-text-primary); font-family: var(--font-serif-editorial); }
    ```
    This means the placeholder route from Story 1.1 will now render `GigBuddy` in serif on cream (MacBook) or warm-cream on warm-dark (iPhone). That is the expected visible deliverable of this story — an Epic 1 reviewer sees the atmospheres land.

- [x] **Task 5 — Microcopy module + Voice & Tone audit** (AC: 8)
  - [x] Create `web/src/lib/microcopy.ts` exporting empty-state and other reusable string constants:
    ```ts
    export const EMPTY_STATES = {
      noUpcomingGigs: 'No upcoming gigs.',
      noSongsInLibrary: 'No songs in this library yet.',
    } as const;
    ```
  - [x] Both strings are verbatim from EXPERIENCE.md §Voice and Tone and §State Patterns (locked). Do NOT paraphrase. Do NOT add encouragement. Do NOT add CTAs into the constants.
  - [x] Story 1.5 will import these constants for the empty Setlists home and empty Library renders. This story does NOT consume them — it only defines them.
  - [x] **Audit pass on `web/src/`:** run a manual or scripted scan for forbidden microcopy. The audit is a check that the placeholder route from Story 1.1 (and any new strings from Tasks 1–4) carries no exclamation marks, no emoji, no marketing voice, no encouragement copy. Two scripted checks (run as part of the story's verification):
    - `grep -RnE '!|🎸|🎵|✨|🚀|❤️' web/src/ --include="*.ts" --include="*.tsx"` → expect zero matches (the `!` regex catches exclamation marks in string literals; if matches are inside non-string operators like `!=`, `!variable`, manually inspect — the audit is a tool-assisted human review, not a hard automated check).
    - `grep -RnE "[Aa]wesome|[Gg]reat|[Cc]ongrat|[Ll]et's|[Yy]ou'?re |[Yy]ay" web/src/ --include="*.ts" --include="*.tsx"` → expect zero matches.
  - [x] Document the audit result in Dev Notes (zero hits expected; if hits, list and remediate or justify in a Dev Note).

- [x] **Task 6 — Verification pass** (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] `pnpm typecheck` green across all packages
  - [x] `pnpm lint` green
  - [x] `pnpm test` green — Vitest covers `platform.test.ts`, `atmosphere.test.ts` (Task 2), any existing tests still pass
  - [x] `pnpm -F web report:contrast` runs cleanly; `web/test-output/contrast-report.json` exists and shows all pairs passing (or explicitly waived)
  - [x] `pnpm dev:web` on MacBook → `http://localhost:5273` shows the placeholder rendered in the chosen serif on cream (`#faf9f5`). DevTools: `<html data-atmosphere="practice">`; computed style on body shows `--color-bg` resolving to the practice cream.
  - [x] Open the same URL with iPhone Safari UA spoofing (Chrome DevTools → Device Toolbar → iPhone 13) and reload. DevTools: `<html data-atmosphere="performance">`; computed style on body shows `--color-bg` resolving to `#1a1209`.
  - [x] DevTools → Network → Fonts: confirm the WOFF2 files load from `/fonts/...` (self-hosted), not from `fonts.googleapis.com` or any other CDN.
  - [x] In macOS System Preferences → Accessibility → Display, enable "Reduce motion". Reload the app. Verify in DevTools that the `prefers-reduced-motion` media query matches and that any element with a CSS `transition` has its computed `transition-duration` zero. (No app element currently has a transition — this is a forward-looking confirmation. A temporary `<div style={{ transition: 'opacity 1s' }}>` can be used to verify and then removed.)
  - [x] Voice & Tone grep audit (Task 5) returns zero hits.

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md` — patterns are the contract; deviations require updating that document, not the implementation (line 471). DESIGN.md frontmatter carries the locked hex values; EXPERIENCE.md §Voice and Tone carries the locked microcopy.

**Theme atmosphere** (architecture.md "Theme atmosphere", lines 732–738):
- Tailwind v4 `@theme` block per atmosphere in `web/src/styles/tokens.css`
- Selector: `<html data-atmosphere="practice">` or `<html data-atmosphere="performance">`
- Default on MacBook: `practice`. Default on iPhone outside Performance Mode: `performance`. Inside Performance Mode (Epic 4): `performance` (unchanged).
- **No user toggle** (per PRD §5)
- Both atmospheres ship in every bundle; switched via CSS variable scope, no JS theme provider

**Accessibility implementation primitives** (architecture.md lines 815–832):
- `prefers-reduced-motion` global rule in `globals.css` (AC-6)
- Tap-target token `--size-tap: 44pt` in tokens.css; components use `min-w-tap min-h-tap` (AC-7)
- Focus-management and `aria-*` patterns are NOT in scope for this story — Story 1.5 (nav chrome) and Epic 4 (Performance Mode) own those. This story creates the static foundation.

**Voice and Tone** (EXPERIENCE.md lines 69–84, verbatim):
- Short, complete sentences. No exclamation marks. No emoji. No marketing voice.
- `No upcoming gigs.` and `No songs in this library yet.` are LOCKED strings (frontmatter and §State Patterns).

**Visual direction status:** locked 2026-06-08 (see [[project_visual_direction_locked]]). The Claude Design output (boards 1 + 2, interactive prototype) is the visual reference; the features and flows in those artifacts are NOT spec. This story implements the visual system only.

### Library and framework requirements (do NOT substitute)

- **Tailwind v4** via `@tailwindcss/vite` plugin and `@import "tailwindcss"` directive — already wired by Story 1.1. **Do NOT introduce PostCSS, `tailwind.config.ts`, or the v3 `@tailwind base/components/utilities` model.** Tailwind v4 uses `@theme` blocks in CSS for token definition; that is the V1 idiom (architecture line 102, 733; Story 1.1 deviation #5 confirms Biome 2.x has been validated).
- **No JS theme provider.** No `<ThemeProvider>`, no `useTheme()` hook, no context for atmosphere switching. CSS variable scope is the entire mechanism (architecture line 738, "no JS theme provider"). The boot-time `data-atmosphere` set in Task 2 is a one-shot DOM write, not a reactive state.
- **No animations longer than 150ms in Performance Mode** (DESIGN.md Don'ts, NFR-27). This story creates no animations at all — it's foundational tokens — but the `prefers-reduced-motion` rule (AC-6) makes future animations conformant by default.
- **No CSS-in-JS** (architecture line 145, AR-46). All styling via Tailwind v4 utilities + token-referenced CSS custom properties.
- **No icon library yet.** This story doesn't render icons. Story 1.5 will pick an icon approach (architecture doesn't pin one; per architecture.md line 145 — no form library, no icon library implied unless added explicitly). The `×`, `‹`, `›` symbols in EXPERIENCE.md are Unicode characters that the chosen serif/mono fonts must cover (subset glyph set, Task 3).

### Tailwind v4 atmosphere scoping (important)

Tailwind v4's `@theme` directive defines design tokens. Out-of-the-box, `@theme` is a single global block — it sets `--color-*`, `--text-*`, `--spacing-*` custom properties in `:root`. To scope tokens per atmosphere selector, the canonical Tailwind v4 idioms are evolving. Two acceptable approaches:

**(a) Token-scoping via plain CSS custom properties under `[data-atmosphere=...]`.** Define invariants in `@theme` (radii, spacing, tap-target, type scale, font families). Define atmosphere-dependent colors as plain CSS custom properties under `[data-atmosphere="practice"]` and `[data-atmosphere="performance"]` blocks. Tailwind v4 utilities like `bg-[var(--color-bg)]` still work; arbitrary-value utilities reference the var directly.

**(b) Multiple `@theme` blocks with selector scoping.** If the Tailwind v4 minor installed supports `@theme` under a parent selector, use that. Verify by writing a smoke `<div className="bg-bg">` after the tokens are in place; if the utility resolves to the atmosphere-scoped value, this approach works.

**Pick approach (a) by default.** Reason: it works with any Tailwind v4 minor, doesn't depend on potentially-unstable selector-scoped `@theme` semantics, and the readability cost is low ("`bg-[var(--color-bg)]` vs `bg-bg`"). If the dev verifies (b) works cleanly in the installed Tailwind v4 (currently `^4.0.0` per `web/package.json`), prefer (b) for ergonomics — but document the verification in Dev Notes.

Either way, the AC-1 contract is satisfied: tokens.css carries both atmospheres' values, components consume via tokens, no hard-coded values.

### Type scale calibration

DESIGN.md frontmatter is point-based ("in points; px equivalent for web"). On iPhone 13 CSS pixels and on MacBook at default scaling, 1pt = 1px — so the `px` values in Task 1 match the pt intent. On a high-DPI MacBook at custom scaling (e.g., Retina with HiDPI scaling enabled), CSS pixels are still 1pt → 1px (browsers compensate for the device pixel ratio).

DESIGN.md note: "Refine type scale once a real device test confirms legibility at arm's length." This story locks the initial values from the design spec. A first device test post-Story 1.5 (when nav chrome is in place) may surface "the title needs +2pt at arm's length" — defer that adjustment to the device-test outcome, not this story. The scale is the floor; not the final answer.

[[user_visual_preferences]] — Sandy is 55 and favors generous type. The floors set here (17pt MacBook, 18pt iPhone, 36pt Performance title) honor that. Do not reduce them at implementation.

### Font selection — interaction protocol

AC-5 calls for Sandy to pick from a shortlist. Per [[feedback_dont_impose_design_taste]] and [[feedback_skip_persona_ceremony]]: present the shortlist as **facts** — name, licence, file size, one-line character. No mood boards, no curated mockups, no opinionated framing. Sandy will pick. If multiple sessions pass and selection isn't made, ship the shortlist documented in Dev Notes and mark AC-5 as blocked pending selection — do NOT proceed with a default pick on Sandy's behalf.

[[user_role]] reminder: Sandy is the developer and sole user. There's no "team taste" or "brand committee" to satisfy. The shortlist is for Sandy's eyes.

### Microcopy and Voice & Tone

EXPERIENCE.md §Voice and Tone (lines 69–84) is the contract. Two locked strings ship in this story (microcopy.ts):

- `No upcoming gigs.`
- `No songs in this library yet.`

Both are full sentences with terminal full stops. Both are factual — they describe the state without commentary. No additional empty-state copy is added in this story (Stories 2.x, 3.x will add more as their surfaces require — they will append constants to `microcopy.ts`).

[[feedback_brief_examples_are_not_schema]] reminder: the AC-8 grep patterns are exemplary, not exhaustive. The voice violation is the pattern, not the literal word list. A future scan should add anything Sandy flags ("`Awesome!`" → adds `Awesome` to the list).

### Previous story intelligence (1.1 learnings)

Story 1.1 (completed 2026-06-10) established the scaffold. Key facts that affect this story:

1. **Port choices.** Web dev runs on `5273`, not `5173` (Sandy's other projects hold the defaults). Use `http://localhost:5273` in any developer-workflow notes.
2. **Tailwind v4 already wired.** `web/src/styles/globals.css` carries `@import "tailwindcss";`. This story adds `@import "./tokens.css";` (and optionally `@import "./fonts.css";`).
3. **Biome 2.x.** Use the `!**/dist` ignore syntax (no trailing `/**`). Story 1.1 deviation #5 documents this. Any new CSS files (`tokens.css`, `fonts.css`) should be confirmed not-ignored by Biome's formatter — Biome formats CSS as of v2.0+.
4. **No project references / no composite mode** in tsconfig (Story 1.1 deviation #2). Don't reintroduce — cross-package types flow via the pnpm symlink + `shared/`'s `types` source entry.
5. **`pnpm test` filters out e2e.** Adding tests in this story just adds to the inner-loop Vitest runs; no e2e changes required.
6. **`<html lang="en" data-atmosphere="practice">`** is already set in `web/index.html`. Task 2 overrides for iPhone at boot. Don't remove the static default — it prevents FOUC on MacBook.
7. **Sandy generates a random password (≥20 chars)** for Story 1.4; not relevant here but mentioned in case the dev encounters the SSM bootstrap docs.

Files Story 1.1 created (verbatim from its File List):
- Root: `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml`, `tsconfig.base.json`, `biome.json`, `.nvmrc`, `.gitattributes`, `README.md`, `CLAUDE.md`, `.github/workflows/ci.yml`
- `shared/`: `package.json`, `tsconfig.json`, `src/index.ts`, `src/schemas/band.ts`, `src/schemas/band.test.ts`, `src/schemas/api.ts`
- `web/`: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/router.tsx`, `src/test-setup.ts`, `src/routes/placeholder.tsx`, `src/routes/placeholder.test.tsx`, `src/styles/globals.css`
- `api/`, `infra/`, `e2e/`: scaffolds, not touched by this story

This story creates: `web/src/styles/tokens.css`, `web/src/styles/fonts.css` (optional split), `web/src/lib/platform.ts`, `web/src/lib/platform.test.ts`, `web/src/lib/atmosphere.ts` (or inline in `main.tsx`), `web/src/lib/atmosphere.test.ts`, `web/src/lib/microcopy.ts`, `web/scripts/contrast-report.ts`, `web/test-output/contrast-report.json` (committed), `web/public/fonts/<family>/<file>.woff2` (committed binaries), `web/scripts/subset-fonts.ts` (optional).

This story modifies: `web/src/styles/globals.css` (add imports + reduced-motion rule), `web/src/main.tsx` (call atmosphere setter before render), `web/package.json` (add `report:contrast`, `subset:fonts` scripts), possibly `web/index.html` (only if FOUC observed on iPhone — see Task 2).

### Files this story does NOT create or modify

Same anti-scope-creep principle as Story 1.1.

These belong to **later stories** and must NOT be scaffolded here:
- `web/src/components/*` (named components from UX-DR4) — Stories 1.5, 2.x, 3.x, 4.x own these
- `web/src/performance/performance-context.tsx` and `web/src/hooks/use-chrome-visible.ts` — Story 1.5
- `web/src/lib/platform.ts` `isStandalone()` function — Story 2.2 (this story creates `isIPhone()` only)
- `web/src/components/bottom-tabs.tsx`, top nav — Story 1.5
- `web/src/auth/*` — Story 1.4
- Any service worker / PWA manifest changes — Story 2.1

If the implementation finds itself wanting to "just stub" any of the above, **don't**. The relevant story carries the ACs that will land it correctly.

### Cross-doc inconsistencies and clarifications

- **DESIGN.md frontmatter `components: []`** is empty but the body §Components table is the authoritative visual-spec reference for Story 1.5+ (the frontmatter is a known-incomplete cache; the markdown body is the spec). Not relevant here — this story creates no components.
- **DESIGN.md** specifies "Performance card — bottom toolbar: `NEXT ›` is right-biased, ~half-width, `accent` background, `bg` text." — that confirms `accent` background with `bg` foreground is a real WCAG pair that must hit AAA in Performance. AC-2's pair list includes `bg/accent` (note ordering — fg `bg`, bg `accent`) for this reason. Make sure the contrast report includes both directions where used: `accent` on `bg` (the CTA dot/marker) and `bg` on `accent` (the CTA button label).
- **Token name collision risk: `bg`.** The token name `bg` (background) is also a Tailwind v4 utility prefix (`bg-*`). When referencing the token in a Tailwind utility, use `bg-bg` (utility `bg-` + token name `bg`) — Tailwind v4 supports this. Verify at first use; if the utility doesn't resolve cleanly, fall back to `bg-[var(--color-bg)]` form. Either is permissible.
- **Architecture.md "Auth flow" mentions `/api/v1/me`** — relevant for Story 1.4, NOT this story. Just noting so the dev doesn't conflate references.

### Project Structure Notes

- **Alignment with architecture's "Project Structure & Boundaries"** (architecture.md lines 836–1015): **full**.
  - `web/src/styles/tokens.css` — explicitly named in the architecture tree at line 909
  - `web/src/styles/globals.css` — explicitly named at line 910
  - `web/src/lib/platform.ts` — explicitly named at line 914 with `isIPhone(), isStandalone()` as its purpose
  - `web/public/fonts/` — not in the directory tree explicitly but implied by AC-5 (no external font CDN) and standard Vite static-asset convention
- **Variances introduced:**
  - `web/src/lib/microcopy.ts` — not in the architecture tree (the tree shows `web/src/lib/{nanoid.ts, iso-date.ts, platform.ts}`). The architecture allows additional files within the existing folder structure; microcopy is a natural fit for `lib/`. Document as a Dev Note; not material.
  - `web/scripts/` — not in the architecture tree. Holds the `contrast-report.ts` and optional `subset-fonts.ts` build-time utilities. Convention is acceptable; `scripts/` is a standard sibling to `src/` in Vite projects. Document as a Dev Note.
  - `web/test-output/` — not in the architecture tree. Holds the committed `contrast-report.json`. The output file is a build artifact that's intentionally tracked in git (so reviewers can see contrast pass/fail without rebuilding). Add `web/test-output/` to Biome's ignore patterns (the JSON file is generated; don't lint-format it).

### Testing requirements

- **Unit:** Vitest + jsdom for `platform.test.ts` (UA spoofing) and `atmosphere.test.ts` (dataset mutation). Both co-located with their sources.
- **Tool-script:** `contrast-report.ts` is verified by running it and checking the output JSON. No unit test for the script itself — its correctness is verified by the report content (all pairs measured, all pass/waive flagged).
- **No snapshot tests** (architecture line 775).
- **No new e2e tests for this story.** The placeholder.spec.ts smoke from Story 1.1 still passes (it asserts the page contains `GigBuddy`; the serif rendering and atmosphere don't change that assertion). If the dev wants to add a confirmation, it would be: visit `/` on a MacBook UA and assert `<html data-atmosphere="practice">`; visit on iPhone UA emulation and assert `performance`. Optional — the Vitest tests already cover the logic; the e2e would be redundant.

### Dev environment reminders

- Web dev server: `pnpm dev:web` → `http://localhost:5273`
- DevTools device emulation for iPhone testing: Chrome DevTools → Device Toolbar → iPhone 13 (390 × 844, UA = iPhone Safari)
- After editing tokens.css, run `pnpm -F web report:contrast` to regenerate the contrast report. If wired into `test` per Task 1, just `pnpm -F web test` is enough.
- Font subset re-runs via `pnpm -F web subset:fonts` (Task 3, optional). The subset is deterministic; re-run when microcopy adds glyphs (rare).
- The architecture's "no analytics" rule (NFR-16, AR-46) is structural — no `gtag`, no Segment, no Mixpanel, no `requestIdleCallback`-based custom analytics. This story creates no analytics; documenting only so the dev doesn't reach for it.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Theme atmosphere] (lines 732–738) — atmosphere selector mechanism, no JS theme provider
- [Source: _bmad-output/planning-artifacts/architecture.md#Accessibility implementation primitives] (lines 815–832) — prefers-reduced-motion, tap-target token, color-never-alone
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming conventions] (lines 475–489) — kebab-case files, camelCase identifiers
- [Source: _bmad-output/planning-artifacts/architecture.md#Foundation Stack] (lines 91–146) — Tailwind v4 with `@theme` tokens, no CSS-in-JS, no analytics
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] (lines 836–1015) — directory tree, including `web/src/styles/tokens.css`, `web/src/styles/globals.css`, `web/src/lib/platform.ts`
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md] — entire file, but specifically: frontmatter (locked tokens), §Colors (palettes per atmosphere), §Typography (faces + scale), §Layout & Spacing (4pt base), §Shapes (radii), §Do's and Don'ts (no shadows > 4pt, no animations > 150ms in Performance)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md] (lines 69–84) — Voice and Tone (verbatim) and locked empty-state strings
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md] (lines 106–124) — State Patterns including the empty-state surface treatments Story 1.5 will use
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] (lines 376–426) — story statement + acceptance criteria
- [Source: _bmad-output/planning-artifacts/epics.md#UX Design Requirements UX-DR1, UX-DR2, UX-DR3, UX-DR6, UX-DR7] (lines 196–209) — implementation contract for tokens, fonts, atmospheres, accessibility primitives, microcopy
- [Source: _bmad-output/implementation-artifacts/1-1-repo-scaffold-and-toolchain.md] — previous story's scaffold, ports, Tailwind v4 wiring, deviations to honor

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- `pnpm typecheck` — clean across all 5 packages (`shared`, `infra`, `e2e`, `api`, `web`).
- `pnpm lint` — clean (Biome 2.x with `css.parser.tailwindDirectives: true` enabled to parse `@theme`).
- `pnpm test` — 13/13 unit tests pass (web: 11 — 7 platform + 3 atmosphere + 1 placeholder; api: 1; infra: 1; shared: 1). Contrast report regenerates as a pre-test step.
- `pnpm -F web report:contrast` — 11/14 pairs pass at their targets, 3 Practice pairs waived with WCAG-anchored reasons (see Completion Notes #4). Report written to `web/test-output/contrast-report.json` and committed.
- Playwright smoke (one-shot, not committed) confirmed boot behavior: Desktop Chrome → `data-atmosphere="practice"`, computed `background-color: rgb(250, 249, 245)` (= `#faf9f5`), Lora WOFF2 loads from `/fonts/lora/lora-400.woff2`; iPhone 13 emulation → `data-atmosphere="performance"`, computed `background-color: rgb(26, 18, 9)` (= `#1a1209`), same self-hosted Lora.

### Completion Notes List

1. **Tailwind v4 atmosphere scoping — picked approach (a) per Dev Notes.** `@theme` carries invariants (type scale, spacing, radii, tap-target, font families) plus the Practice palette as the default; `[data-atmosphere="practice"]` and `[data-atmosphere="performance"]` selectors restate / override color tokens via plain CSS custom properties. Confirmed against installed Tailwind 4.3.0 — works with no `@theme inline` selector wrangling. The architecture's AC-1 contract (tokens.css carries both atmospheres' tokens; components reference tokens, no hard-coded values) is satisfied.
2. **Tap-target utility verified.** `--spacing-tap: 44px` declared in `@theme`; temporary `<button className="min-w-tap min-h-tap">` in the placeholder route confirmed Tailwind v4 emits `.min-w-tap { min-width: var(--spacing-tap); }` and `.min-h-tap { min-height: var(--spacing-tap); }`, and that `--spacing-tap` lands in `:root` via the served CSS. Temporary button removed before commit.
3. **No FOUC hack added to `index.html`.** Default decision per Task 2 holds — the static `<html data-atmosphere="practice">` stays as the default; iPhone gets a brief practice-flash before the JS boot setter runs. Will revisit only if a device test surfaces a visible flash.
4. **Contrast report — 3 waivers documented.** Practice `accent on bg`, `bg on accent` (CTA), and `attention-fuzzy on bg` each fall short of strict AA normal-text (4.5:1) but satisfy the applicable WCAG 2.1 rule:
   - `accent (#b3892f) on bg (#faf9f5)` — 3.05:1. Waived: accent is a UI fill, not body-text color. §1.4.11 non-text UI ≥3:1 applies and passes. For text use of brand orange, components use `accent-strong (#8e6a20)` which hits 4.81:1.
   - `bg on accent (CTA)` — 3.05:1. Waived: CTA label text is ≥18pt in Practice, qualifying for §1.4.3 large-text exception (≥3:1).
   - `attention-fuzzy on bg` — 3.24:1. Waived: marker color paired with icon + `text-primary` label (architecture "color-never-alone"); §1.4.11 non-text UI applies.
   All three reasons are committed in `web/test-output/contrast-report.json`. Sandy can override any waiver by either tightening the hex value in `tokens.css` (which would require updating DESIGN.md, currently locked) or by tightening the component contracts further.
5. **`accent-strong` exists in both atmospheres** as a precaution — the Performance value `#f0c668` is brighter than `accent` and is intended for hover/pressed states once components arrive. Not contrast-checked in this story because no pair uses it yet; Story 1.5+ will exercise it.
6. **Font shortlist + selection.** Three serif candidates (Source Serif Pro, Lora, Crimson Pro) and three mono candidates (JetBrains Mono, IBM Plex Mono, Inconsolata) rendered side-by-side at app type sizes against both atmospheres in a standalone preview HTML (not committed) and shown to Sandy. **Selection: Lora (serif) + Inconsolata (mono).**
7. **Font self-host + subset pipeline.** Source variable TTFs (`Lora[wght].ttf`, `Lora-Italic[wght].ttf`, `Inconsolata[wdth,wght].ttf`) downloaded from `github.com/google/fonts` (OFL distribution) into `web/scripts/fonts-source/` (gitignored). Two-stage transform: `fonttools varLib.instancer` pins variable axes to the chosen weight, then `pyftsubset` subsets glyphs to Basic Latin + Latin-1 Supplement + General Punctuation and outputs WOFF2. Final per-weight sizes: Lora 400 19KB, Lora 700 19KB, Lora 400-italic 20KB, Inconsolata 400 11KB, Inconsolata 700 11KB. Pipeline lives in `web/scripts/subset-fonts.ts` and runs via `pnpm -F web subset:fonts`. Toolchain dependency: `pyftsubset` and `fonttools` from `brew install fonttools` (or `pip install fonttools[woff]`). Brew was installed during this story.
8. **CAA / self-host rationale recorded.** AR-36 restricts TLS issuance to amazon.com; the self-host font rule is orthogonal — driven by privacy + offline-tolerance (no third-party request that can fail at 9pm). Comment captured in `fonts.css`.
9. **Microcopy audit.** Both grep audits clean: `!|🎸|🎵|✨|🚀|❤️` returns only the boolean-not operator in `main.tsx` (not a string literal); marketing-voice grep returns zero hits. `EMPTY_STATES.noUpcomingGigs` and `noSongsInLibrary` are verbatim from EXPERIENCE.md.
10. **Project-structure variances acknowledged.** `web/src/lib/microcopy.ts`, `web/scripts/`, `web/test-output/` are introduced by this story and are not in the architecture's `Project Structure & Boundaries` tree; they are natural fits within the existing folders and do not break any boundary rule. The Dev Notes section "Project Structure Notes" predicted and approved these. `web/test-output/` is included in git but excluded from Biome's `files.includes` automatically (positive include list does not cover it).
11. **`biome.json` updated.** Added `css.parser.tailwindDirectives: true` so Biome parses `@theme`. Added `css.formatter.quoteStyle: "double"` so `@import "tailwindcss";` and selector strings format consistently. These are sole-tool changes within Biome 2.x's documented surface area; no parallel formatter/linter configuration created.
12. **`web/package.json` scripts.** Added `report:contrast` and `subset:fonts` per the story; wired `report:contrast` into `test` so a token edit cannot land without a fresh, passing-or-waived contrast report (Task 1 decision (a)).
13. **`.gitignore`.** Added `web/scripts/fonts-source/` so the cached variable-font TTFs do not commit; subsetted WOFF2 outputs at `web/public/fonts/` are intentionally committed.

### File List

**Created:**

- `web/src/styles/tokens.css`
- `web/src/styles/fonts.css`
- `web/src/lib/platform.ts`
- `web/src/lib/platform.test.ts`
- `web/src/lib/atmosphere.ts`
- `web/src/lib/atmosphere.test.ts`
- `web/src/lib/microcopy.ts`
- `web/scripts/contrast-report.ts`
- `web/scripts/subset-fonts.ts`
- `web/public/fonts/lora/lora-400.woff2`
- `web/public/fonts/lora/lora-700.woff2`
- `web/public/fonts/lora/lora-400-italic.woff2`
- `web/public/fonts/inconsolata/inconsolata-400.woff2`
- `web/public/fonts/inconsolata/inconsolata-700.woff2`
- `web/test-output/contrast-report.json`

**Modified:**

- `web/src/styles/globals.css` — added imports for `tokens.css` and `fonts.css`; added `prefers-reduced-motion` global rule; set html background, color, and font-family from tokens.
- `web/src/main.tsx` — call `applyBootAtmosphere()` before React renders.
- `web/package.json` — added `report:contrast` and `subset:fonts` scripts; added `tsx` devDependency; chained `report:contrast` into `test`.
- `biome.json` — enabled `css.parser.tailwindDirectives` for `@theme` parsing; set `css.formatter.quoteStyle: "double"`.
- `.gitignore` — excluded `web/scripts/fonts-source/` (variable-font source TTFs cached for re-subsetting).

### Review Findings

- [x] [Review][Patch] WCAG luminance threshold is 0.03928 but spec value is 0.04045 — ratios for mid-dark colours are fractionally low, contrast gate may pass pairs that should fail [web/scripts/contrast-report.ts:relativeLuminance]
- [x] [Review][Patch] parseTokens regex `[^}]*` stops on first `}` inside block — any future nested brace or `}` in a comment silently truncates the block and reports wrong token values without error [web/scripts/contrast-report.ts:parseTokens]
- [x] [Review][Patch] `generatedAt: new Date().toISOString()` written to committed contrast-report.json — every `pnpm test` produces a dirty working tree timestamp change [web/scripts/contrast-report.ts:main]
- [x] [Review][Patch] AA threshold hardcoded at 4.5 for all AA pairs but Practice CTA and attention-fuzzy waivers cite the WCAG 3:1 large-text/non-text-UI exception — no `AA-large` target type exists, so removing a `waived` flag from a legitimately 3:1 pair will falsely fail CI [web/scripts/contrast-report.ts:PAIRS+threshold]
- [x] [Review][Patch] Instance intermediate file named `${variant.filename}.ttf` where variant.filename already ends in `.woff2`, yielding `lora-400.woff2.ttf` — cosmetic but confusing; strip `.woff2` before appending `.ttf` [web/scripts/subset-fonts.ts:main loop]
- [x] [Review][Defer] downloadIfMissing leaves a partial file on interrupted download; subsequent re-run skips it via `existsSync`, passes corrupt TTF to fonttools [web/scripts/subset-fonts.ts:downloadIfMissing] — deferred, developer tooling only, font WOFF2s already committed
- [x] [Review][Defer] No `finally` cleanup for intermediate .ttf instance files when instance()/subset() throws — stale files accumulate in fonts-source/instances/ [web/scripts/subset-fonts.ts:main loop] — deferred, developer tooling only
- [x] [Review][Defer] hexToRgb silent NaN on non-hex strings — latent risk if a non-hex token is added to PAIRS or COLOR_TOKEN_NAMES in a future edit [web/scripts/contrast-report.ts:hexToRgb] — deferred, not triggered by current code

## Change Log

| Date       | Change                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------- |
| 2026-06-10 | Story 1.2 context engineered — tokens, typography, atmospheres, accessibility primitives, microcopy. |
| 2026-06-10 | Story 1.2 implemented — design tokens, atmosphere wiring, Lora + Inconsolata self-hosted, contrast report (11 pass / 3 waived), microcopy module, reduced-motion + tap-target primitives. Status → review. |
