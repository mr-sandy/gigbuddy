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

/* Story 7.9 — add/edit gig. */
export const GIG_FORM = {
  addLink: 'Add gig',
  editLink: 'Edit',
  addHeading: 'Add gig',
  editHeading: 'Edit gig',
  venue: 'Venue',
  date: 'Date',
  time: 'Time',
  save: 'Save',
  cancel: 'Cancel',
} as const;

/* Story 7.10 — edit the setlist as text. */
export const SETLIST_TEXT = {
  editLink: 'Edit setlist',
  label: 'Setlist',
  hint: 'One song per line. Start a line with ## to name a section.',
  save: 'Save',
  cancel: 'Cancel',
  notInLibrary: 'Not in the library:',
  ambiguous: 'More than one song is called:',
  songsLoading: 'Loading songs…',
  songsError: "Couldn't load your songs, so the setlist can't be saved yet.",
} as const;

/* Story 7.11 — delete a song. */
export const SONG_DELETE = {
  button: 'Delete song',
  confirm: 'Delete',
  yes: 'Yes, delete',
  keep: 'Keep',
  inUse: 'This song is in the setlist for these gigs. Take it out of them first:',
  inUseUnknown: "This song is in a gig's setlist, so it wasn't deleted.",
  failed: "Couldn't delete the song. Check your connection and try again.",
} as const;

export const GIG_DELETE = {
  button: 'Delete gig',
  confirm: 'Delete',
  yes: 'Yes, delete',
  keep: 'Keep',
  failed: "Couldn't delete the gig. Check your connection and try again.",
} as const;

/* Story 7.14 — play a gig song by song. */
export const GIG_PLAY = {
  previous: 'Previous',
  next: 'Next',
  position: (n: number, total: number) => `${n} of ${total}`,
} as const;

/* Story 7.15 — keep the screen awake on song pages. */
export const WAKE_LOCK = {
  maySleep: 'Screen may sleep',
} as const;

/* Story 7.17 — export link on the songs page. */
export const EXPORT = { link: 'Export all data' } as const;
