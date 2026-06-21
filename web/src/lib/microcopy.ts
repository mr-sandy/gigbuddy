/*
 * Reusable microcopy constants.
 *
 * Strings are LOCKED — they live verbatim in EXPERIENCE.md §Voice and Tone /
 * §State Patterns. Do not paraphrase, soften, or add encouragement copy.
 * Voice rules: short complete sentences, no exclamation marks, no emoji,
 * no marketing voice.
 *
 * Locked surfaces: EMPTY_STATES, BANNERS, ACTIONS, FIELD_LABELS.
 *
 * Stories 1.5, 2.x, 3.x consume these for empty-state renders, locked
 * action labels, and field labels. Append (do not mutate) when new
 * surfaces are introduced.
 */

export const EMPTY_STATES = {
  noUpcomingGigs: 'No upcoming gigs.',
  noSongsInLibrary: 'No songs in this library yet.',
  songNotFound: 'Song not found.',
  setlistNotFound: 'Setlist not found.',
} as const;

export const BANNERS = {
  staleWrite: 'Your earlier edit was superseded.',
  errorBoundary: 'Something went wrong. Try refreshing.',
} as const;

export const ACTIONS = {
  newSong: '+ New song',
  newSetlist: '+ New setlist',
  backToLibrary: 'Back to library',
  startPerformance: 'Start performance ›',
  done: 'Done',
} as const;

export const FIELD_LABELS = {
  title: 'Title',
  key: 'Key',
  patch: 'Patch',
  chordChart: 'Chord chart',
  performanceNotes: 'Performance notes',
  practiceNotes: 'Practice notes',
} as const;

/*
 * Inline validation messages — append-only. Story 3.4 adds Venue/Date
 * required messages for the Setlist creation surface. Per EXPERIENCE.md
 * Voice & Tone these are short complete sentences, no exclamation, no
 * exhortation.
 */
export const VALIDATION_MESSAGES = {
  venueRequired: 'Venue is required.',
  dateRequired: 'Date is required.',
} as const;

/*
 * Paste-to-parse copy — Story 3.5 (FR-7/8/9). The paste textarea
 * placeholder, parsed-result empty-state, and per-row action labels
 * (Matched/Fuzzy/Unknown). All strings are locked verbatim per
 * EXPERIENCE.md — short complete sentences, no exclamation, no marketing
 * voice.
 */
export const PASTE_TO_PARSE = {
  placeholder: 'Paste setlist above.',
  emptyResult: 'Paste a setlist above.',
  yesMatch: 'Yes, that one',
  noNewSong: 'No — new song',
  addToLibrary: '+ Add to library',
  pickFromLibrary: 'Pick from library',
  discard: 'Discard',
  wasCaution: 'was:',
} as const;

/*
 * Drag-reorder copy — Story 3.6 (FR-12). MacBook-only surface: a drag
 * handle on each Setlist song row plus Move up / Move down keyboard
 * buttons. Strings are append-only per EXPERIENCE.md Voice & Tone —
 * short, no exclamation, no marketing voice.
 */
export const DRAG_REORDER = {
  handleLabel: (title: string) => `Drag to reorder ${title}`,
  moveUp: 'Move up',
  moveDown: 'Move down',
} as const;

/*
 * Performance Card copy — Story 4.1 (FR-15, FR-16, FR-17). iPhone-only
 * surface used on the Performance Card route. Glyph labels (`NEXT ›`, `‹`)
 * are the on-screen text; the `aria*` strings are spoken by assistive
 * technology in place of the glyph. Voice & Tone: short, no exclamation,
 * no marketing voice.
 */
export const PERFORMANCE_CARD = {
  nextSong: 'NEXT ›',
  previousSong: '‹',
  ariaNextSong: 'Next song',
  ariaPreviousSong: 'Previous song',
  ariaSongPosition: (n: number, total: number) => `Song ${n} of ${total}`,
} as const;
