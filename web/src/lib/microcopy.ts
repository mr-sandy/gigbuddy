/*
 * Reusable microcopy constants.
 *
 * Strings are LOCKED — they live verbatim in EXPERIENCE.md §Voice and Tone /
 * §State Patterns. Do not paraphrase, soften, or add encouragement copy.
 * Voice rules: short complete sentences, no exclamation marks, no emoji,
 * no marketing voice.
 *
 * Stories 1.5, 2.x, 3.x consume these for empty-state renders. Append (do not
 * mutate) when those stories introduce new empty states.
 */

export const EMPTY_STATES = {
  noUpcomingGigs: 'No upcoming gigs.',
  noSongsInLibrary: 'No songs in this library yet.',
} as const;

export const BANNERS = {
  staleWrite: 'Your earlier edit was superseded.',
  errorBoundary: 'Something went wrong. Try refreshing.',
} as const;
