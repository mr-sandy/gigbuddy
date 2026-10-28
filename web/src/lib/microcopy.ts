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

/* Story 7.3 — song list and song page copy. */
export const SONGS = {
  heading: 'Songs',
  loading: 'Loading…',
  error: "Couldn't load your songs.",
  empty: 'No songs yet.',
  notFound: 'Song not found.',
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
  add: 'Add',
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
  add: 'Add',
  save: 'Save',
  cancel: 'Cancel',
} as const;

/* Story 7.10 — edit the setlist as text. */
export const SETLIST_TEXT = {
  editLink: 'Edit setlist',
  heading: 'Edit setlist',
  label: 'Setlist',
  hint: 'One song per line. Start a line with ## to name a section.',
  save: 'Save',
  cancel: 'Cancel',
  checkHeading: 'Check songs',
  back: 'Back',
  checkIntro: (pending: number, matched: number) => {
    const need = pending === 1 ? '1 line needs a decision.' : `${pending} lines need a decision.`;
    if (matched === 0) return need;
    return matched === 1
      ? `${need} The other song is matched.`
      : `${need} The other ${matched} songs are matched.`;
  },
  addNew: (title: string) => `Add as a new song: ${title}`,
  asHeading: 'Use as a section heading',
  leaveOut: 'Leave it out',
  wholeLibrary: 'Whole library',
  bestGuess: 'Best guess',
  otherGuesses: 'Other guesses',
  matchedHeading: 'Matched for you',
  matchedItem: (line: string, title: string) => `“${line}” → ${title}`,
  songWithKey: (title: string, key?: string) => (key ? `${title} · ${key}` : title),
  songsLoading: 'Loading songs…',
  songsError: "Couldn't load your songs, so the setlist can't be saved yet.",
} as const;

/* Story 7.11 — delete a song. */
export const SONG_DELETE = {
  button: 'Delete song',
  title: (name: string) => `Delete ${name}?`,
  explain: "This can't be undone.",
  inUseTitle: (name: string) => `${name} is in a setlist`,
  inUse: 'Take it out of these gigs first:',
  yes: 'Yes, delete',
  keep: 'Keep',
  ok: 'OK',
  inUseUnknown: "This song is in a gig's setlist, so it wasn't deleted.",
  failed: "Couldn't delete the song. Check your connection and try again.",
} as const;

export const GIG_DELETE = {
  button: 'Delete gig',
  title: (label: string) => `Delete ${label}?`,
  explain: "This can't be undone. The songs stay in your library.",
  yes: 'Yes, delete',
  keep: 'Keep',
  failed: "Couldn't delete the gig. Check your connection and try again.",
} as const;

/* Story 7.14 — play a gig song by song. */
export const GIG_PLAY = {
  previousSong: 'Previous song',
  nextSong: 'Next song',
  position: (n: number, total: number) => `${n} of ${total}`,
} as const;

/* Story 7.15 — keep the screen awake on song pages. */
export const WAKE_LOCK = {
  maySleep: 'Screen may sleep',
} as const;

/* Story 7.22 — settings sheet behind the band name. */
export const SETTINGS = {
  title: 'GigBuddy',
  done: 'Done',
  band: 'Band',
  yourData: 'Your data',
  exportLink: 'Export all data',
  exportHelp: "Downloads every band's songs and gigs as one file.",
  appearance: 'Appearance',
  system: 'System',
  light: 'Light',
  dark: 'Dark',
} as const;
