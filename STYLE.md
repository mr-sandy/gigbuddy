# GigBuddy style guide

DRAFT for Sandy to edit. It describes what the app does today, with open decisions marked
**DECIDE** (none left at the moment). Page titles are 28px (decided by Sandy, 2026-10-19), so the song page title (36px today) needs to come down to match. Once agreed, tokens in `web/src/styles/tokens.css` are renamed by role and
anything not listed here is deleted.

## Principles

- Generous type everywhere. Fit less content rather than shrink it.
- One responsive app, 360px to 1680px, no horizontal scroll. No device detection.
- Light for daytime prep, dark for dim gigs, via `prefers-color-scheme` only.
- Every page uses the roles below. No one-off sizes in a route file.

## Type roles

| Role | Size | Font | Used for |
|---|---|---|---|
| Page title | 28px | Lora (serif) | The one `<h1>` on each page |
| List row | 22px | system | Tappable rows (song titles) |
| Link / meta | 22px | system | Text links, secondary lines |
| Body | 18px | system | Status lines, plain text |

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

## Focus

- Visible keyboard focus on every link: 2px outline in the accent colour.

## Copy

- British English. Short complete sentences, no exclamation marks, no emoji.
- Strings live in `web/src/lib/microcopy.ts`.

## Not in use (to be deleted from tokens.css)

Card padding and stack gap, card/button/input/chord radii, card shadow, surface colour,
strong accent, mono font, chord (32px), annotation (20px), practice body (17px) and
section heading (22px) sizes. Bring any of them back only when a story needs it.
