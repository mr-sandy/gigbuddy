# GigBuddy style guide

The source of truth for how GigBuddy looks. Tokens in `web/src/styles/tokens.css` are named by role (`--text-page-title`, `--text-row`, `--text-reading`, `--text-body`) and, for colour, by shadcn role (`--background`, `--primary` …). Page titles are 28px, set by Sandy on 2026-10-19.

## Principles

- Generous type everywhere. Fit less content rather than shrink it.
- One responsive app, 360px to 1680px, no horizontal scroll. No device detection.
- Light for daytime prep, dark for dim gigs, via `prefers-color-scheme` by default; the settings sheet can override it per device.
- Every page uses the roles below; page titles come from the `PageTitle` component. No one-off sizes in a route file.

## Type roles

| Role | Size | Font | Used for |
|---|---|---|---|
| Page title (`--text-page-title`) | 28px | Lora (serif) | The one `<h1>` on each page |
| Row (`--text-row`) | 22px | system | Tappable rows (song titles), text links |
| Reading (`--text-reading`) | 22px | system | Song content: key/patch line, chord chart |
| Body (`--text-body`) | 18px | system | Status lines, plain text |
| Nav (`--text-nav`) | 20px | Lora for the band name, system for tab labels | Band name in the header, tab labels |
| Small (`--text-small`) | 16px | system | Small buttons only |

Rules:
- Exactly one Page title per page, always an `<h1>`, always the same size.
- Page title colour is foreground text; body status lines use `--muted-foreground`.
- Plain text links are underlined foreground text. Header actions and buttons are `Button`s.

## Colour

Tokens use shadcn's role names and live in `web/src/styles/tokens.css`.

System follows the device. Light or Dark sets `data-theme` on `<html>` and overrides it, remembered
per device in browser storage (`gigbuddy-theme`) and applied before first paint by the inline
script in `index.html`, which also sets `theme-color`. The installed app's manifest colour is
the light background (`#faf9f5`); it can't follow the theme.

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
| `--scrim` | `rgba(26, 18, 9, 0.45)` | `rgba(0, 0, 0, 0.62)` | Dimming behind a sheet or confirm dialog (not text) |

- Brass text is allowed (5.08:1 on the light background) for header actions.
- Hairlines show in dark mode too.
- All text pairs meet WCAG AA; borders of fields meet 3:1. `pnpm test` checks this.

## Spacing and tap targets

- Base unit 4px. Page gutter 16px. Gap between sections 32px.
- Anything tappable is at least 44px high.
- List rows: 12px vertical padding, 1px hairline underneath.
- Header: every signed-in page starts with it. At least 56px high (`--spacing-header`), 1px
  `--border` hairline underneath that runs edge to edge on a phone, 16px below it before the
  page title. List pages (`/songs`, `/gigs`): band name left (a `ghost` button, Lora 20px, brass
  chevron-down, opens the settings sheet), Add song / Add gig right. Every other page: back link left, Edit right where
  it exists. Add and edit forms are sheets and have no page header. In the page flow, not
  sticky.
- Tab bar: `/songs` and `/gigs` only. Fixed to the bottom, page background, 1px `--border` top
  line. Two tabs, Songs | Gigs, at least 60px tall (`--spacing-tab-bar`), equal halves on a
  phone and 12rem each, centred, on wide windows. 20px quiet text; the current tab is
  foreground text, semibold, with a 3px brass line along its top. Tabs are nav links, not
  `Button`s. Content is padded so nothing hides under the bar, keyboard focus scrolls clear of
  it (`scroll-padding-bottom` on `html`, set while the bar is on the page), and the bar runs
  down to the home indicator like the play bar.
- A group label inside a list (e.g. "Past") is Body, secondary text, with the 32px section
  gap above it.
- Bottom bar (gig song page): fixed to the bottom, page background, 1px `--border` top line.
  Two equal regions at least 64px tall (`--spacing-play-bar`), each capped at 18rem and centred
  on wide windows; brass 30px Lucide chevrons only, named "Previous song" / "Next song". The
  position ("3 of 12") sits in a narrow middle column (Body, quiet text, tabular figures) with
  `--border` dividers either side. A pressed region gets a brief brass tint (`primary` at 15%).
  An unavailable end is an inert `aria-disabled` span with a faded chevron, never a disabled
  button or another action. On the iPhone the regions and dividers run down to the screen edge,
  with the chevrons kept above the home indicator. Content is padded so nothing hides under the bar, and keyboard focus scrolls clear of it
  (scroll padding, as for the tab bar).
