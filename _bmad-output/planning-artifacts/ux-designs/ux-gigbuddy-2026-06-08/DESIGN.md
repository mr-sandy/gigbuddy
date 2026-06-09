---
name: GigBuddy
status: final
sources:
  - {planning_artifacts}/briefs/brief-gigbuddy-2026-05-31/brief.md
  - {planning_artifacts}/ux/visual-direction/README.md
  - {planning_artifacts}/ux/visual-direction/board-1-performance.png
  - {planning_artifacts}/ux/visual-direction/board-2-practice.png
  - {planning_artifacts}/ux/visual-direction/design-board.html
  - {planning_artifacts}/ux/visual-direction/interactive-prototype.html
colors:
  performance:
    background: "#1a1209"      # warm-dark — "Club Warm" base
    surface: "#241910"         # slightly raised card / row background
    text-primary: "#f1e6cf"    # warm cream
    text-secondary: "#c9b486"  # dimmed warm cream
    accent: "#e6b855"          # amber / gold
    accent-strong: "#f0c668"   # accent on hover or active state
    attention: "#e6b855"       # uses accent — TONIGHT badge, current-row highlight
  practice:
    background: "#faf9f5"      # warm paper cream
    surface: "#ffffff"         # cards / inputs (pure white on cream)
    text-primary: "#1a1209"    # dark warm ink
    text-secondary: "#5a4a35"  # softer ink
    accent: "#b3892f"          # deeper amber for use on light
    accent-strong: "#8e6a20"   # darker accent on hover
    attention-fuzzy: "#c47a1c" # paste-to-parse 'fuzzy' state — warm amber
    attention-unknown: "#a8351a" # paste-to-parse 'unknown' state — warm red on cream
typography:
  serif-editorial:
    stack: "'Source Serif Pro', 'Lora', Georgia, serif"
    use: "Titles, section headings, body prose"
    note: "Approximate stack — exact face TBD at implementation token-extraction"
  mono-slab:
    stack: "'JetBrains Mono', 'IBM Plex Mono', 'Iowan Old Style', ui-monospace, monospace"
    use: "Chord glyphs, key/patch metadata, position indicator"
    note: "Visual direction shows a slab-monospaced feel for chord rendering — exact face TBD"
  scale:
    base: 18              # body text floor (Sandy is 55)
    practice-body: 17     # MacBook body minimum
    perf-body: 18         # iPhone body minimum
    perf-title: 36        # song title in performance card
    perf-meta: 22         # key + patch metadata
    perf-chord: 32        # chord glyphs
    perf-annotation: 20   # per-gig annotation subline
    home-tonight: 28      # TONIGHT card title
    section-heading: 22   # set/section labels
rounded:
  card: 16
  button: 12
  input: 10
  chord-glyph: 8   # chord cards if rendered as glyphs per visual direction
spacing:
  unit: 4
  gutter: 16
  card-pad: 20
  section-gap: 32
  card-stack-gap: 12
components: []
updated: 2026-06-09
---

# GigBuddy — Design Spine

> Visual identity locked 2026-06-08 from Claude Design output. This file references the locked artifacts as the source of truth and captures approximate tokens. Precise token extraction is the work of the first implementation story.

## Brand & Style

GigBuddy carries **two atmospheres**, not one. They are not light/dark variants of the same UI — they are different rooms.

**Practice** is a warm paper-cream daylight room. Editorial. Dense. Generous. You sit here for an hour with a coffee. The interface holds still.

**Performance** is "Club Warm" — a low-amber dim-bar room. Engraved. Sacred. Glanceable. You look at it for 20 seconds and look away. The interface earns every pixel.

Both share an editorial-serif voice and a slab-monospaced relationship to chord glyphs. The accent — amber / gold — runs through both atmospheres at different brightnesses.

**Mood references (locked):** see `_bmad-output/planning-artifacts/ux/visual-direction/board-1-performance.png` and `board-2-practice.png`.

## Colors

Approximate values extracted from the locked design boards. Precise hex values will be lifted from the source artifacts during the first implementation story (likely as `tokens.css`).

### Performance ("Club Warm" — iPhone, dark, dim-bar)

| Token | Value | Use |
|---|---|---|
| `bg` | `#1a1209` | App background. Warm-dark, almost coffee. |
| `surface` | `#241910` | Slightly raised card / row backgrounds. |
| `text-primary` | `#f1e6cf` | Title, meta, chord glyphs, NEXT button label. |
| `text-secondary` | `#c9b486` | Position indicator, next-song preview, inactive labels. |
| `accent` | `#e6b855` | `TONIGHT` badge, `Start performance ›` CTA, primary action highlights, current-row marker. |
| `accent-strong` | `#f0c668` | Hover / active state of accent. |

