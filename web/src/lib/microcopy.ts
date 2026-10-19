/*
 * Reusable microcopy constants.
 *
 * Strings are LOCKED — short complete sentences, no exclamation marks, no
 * emoji, no marketing voice. Append (do not mutate) when new surfaces are
 * introduced.
 */

export const BANNERS = {
  errorBoundary: 'Something went wrong. Try refreshing.',
} as const;

/* Story 7.1 — landing-page state copy (home.tsx). */
export const HOME = {
  loading: 'Loading…',
  error: "Couldn't load your songs and gigs.",
} as const;
