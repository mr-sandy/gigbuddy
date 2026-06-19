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
