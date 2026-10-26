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

/* Story 7.3 — song list and song page copy. */
export const SONGS = {
  heading: 'Songs',
  loading: 'Loading…',
  error: "Couldn't load your songs.",
  empty: 'No songs yet.',
  notFound: 'Song not found.',
  backToHome: 'Home',
  backToSongs: 'Back to songs',
} as const;

/* Story 7.6 — add/edit song. */
export const SONG_FORM = {
  addLink: 'Add song',
  editLink: 'Edit',
  addHeading: 'Add song',
  editHeading: 'Edit song',
  title: 'Title',
  key: 'Key',
  patch: 'Patch',
  chordChart: 'Chord chart',
  save: 'Save',
  cancel: 'Cancel',
  titleRequired: 'A song needs a title.',
} as const;

/* Story 7.7 — gig list and gig page copy. */
export const GIGS = {
  heading: 'Gigs',
  loading: 'Loading…',
  error: "Couldn't load your gigs.",
  empty: 'No gigs yet.',
  past: 'Past',
  notFound: 'Gig not found.',
  backToHome: 'Home',
  backToGigs: 'Back to gigs',
} as const;

/* Story 7.8 — setlist on the gig page, and the song page inside a gig. */
export const GIG_SETLIST = {
  empty: 'No songs in this setlist yet.',
  backToGig: 'Back to gig',
} as const;
