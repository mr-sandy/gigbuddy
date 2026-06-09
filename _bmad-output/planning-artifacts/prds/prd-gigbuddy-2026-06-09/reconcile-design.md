# Reconcile: DESIGN.md → PRD

Source: `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md`
Target: `_bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/prd.md`

The PRD intentionally points at DESIGN.md via §C rather than duplicating tokens, components, or visual specs. This pass asks whether DESIGN.md carries qualitative or constraint material that the PRD body needs to reflect to keep FRs honest.

Classification key:
- **PTR** — correctly left to DESIGN.md via §C pointer; no PRD action.
- **REFLECTED** — already echoed in PRD body.
- **GAP-(a)** — qualitative gap worth folding into PRD body.
- **GAP-(b)** — intentional pointer; correctly left in DESIGN.md.
- **GAP-(c)** — constraint that should be promoted to an FR or NFR.

---

## Section-by-section walk

### Brand & Style ("two atmospheres, not one")

- Claim: "Practice and Performance are not light/dark variants — they are different rooms." Practice = warm paper-cream daylight, editorial, dense, generous, "interface holds still." Performance = "Club Warm" dim-bar, engraved, sacred, glanceable, "earns every pixel." Both share editorial serif + slab-mono chord relationship.
  - PRD §1 Vision echoes "daylight-style library" and "dark, dim-bar-readable... nothing on screen that isn't earning its place." PRD §3 Glossary defines Practice Mode and Performance Mode by surface and posture (hours-long vs. 20-second glance).
  - **Status: REFLECTED.** The qualitative framing carries into Vision and Glossary in enough density that downstream artifacts will get the posture difference.

- Claim: "Default `light` on MacBook, `dark` on iPhone — these aren't toggleable in V1 chrome."
  - PRD §6.1 In Scope: "light/dark defaults per surface." PRD §5 Non-Goals does not explicitly call out "no theme toggle."
  - **Status: REFLECTED (light).** The no-toggle assertion is in DESIGN.md Do's; PRD captures the defaults but not the not-toggleable constraint. Borderline GAP-(b) — toggle absence is implied by the absence of a Settings surface (FR-33 resolution).

### Colors

- Claim: WCAG AAA (7:1+) required in Performance; WCAG AA (4.5:1) minimum in Practice.
  - PRD §A.5 Accessibility echoes both contrast floors.
  - **Status: REFLECTED.**

- Claim: "Color is never the only signal. Paste-to-parse rows use ✓/?/+ glyphs alongside color. Per-gig annotations are distinguished by typography and position, not only by color."
  - PRD FR-7 Consequences: "Color is never the sole signal: each row pairs glyph + label + color." PRD §A.5: "No information conveyed by color alone."
  - **Status: REFLECTED.**

### Typography

- Claim: "Both faces must support generous size scaling without losing legibility — Sandy is 55, design floor is set for arm's length."
  - PRD §A.5 echoes the numeric floor (18pt perf, 17–18 practice). The "Sandy is 55 / arm's length" rationale lives only in DESIGN.md.
  - **Status: PTR / GAP-(b).** Floor is reflected as constraint; rationale correctly stays in DESIGN.md.

- Claim: Italic used sparingly (section-break labels); all-caps sparingly (small-caps section labels); "song titles render as authored (case carries no semantic meaning)."
  - PRD FR-5 Field table: "Title... Case rendered as authored."
  - **Status: REFLECTED** (the case-as-authored rule).

### Layout & Spacing

- Claim: "Single-column vertical stacks dominate. No multi-column dashboards. No hero-image or carousel layouts anywhere. Generous whitespace, especially in practice mode (the page should breathe)."
  - PRD §B Platform: "Single-column vertical layout dominates. No multi-column dashboards." PRD FR-23 Consequences: "no horizontal scroll, no carousel."
  - **Status: REFLECTED.** Note: the "page should breathe" qualitative directive does not carry into PRD; it is correctly left in DESIGN.md as visual-density guidance — GAP-(b).

### Elevation & Depth

- Claim: "Both atmospheres are 'flat'... Shadows used minimally and warm-toned. No drop shadows over 4px."
  - PRD references this only via §C pointer. Reflected in DESIGN.md Don'ts.
  - **Status: PTR.** Implementation detail; correctly DESIGN.md-owned.

### Shapes / Components

- Claim: Component visual treatments (card radius 16, button 12, input 10, chord-glyph 8); component table for gig card, setlist heading, song row, performance card regions, CTA, exit, tabs, top nav, parse-row status, currently-performing strip.
  - PRD references behaviors of these components via FRs (e.g., FR-16 Performance Card three-region structure, FR-19 × top-left small/low-emphasis, FR-20 currently-performing strip with Resume).
  - **Status: REFLECTED behaviorally; visual treatment correctly PTR.**

