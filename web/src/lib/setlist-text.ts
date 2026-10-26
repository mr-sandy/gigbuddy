import type { Section, Song, SongRef } from '@gigbuddy/shared';

/*
 * A setlist as plain text (Story 7.10): one song title per line, `## Name`
 * starts a named section, blank lines are ignored. Titles are matched to the
 * library exactly (case, surrounding spaces and curly quotes aside) so that a
 * typo is reported rather than silently saved as the wrong song.
 */

export type ParseResult =
  | { ok: true; sections: Section[] }
  | { ok: false; notInLibrary: string[]; ambiguous: string[] };

export function setlistToText(sections: Section[]): string {
  const blocks: string[] = [];
  sections.forEach((section, index) => {
    const name = section.name.trim();
    const lines: string[] = [];
    if (name !== '') lines.push(`## ${name}`);
    else if (index > 0 && section.songs.length > 0) lines.push('##');
    for (const song of section.songs) lines.push(song.titleSnapshot);
    if (lines.length > 0) blocks.push(lines.join('\n'));
  });
  return blocks.join('\n\n');
}

function matchKey(s: string): string {
  return s.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

export function parseSetlistText(text: string, songs: Song[], previous: Section[]): ParseResult {
  const byKey = new Map<string, Song[]>();
  for (const song of songs) {
    const key = matchKey(song.title);
    byKey.set(key, [...(byKey.get(key) ?? []), song]);
  }

  const byId = new Map(songs.map((song) => [song.songId, song]));
  // A song renamed since the setlist was saved still shows its old title in
  // the text; this lets that old title resolve to the same song.
  const previousIds = new Map<string, Set<string>>();
  for (const section of previous) {
    for (const ref of section.songs) {
      if (!byId.has(ref.songId)) continue;
      const key = matchKey(ref.titleSnapshot);
      previousIds.set(key, (previousIds.get(key) ?? new Set()).add(ref.songId));
    }
  }

  const sections: Section[] = [];
  const notInLibrary: string[] = [];
  const ambiguous: string[] = [];
  const reported = new Set<string>();
  let current: Section | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('##')) {
      current = { name: line.slice(2).trim(), songs: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { name: '', songs: [] };
      sections.push(current);
    }
    const key = matchKey(line);
    let matches = byKey.get(key) ?? [];
    if (matches.length === 0) {
      matches = [...(previousIds.get(key) ?? [])].flatMap((id) => byId.get(id) ?? []);
    }
    const [match] = matches;
    if (matches.length === 1 && match) {
      const ref: SongRef = { songId: match.songId, titleSnapshot: match.title };
      current.songs.push(ref);
    } else {
      if (!reported.has(key)) {
        reported.add(key);
        (matches.length === 0 ? notInLibrary : ambiguous).push(line);
      }
    }
  }

  if (notInLibrary.length > 0 || ambiguous.length > 0)
    return { ok: false, notInLibrary, ambiguous };
  return { ok: true, sections };
}
