import type { Section, Song, SongRef } from '@gigbuddy/shared';

/*
 * A setlist as plain text (Story 7.10, 7.25): one song title per line. `## Name`
 * or a plain "Set 1" / "Encore" line starts a named section, a line of dashes
 * ends the current one, blank lines are ignored. Lines are tidied (numbering,
 * durations, accents, punctuation, case, a leading "The") before they're
 * compared with the library. Parsing never fails: lines that don't match
 * exactly one song come back as `pending`, for the "Check songs" step to settle.
 */

export type DraftLine = { ref: SongRef } | { pendingKey: string };
export type DraftSection = { name: string; lines: DraftLine[] };
export type PendingLine = {
  /** matchKey of the line as typed (brackets kept). */
  key: string;
  /** The first occurrence, trimmed, for the label. */
  line: string;
  newTitle: string;
  /** More than one: a shared title. None: nothing matched. */
  candidates: Song[];
  /** Best first, up to three. Only for a line with no exact match (Story 7.26). */
  guesses: Song[];
};
export type SetlistDraft = {
  sections: DraftSection[];
  pending: PendingLine[];
  /** Lines matched to a library song by close spelling, once per distinct line. */
  autoMatched: { line: string; title: string }[];
};

export type Choice =
  | { kind: 'song'; songId: string; title: string }
  | { kind: 'new' }
  | { kind: 'heading' }
  | { kind: 'out' };

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

/** Drops leading numbering or a bullet and a trailing duration. */
export function stripLineNoise(line: string): string {
  return line
    .trim()
    .replace(/^(\d+\s*[.)-]|[-•*·])\s*/, '')
    .replace(/\s*[-–—]?\s*\(?\d{1,2}:\d{2}\)?\s*$/, '')
    .trim();
}

export function withoutBrackets(s: string): string {
  return s.replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, ' ');
}

export function matchKey(s: string): string {
  return stripLineNoise(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

/** Folds look-alike OCR characters together. Only ever used for distance. */
function ocrFold(key: string): string {
  return key.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/[1i|]/g, 'l').replace(/0/g, 'o');
}

export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

type KeyedSong = { song: Song; key: string };

function distances(keys: string[], entry: KeyedSong) {
  const target = ocrFold(entry.key);
  let d = Number.POSITIVE_INFINITY;
  let longest = target.length;
  for (const key of keys) {
    const folded = ocrFold(key);
    const dist = editDistance(folded, target);
    if (dist < d) {
      d = dist;
      longest = Math.max(folded.length, target.length);
    }
  }
  return { d, similarity: longest === 0 ? 0 : 1 - d / longest };
}

function isVeryClose(d: number, songKeyLength: number): boolean {
  if (songKeyLength >= 12) return d <= 2;
  if (songKeyLength >= 5) return d <= 1;
  return false;
}

/** The one song a line is very close to, if no other song is nearly as close. */
function autoMatch(keys: string[], entries: KeyedSong[]): Song | undefined {
  const scored = entries
    .map((entry) => ({ entry, d: distances(keys, entry).d }))
    .sort((a, b) => a.d - b.d);
  const [best, runnerUp] = scored;
  if (!best) return undefined;
  if (!isVeryClose(best.d, ocrFold(best.entry.key).length)) return undefined;
  if (runnerUp && runnerUp.d < best.d + 2) return undefined;
  return best.entry.song;
}

const GUESS_FLOOR = 0.6;
const CONTAINED_SCORE = 0.9;

function guessSongs(keys: string[], entries: KeyedSong[]): Song[] {
  const padded = keys.map((key) => ` ${key} `);
  return entries
    .map((entry) => {
      let score = distances(keys, entry).similarity;
      // Either way round: the title inside the line ("Cissy Strut (Herbie)"), or
      // the line inside the title, as setlists shorten them ("Chitlins").
      const paddedTitle = ` ${entry.key} `;
      const contained =
        (entry.key.length >= 4 && padded.some((k) => k.includes(paddedTitle))) ||
        keys.some((k) => k.length >= 4 && paddedTitle.includes(` ${k} `));
      if (contained) score = Math.max(score, CONTAINED_SCORE);
      return { song: entry.song, score };
    })
    .filter((g) => g.score >= GUESS_FLOOR)
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title, 'en'))
    .slice(0, 3)
    .map((g) => g.song);
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of']);
for (const w of ['on', 'or', 'the', 'to']) SMALL_WORDS.add(w);

function isAllCaps(s: string): boolean {
  return /\p{L}/u.test(s) && !/\p{Ll}/u.test(s);
}

function titleCase(s: string): string {
  const words = s.split(' ');
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (SMALL_WORDS.has(lower) && i !== 0 && i !== words.length - 1) return lower;
      return word.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** The title for a song created from a pasted line. */
export function tidyTitle(line: string): string {
  const tidy = withoutBrackets(stripLineNoise(line))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[-–—]$/, '')
    .trim();
  if (tidy === '') return line.trim();
  return isAllCaps(tidy) ? titleCase(tidy) : tidy;
}