### Do's and Don'ts — qualitative principles

This is where DESIGN.md carries the highest density of qualitative direction. Walking each:

1. "Use editorial serif for everything that conveys identity; mono/slab for density." — PTR; visual.
2. "Pair accent with quiet surfaces — let it carry the weight." — PTR; visual.
3. **"Honor sparse song states honestly. Empty chord area is the design."**
   - PRD FR-3 Consequences: "Empty fields render as absent (no `(not specified)` placeholders)." PRD FR-5 Consequences: "Performance Card renders sparse Songs without layout reflow." PRD FR-16: same.
   - **Status: REFLECTED.** This principle is one of the load-bearing ones and the PRD has captured it as a testable consequence.
4. "Render per-gig annotations distinctly but not loudly — italic accent serif is plenty." — PRD FR-11 Consequences: "The annotation is visually distinct from the canonical Song content (per DESIGN.md)." **Status: REFLECTED via pointer.**
5. "Default light on MacBook, dark on iPhone — not toggleable in V1 chrome." — see Brand & Style above; borderline GAP-(b).
6. **Don't: "Use exclamation marks, emoji, or marketing voice in any string anywhere."**
   - PRD §C: "No marketing voice. No exclamation marks, emoji, or encouragement." Also referenced via EXPERIENCE.md §Voice and Tone pointer.
   - **Status: REFLECTED.**
7. **Don't: "Animate performance-mode transitions longer than 150ms. Match prefers-reduced-motion with instant transitions."**
   - PRD FR-17 Consequences and §A.1 both state the 150ms cap and the prefers-reduced-motion collapse.
   - **Status: REFLECTED as NFR.**
8. **Don't: "Place destructive controls (× exit, ‹ back, NEXT ›) in the same corner. Spatial separation is a safety primitive."**
   - PRD FR-17 Consequences: "`‹` is positioned with spatial separation from `NEXT ›`." FR-19: "× is top-left." The DESIGN.md framing as "safety primitive" is not re-stated, but the spatial-separation rule is captured at FR level.
   - **Status: REFLECTED.**
9. **Don't: "Reflow performance card layout for sparse vs dense content. One layout, content fills or doesn't."**
   - PRD FR-16 Consequences: "Sparse content... renders without layout reflow." FR-5: same.
   - **Status: REFLECTED.**
10. "Don't render chord text in a sans-serif body face." — PTR; visual.
11. "Don't introduce shadows over 4pt." — PTR; visual.

### Tokens deferred to implementation

- Claim: "First implementation story will: lift precise hex from boards; pick final faces; refine type scale once a real device test confirms legibility at arm's length; produce tokens.css."
  - PRD does not call out the "real device legibility test" as an explicit acceptance step for the first implementation story.
  - **Status: GAP-(b).** This is implementation-story-level guidance owned by DESIGN.md and (downstream) Architecture/story planning. Not PRD-shaped.

---

## Summary of GAPs

After walking the source, the PRD body already reflects every load-bearing qualitative principle and every numeric constraint that downstream artifacts could need. The remaining items are either:

- **Borderline GAP-(b), correctly DESIGN.md-owned**: "page should breathe," "Sandy is 55 / arm's length" rationale, "real device legibility test" as first-story acceptance, theme not toggleable in V1 chrome.
- **No GAP-(a)** — no qualitative principle is being silently dropped by the FR shape.
- **No GAP-(c)** — DESIGN.md carries no latent constraint that needs to be promoted to an FR or NFR. The 150ms motion cap, contrast floors, type floors, color-alone prohibition, spatial-separation safety rule, sparse-state honesty, and no-reflow rule are all already in the PRD as FR consequences or NFRs.

### Minor candidates worth a one-line PRD touch (optional, not required)

1. **Theme not toggleable in V1 chrome.** Currently only implied by "no Settings surface" + "light/dark defaults per surface." If downstream interprets "defaults" as "user-overridable defaults," there is a risk. Could add a single bullet under §5 Non-Goals: "Theme toggle — surface-tied defaults are not user-overridable in V1." Classification: weak GAP-(a) / GAP-(c) borderline.

2. **First-story acceptance: real device legibility test.** DESIGN.md commits the first implementation story to a real-device legibility check before locking the type scale. This is downstream-of-PRD work, but if Sandy wants the PRD to forward-reference it, a one-line note in §A.1 or §A.5 could anchor it. Classification: GAP-(b), low priority.

Neither item is structural. Neither warrants a draft revision.

