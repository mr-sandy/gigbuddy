# GigBuddy style guide

The source of truth for how GigBuddy looks. Tokens in `web/src/styles/tokens.css` are named by role (`--text-page-title`, `--text-row`, `--text-reading`, `--text-body`) and, for colour, by shadcn role (`--background`, `--primary` …). Page titles are 28px, set by Sandy on 2026-10-19.

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
- Page title colour is foreground text; body status lines use `--muted-foreground`.
- Plain text links are underlined foreground text. Header actions and buttons are `Button`s.

## Colour

Tokens use shadcn's role names and live in `web/src/styles/tokens.css`.

| Token | Light | Dark | Job |
|---|---|---|---|
| `--background` | `#faf9f5` | `#1a1209` | Page background |
| `--foreground` | `#1a1209` | `#f1e6cf` | Text |
| `--muted` | `#f0ebe0` | `#251a0e` | Hover fill |
| `--muted-foreground` | `#5a4a35` | `#c9b486` | Quiet text: status lines, back links, group labels |
| `--primary` | `#8a6420` | `#e6b855` | Brass accent: default buttons, header actions (Edit, Add) |
| `--primary-foreground` | `#faf9f5` | `#1a1209` | Text on brass |
| `--border` | `#e2dacb` | `#3a2e1f` | Hairlines under rows (decorative) |
| `--input` | `#8f7f66` | `#7a6a4d` | Field and outline-button borders (3:1 or better) |
| `--destructive` | `#a3341f` | `#f08a6e` | Delete |
| `--destructive-foreground` | `#ffffff` | `#1a1209` | Text on a destructive fill |
| `--ring` | brass at about 45% | same | Focus ring (follows `--primary`) |

- Brass text is allowed (5.08:1 on the light background) for header actions.
- Hairlines show in dark mode too.
- All text pairs meet WCAG AA; borders of fields meet 3:1. `pnpm test` checks this.

## Spacing and tap targets

- Base unit 4px. Page gutter 16px. Gap between sections 32px.
- Anything tappable is at least 44px high.
- List rows: 12px vertical padding, 1px hairline underneath.
- Back link at the top of a page, then the page title 4px below it.
- A group label inside a list (e.g. "Past") is Body, secondary text, with the 32px section
  gap above it.
- Bottom bar (gig song page): fixed to the bottom, page background, 1px `--border` top line.
  Two equal regions at least 64px tall (`--spacing-play-bar`), each capped at 18rem and centred
  on wide windows; brass 30px Lucide chevrons only, named "Previous song" / "Next song". The
  position ("3 of 12") sits in a narrow middle column (Body, quiet text, tabular figures) with
  `--border` dividers either side. A pressed region gets a brief brass tint (`primary` at 15%).
  An unavailable end is an inert `aria-disabled` span with a faded chevron, never a disabled
  button or another action. On the iPhone the regions and dividers run down to the screen edge,
  with the chevrons kept above the home indicator. Content is padded so nothing hides under the bar.
- "Screen may sleep" line on song pages: Body size, secondary text, under the back link; shown
  only when the screen can't be kept awake. No token changes.
- Export link at the foot of the songs page: a `link` variant `Button` rendered as a plain
  `<a>` (the router would swallow the download), 32px section gap above.

## Buttons

All buttons and button-like links use `Button` (`web/src/components/ui/button.tsx`): at least
44px high, 18px text, 8px radius, 50% opacity when disabled.

| Job | Variant |
|---|---|
| Edit, Add song, Add gig | `ghost`, brass text (`text-primary`), Lucide pencil or plus |
| Back links | `ghost`, quiet text (`text-muted-foreground`), Lucide chevron-left |
| Save, Add, Sign in | `default` (brass) |
| Cancel | `ghost` |
| Delete song, Delete gig | `destructive-outline`; confirm step: "Yes, delete" `destructive`, "Keep" `outline` |
| Export all data | `link`, quiet text |
| Play-bar regions (previous, next song) | `ghost`, full-height, square corners, brass chevron only |

Ghost buttons use 10px side padding so their text lines up near the page gutter; `link` has none.

## Forms

- `Label` (Body, 18px) above `Input` / `Textarea`, with a 4px gap.
- Fields use Reading (22px), foreground text on the page background, a 1px `--input` border,
  8px radius, at least 44px high, full width.
- Save stays disabled until the required fields are filled (song: title; gig: venue and date).
  There are no submit-time error messages for required fields.

## Rows

- A muted Lucide chevron-right at the end of each list row. Rows are not buttons.

## Icons

- Lucide only, always `aria-hidden`, always beside text. The one exception is the play-bar regions: icon-only, named by `aria-label`.

## Focus

- Visible keyboard focus on every link, input and button: a 3px `--ring` around it.

## Copy

- British English. Short complete sentences, no exclamation marks, no emoji.
- Strings live in `web/src/lib/microcopy.ts`.