WCAG AAA contrast (7:1+) required for every text/background pair. Refine values during implementation if needed.

### Practice (warm paper cream — MacBook, light, daylight)

| Token | Value | Use |
|---|---|---|
| `bg` | `#faf9f5` | App background. Warm paper cream. |
| `surface` | `#ffffff` | Card and input backgrounds. |
| `text-primary` | `#1a1209` | Body text, titles, primary content. |
| `text-secondary` | `#5a4a35` | Metadata, labels, secondary content. |
| `accent` | `#b3892f` | Buttons, links, primary actions — deeper amber for legibility on cream. |
| `accent-strong` | `#8e6a20` | Hover / active state of accent. |
| `attention-fuzzy` | `#c47a1c` | Paste-to-parse `? Did you mean …` rows. |
| `attention-unknown` | `#a8351a` | Paste-to-parse `+ Unknown` rows. |

WCAG AA contrast (4.5:1) minimum.

### Color is never the only signal

Paste-to-parse rows use `✓` / `?` / `+` glyphs alongside color. Per-gig annotations are distinguished by typography and position, not only by color.

## Typography

### Faces

| Role | Approximate face | Use |
|---|---|---|
| Editorial serif | `'Source Serif Pro', 'Lora', Georgia, serif` | Titles, section headings, body prose, gig metadata. |
| Mono / slab | `'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace` | Chord glyphs, key/patch metadata, position indicator (`n / total`), code-like content. |

The locked design boards show an editorial serif (transitional, generous x-height) paired with a slab-monospaced feel for chord glyphs. Exact face selection is an implementation choice during token extraction. Both faces must support generous size scaling without losing legibility — Sandy is 55, and the design floor is set for someone reading at arm's length.

### Scale (in points; px equivalent for web)

| Token | Value | Use |
|---|---|---|
| `perf-title` | 36 | Song title in performance card. |
| `perf-chord` | 32 | Chord glyphs / chord-line text. |
| `perf-meta` | 22 | Key, patch, gig meta in performance card. |
| `perf-annotation` | 20 | Per-gig annotation subline. |
| `perf-body` | 18 | Floor for any text visible at glance in performance mode. |
| `home-tonight` | 28 | TONIGHT card title (venue) on home. |
| `section-heading` | 22 | Setlist section labels (Set 1, etc.). |
| `practice-body` | 17–18 | MacBook body content floor. |

### Rules

- No size below 17pt on MacBook body content. No size below 18pt anywhere on iPhone.
- Title content (song titles, gig venue) uses editorial serif at generous size.
- Chord glyphs use mono / slab at large size with generous line-height.
- Italic used sparingly — section-break labels (`{for guitar solo}` → "for guitar solo" inline in a rule).
- All caps used sparingly — section labels (`SET 1`) may be small-caps; song titles render as authored (case carries no semantic meaning — see Experience spine).

## Layout & Spacing

### Base unit

4pt base unit. All spacing is a multiple of 4.

### Common spacings

| Token | Value | Use |
|---|---|---|
| `gutter` | 16pt | Horizontal padding on cards, list rows. |
| `card-pad` | 20pt | Internal padding on gig cards, song cards. |
| `card-stack-gap` | 12pt | Vertical gap between list rows. |
| `section-gap` | 32pt | Vertical gap between major page sections. |

### Page bounds

- **MacBook:** content max-width ~960pt centered. Plenty of margin on wide displays.
- **iPhone:** content edge-to-edge inside safe-area insets (47pt top, 34pt bottom). Horizontal gutter of 16pt.

### Layout vocabulary

- Single-column vertical stacks dominate.
- No multi-column dashboards.
- No hero-image or carousel layouts anywhere.
- Generous whitespace, especially in practice mode (the page should breathe).

## Elevation & Depth

Subtle. Both atmospheres are "flat" in feeling — practice is print-on-paper; performance is engraved-on-warm-dark. Shadows used minimally and warm-toned.

- **Practice:** cards on cream may have a 1px hairline border (`#e8e2d6`) or a very soft warm shadow. No drop shadows over 4px.
- **Performance:** cards on warm-dark have a slightly lighter surface (`surface` token, ~10% lifted) rather than a shadow. Shadows in dim bar contexts look muddy.

## Shapes

