# GigBuddy style guide

The source of truth for how GigBuddy looks. Tokens in `web/src/styles/tokens.css` are named by role (`--text-page-title`, `--text-row`, `--text-reading`, `--text-body`). Page titles are 28px, set by Sandy on 2026-10-19.

## Principles

- Generous type everywhere. Fit less content rather than shrink it.
- One responsive app, 360px to 1680px, no horizontal scroll. No device detection.
- Light for daytime prep, dark for dim gigs, via `prefers-color-scheme` only.
- Every page uses the roles below; page titles come from the `PageTitle` component. No one-off sizes in a route file.

## Type roles

| Role | Size | Font | Used for |
|---|---|---|---|
| Page title (`--text-page-title`) | 28px | Lora (serif) | The one `<h1>` on each page |
| Row (`--text-row`) | 22px | system | Tappable rows (song titles), text links |
| Reading (`--text-reading`) | 22px | system | Song content: key/patch line, chord chart |
| Body (`--text-body`) | 18px | system | Status lines, plain text |

Rules:
- Exactly one Page title per page, always an `<h1>`, always the same size.
- Page title colour is primary text; body status lines use secondary text.
- Links are underlined primary text, not accent colour. The light accent only passes AA for
  large text.

## Colour

- Background `#faf9f5` / dark `#1a1209`.
- Text primary `#1a1209` / `#f1e6cf`; secondary `#5a4a35` / `#c9b486`.
- Accent `#b3892f` / `#e6b855`: focus outlines only (for now).
- Hairline `#e8e2d6`, transparent in dark mode (rows rely on padding there).
- All text pairs must meet WCAG AA.

## Spacing and tap targets

- Base unit 4px. Page gutter 16px. Gap between sections 32px.
- Anything tappable is at least 44px high.
- List rows: 12px vertical padding, 1px hairline underneath.
- Back link at the top of a page, then the page title 4px below it.
- A group label inside a list (e.g. "Past") is Body, secondary text, with the 32px section
  gap above it.
- Bottom bar (gig song page): fixed to the bottom, page background, 1px top border in secondary
  text colour. Links at Row size, at least 44px; the position ("3 of 12") at Body size, secondary.
  An unavailable action shows as secondary text, not a link. Content is padded so nothing hides
  under the bar.
- "Screen may sleep" line on song pages: Body size, secondary text, under the back link; shown
  only when the screen can't be kept awake. No token changes.

## Forms

- Labels are Body (18px), primary text, above their field.
- Inputs and the chord-chart box use Reading (22px), primary text on the page background, a 1px
  border in secondary text colour, 4px radius, `--spacing-unit*3` padding, full width. Never use
  the hairline token for field borders (it is transparent in dark mode).
- The Save button is a bordered button: 2px primary-text border, primary text, Row size, at
  least 44px high. Cancel is an ordinary underlined link.

## Focus

- Visible keyboard focus on every link, input and button: 2px outline in the accent colour.

## Copy

- British English. Short complete sentences, no exclamation marks, no emoji.
- Strings live in `web/src/lib/microcopy.ts`.