- "Screen may sleep" line on song pages: Body size, secondary text, under the back link; shown
  only when the screen can't be kept awake. No token changes.

## Buttons

All buttons and button-like links use `Button` (`web/src/components/ui/button.tsx`): at least
44px high, 18px text, 8px radius, 50% opacity when disabled.

| Job | Variant |
|---|---|
| Edit, Add song, Add gig | `ghost`, brass text (`text-primary`), Lucide pencil or plus |
| Edit setlist (beside the first set) | `secondary`, size `sm`, Lucide pencil |
| Back links | `ghost`, quiet text (`text-muted-foreground`), Lucide chevron-left |
| Save, Add (sheet header), Sign in | `default` (brass) |
| Cancel (sheet header) | `ghost` |
| Delete song, Delete gig | `destructive-outline`, Lucide trash |
| "Yes, delete" (confirm dialog) | `destructive` |
| "Keep", "OK" (confirm dialog) | `outline` |
| Band name (list header) | `ghost`, Lora 20px, brass Lucide chevron-down |
| Done (settings sheet) | `ghost`, brass text |
| Appearance segments | `default` when chosen, `ghost` otherwise, `aria-pressed` |
| Export all data (settings sheet) | `link`, quiet text, Lucide download; a plain `<a>` (the router would swallow the download) |
| Play-bar regions (previous, next song) | `ghost`, full-height, square corners, brass chevron only |

Size `sm` means 16px text and 12px side padding; it keeps the 44px tap height.

Ghost buttons use 10px side padding so their text lines up near the page gutter; `link` has none.

## Forms

- `Label` (Body, 18px) above `Input` / `Textarea`, with a 4px gap.
- Fields use Reading (22px), foreground text on the page background, a 1px `--input` border,
  8px radius, at least 44px high, full width.
- Save stays disabled until the required fields are filled (song: title; gig: venue and date).
  There are no submit-time error messages for required fields.

## Sheet

All adding and editing (add and edit song, add and edit gig, edit setlist) happens in a sheet
over the page it was opened from, built from `ui/sheet.tsx` and `EditSheet`.

- Header: Cancel (`ghost`) left, title centre (Lora, 20px), Save or Add (`default`) right,
  56px high with a hairline under it. Save and Add stay disabled until the required fields are
  filled.
- Narrow windows: the sheet comes up from the bottom with 44px of the page visible above it,
  rounded top corners, and the page dimmed by `--scrim`. Wide windows (48rem and up): a 460px
  panel from the right (`--spacing-sheet`). The choice is made by window width, never by device.
- It slides in when it opens (up from the bottom, or in from the right on wide windows; 250ms,
  ease-out) while the scrim fades in. Closing is instant. Reduce Motion turns the slide off.
- No swipe-to-close and no tap-outside close. Cancel and Escape close it and discard changes.
  Focus moves in when it opens and returns to the opener when it closes.
- The body scrolls; the header doesn't. Delete sits at the foot of the body, after a hairline
  and 32px of space.
- The URLs stay real: opened directly, an edit URL shows the sheet over the right page, and
  browser Back closes it.
- Edit setlist has a second step, Check songs, shown only when lines don't match: the same
  sheet, header ‹ Back · Check songs · Save, one native dropdown per line (`NativeSelect`, Body
  size). Cancel is on the first step only.

## Settings sheet

Opened only from the band name on `/songs` and `/gigs`. Same sheet as editing, but the header is
empty · "GigBuddy" · Done, and it has no URL: Done and Escape close it.

- Band: the current band with a brass tick (V1 has one band).
- Appearance: a System / Light / Dark segmented control; the choice applies at once and the
  sheet stays open.
- Your data: "Export all data" and a help line.

## Confirm dialog

For destructive actions only (`ui/alert-dialog.tsx`).

- A title, one line of explanation, and two buttons: "Keep" (`outline`) and "Yes, delete"
  (`destructive`). On a phone they are full width and stacked, "Yes, delete" on top; on wide
  windows they sit side by side on the right, Keep first.
- When the action is blocked (a song that is in a setlist), the dialog says why, lists the
  gigs, and offers only "OK".
- Focus starts on the safe button. Escape closes the dialog only, not the sheet under it.

## Rows

- A muted Lucide chevron-right at the end of each list row. Rows are not buttons.

## Icons

- Lucide only, always `aria-hidden`, always beside text. The one exception is the play-bar regions: icon-only, named by `aria-label`.

## Focus

- Visible keyboard focus on every link, input and button: a 3px `--ring` around it.

## Copy

- British English. Short complete sentences, no exclamation marks, no emoji.
- Strings live in `web/src/lib/microcopy.ts`.