- **Cards:** 16pt radius (`rounded.card`).
- **Buttons:** 12pt radius (`rounded.button`).
- **Inputs:** 10pt radius (`rounded.input`).
- **Chord glyphs** (if rendered as engraved cards per the visual direction's aspiration): 8pt radius (`rounded.chord-glyph`), enough to feel like a coin or plaque but not pillowy.

## Components

Visual specs. Behavioral rules live in `EXPERIENCE.md.Component Patterns`.

| Component | Visual treatment |
|---|---|
| `Gig card` (Tonight / Next / row) | Card with warm surface fill. `TONIGHT` badge in `accent` at top-left when applicable. Venue in serif at `home-tonight` size; date + time in mono `text-secondary`. |
| `Setlist section heading` | Small-caps editorial serif at `section-heading` size, `text-secondary`. Section count badge (`4 / 4`) inline in mono. |
| `Song row (setlist)` | Title in serif body; canonical title rendered prominently. Per-gig annotation as italic serif subline in `accent` (subtle distinguishment from canonical notes). MacBook: drag-handle icon visible on row hover. |
| `Song row (library)` | Title only, in serif body. Quiet treatment. |
| `Performance card — title region` | Song title `perf-title`, serif. Below: key glyph (large mono) + patch (mono, smaller). All on `surface` slightly lifted from `bg`. |
| `Performance card — chord region` | Chord text in mono / slab at `perf-chord`. Visual direction aspires to chord-glyph cards (bordered, in `rounded.chord-glyph`) in a 2-column grid; V1 implementation floor is monospaced text run. Either honors the same field. |
| `Performance card — bottom toolbar` | Full-width bar in `surface`. `NEXT ›` is right-biased, ~half-width, `accent` background, `bg` text. `‹` back is small, left, low-emphasis. Next-song preview in mono `text-secondary`. |
| `Start performance ›` CTA | Bottom-fixed full-width bar (above iPhone tab bar). `accent` background; `bg` text. Tall (≥ 64pt) for clear thumb target. |
| `× exit` (performance) | Small (28pt icon target) top-left. Low emphasis — `text-secondary` color. Reach is intentional. |
| `Bottom tabs` | Two tabs (`Setlists` / `Library`). `text-secondary` inactive, `accent` active. ~50pt tall above home-indicator inset. |
| `Top nav` (MacBook) | Editorial serif `GigBuddy · The Jack Ruby 5` left, nav items right. Hairline divider below. Generous vertical padding. |
| `Inline edit field` | No visible border in display state. On focus: thin `accent` underline (practice) or `accent` glow (performance — though edit primarily happens in practice mode). |
| `Parse-row status` | `✓` matched: green dot, `text-secondary` row. `?` fuzzy: amber dot, `attention-fuzzy` row with inline accept/reject buttons. `+` unknown: red dot, `attention-unknown` row with inline `+ Add to library` button. Icon + color + label always together (never color alone). |
| `Currently performing` strip | Top-anchored strip on setlist overview, `accent` background, `bg` text. Compact (~48pt tall). `Resume ›` button right-aligned. |

## Do's and Don'ts

### Do

- Use editorial serif for everything that conveys identity (titles, gig metadata).
- Use mono / slab for everything that conveys information density (chords, keys, patches, position indicators).
- Pair `accent` with quiet surfaces — let it carry the weight.
- Honor sparse song states honestly. Empty chord area is the design.
- Render per-gig annotations distinctly but not loudly — italic accent serif is plenty.
- Default `light` on MacBook, `dark` on iPhone — these aren't toggleable in V1 chrome (a settings-level toggle can come later).

### Don't

- Use color alone to convey state. Always pair with glyph + label.
- Introduce shadows over 4pt in either atmosphere.
- Use exclamation marks, emoji, or marketing voice in any string anywhere.
- Render chord text in a sans-serif body face. Mono / slab is the visual relationship.
- Animate performance-mode transitions longer than 150ms. Match `prefers-reduced-motion` with instant transitions.
- Place destructive controls (`× exit`, `‹ back`, `NEXT ›`) in the same corner. Spatial separation is a safety primitive.
- Reflow performance card layout for sparse vs dense content. One layout, content fills or doesn't.

## Tokens deferred to implementation

The first implementation story will:
- Lift precise hex values from `board-1-performance.png` and `board-2-practice.png`.
- Pick final face selections for `serif-editorial` and `mono-slab` (likely from the open-source stacks above).
- Refine type scale once a real device test confirms legibility at arm's length.
- Produce a `tokens.css` (or equivalent) that the rest of implementation references.
