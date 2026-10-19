/** Formats the landing-page counts line, e.g. "52 songs · 7 gigs". */
export function formatCounts(songs: number, gigs: number): string {
  const songWord = songs === 1 ? 'song' : 'songs';
  const gigWord = gigs === 1 ? 'gig' : 'gigs';
  return `${songs} ${songWord} · ${gigs} ${gigWord}`;
}