const NUMBER_WORDS = 'one|two|three|four|five|six|seven|eight|nine';
const ORDINAL_WORDS = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth';
const HEADING_PATTERNS = [
  new RegExp(`^set\\s+(\\d|${NUMBER_WORDS})$`, 'i'),
  new RegExp(`^(\\d(st|nd|rd|th)|${ORDINAL_WORDS})\\s+set$`, 'i'),
  /^encore$/i,
];
const RULE = /^[-–—_]{3,}$/;

function headingName(line: string): string | undefined {
  if (!HEADING_PATTERNS.some((pattern) => pattern.test(line))) return undefined;
  return isAllCaps(line) ? titleCase(line) : line;
}

/** The section name for a line chosen as a heading: tidied like a parsed heading. */
export function headingFromLine(line: string): string {
  const tidy = stripLineNoise(line);
  return isAllCaps(tidy) ? titleCase(tidy) : tidy;
}

export function parseSetlistText(text: string, songs: Song[], previous: Section[]): SetlistDraft {
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

  const entries: KeyedSong[] = songs
    .map((song) => ({ song, key: matchKey(song.title) }))
    .filter((entry) => entry.key !== '');

  const find = (key: string): Song[] => {
    const direct = byKey.get(key) ?? [];
    if (direct.length > 0) return direct;
    return [...(previousIds.get(key) ?? [])].flatMap((id) => byId.get(id) ?? []);
  };

  const sections: DraftSection[] = [];
  const pending = new Map<string, PendingLine>();
  const autoMatched = new Map<string, { line: string; title: string }>();
  let current: DraftSection | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('##')) {
      current = { name: line.slice(2).trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (RULE.test(line)) {
      current = undefined;
      continue;
    }
    const heading = headingName(line);
    if (heading !== undefined) {
      current = { name: heading, lines: [] };
      sections.push(current);
      continue;
    }
    if (stripLineNoise(line) === '') continue;
    if (!current) {
      current = { name: '', lines: [] };
      sections.push(current);
    }
    const key = matchKey(line);
    const bare = matchKey(withoutBrackets(line));
    let matches = find(key);
    if (matches.length === 0 && bare !== key) matches = find(bare);
    const fuzzyKeys = bare !== key && bare !== '' ? [key, bare] : [key];
    let match = matches[0];
    let guesses: Song[] = [];
    if (matches.length === 0) {
      match = autoMatch(fuzzyKeys, entries);
      if (match) {
        if (!autoMatched.has(key)) {
          autoMatched.set(key, { line: stripLineNoise(line), title: match.title });
        }
      } else {
        guesses = guessSongs(fuzzyKeys, entries);
      }
    }
    if (matches.length <= 1 && match) {
      current.lines.push({ ref: { songId: match.songId, titleSnapshot: match.title } });
    } else {
      if (!pending.has(key)) {
        pending.set(key, {
          key,
          line,
          newTitle: tidyTitle(line),
          candidates: matches,
          guesses,
        });
      }
      current.lines.push({ pendingKey: key });
    }
  }

  return { sections, pending: [...pending.values()], autoMatched: [...autoMatched.values()] };
}

export function defaultChoice(p: PendingLine): Choice {
  const [first] = p.candidates.length > 0 ? p.candidates : p.guesses;
  return first ? { kind: 'song', songId: first.songId, title: first.title } : { kind: 'new' };
}

/**
 * Settles a draft into sections. `newRefs` maps a pending key to the song
 * created for it. "Leave it out" lines go, and so does an unnamed section
 * left with no songs; named empty sections stay.
 */
export function resolveDraft(
  draft: SetlistDraft,
  choices: Map<string, Choice>,
  newRefs: Map<string, SongRef>,
): Section[] {
  const sections: Section[] = [];
  const lineByKey = new Map(draft.pending.map((p) => [p.key, p.line]));
  for (const section of draft.sections) {
    let name = section.name;
    let songs: SongRef[] = [];
    const flush = () => {
      if (name !== '' || songs.length > 0) sections.push({ name, songs });
    };
    for (const line of section.lines) {
      if ('ref' in line) {
        songs.push(line.ref);
        continue;
      }
      const choice = choices.get(line.pendingKey);
      if (choice?.kind === 'song') {
        songs.push({ songId: choice.songId, titleSnapshot: choice.title });
      } else if (choice?.kind === 'new') {
        const ref = newRefs.get(line.pendingKey);
        if (ref) songs.push(ref);
      } else if (choice?.kind === 'heading') {
        flush();
        name = headingFromLine(lineByKey.get(line.pendingKey) ?? '');
        songs = [];
      }
    }
    flush();
  }
  return sections;
}
