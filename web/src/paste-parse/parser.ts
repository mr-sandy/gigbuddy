/*
 * Plain-text setlist parser (Story 3.5, FR-7 / AC-2).
 *
 * `parseSetlist` scans a pasted plain-text fragment line-by-line and
 * groups song rows under Sections. Section headers follow a fixed
 * priority list (see AC-2 in the story spec) — `Set N`, `Encore`,
 * `{...}` brace-wrapped, `#`-prefixed markdown headers — plus a `---`
 * separator that closes the current section and implicitly opens the
 * next one as `Set N+1`. When no header pattern appears anywhere, all
 * rows land in a single default Section named `Set 1` (per FR-7 /
 * EXPERIENCE.md Flow 3).
 *
 * The parser stays neutral on row content: it does not specially detect
 * document-title lines, key/tempo annotations, etc. Those concerns are
 * delegated downstream — the normalizer reduces noise, the matcher
 * decides Matched/Fuzzy/Unknown, and Sandy resolves any leftover junk
 * via the `Discard` affordance on the Unknown row (AC-8).
 *
 * Output shape (consumed by the matcher and route):
 *   ParseResult = { sections: ParsedSection[] }
 *   ParsedSection = { name: string; rows: ParsedRow[] }
 *   ParsedRow = { raw: string; normalized: string }
 */

import { normalizeTitle } from './normalize.js';

export type ParsedRow = { raw: string; normalized: string };
export type ParsedSection = { name: string; rows: ParsedRow[] };
export type ParseResult = { sections: ParsedSection[] };

const SET_HEADER_RE = /^\s*(set\s+\d+)\b/i;
const ENCORE_HEADER_RE = /^\s*encore\b/i;
const BRACE_HEADER_RE = /^\s*\{([^}]+)\}\s*$/;
const HASH_HEADER_RE = /^#{1,6}\s+(.+)$/;
const SEPARATOR_RE = /^\s*-{3,}\s*$/;

function titleCaseSet(match: string): string {
  // "set 1", "SET 2", "Set  3" → "Set 1" / "Set 2" / "Set 3".
  const m = match.trim().match(/^set\s+(\d+)$/i);
  if (!m) return match.trim();
  return `Set ${m[1]}`;
}

function classifyHeader(line: string): string | null {
  const setMatch = SET_HEADER_RE.exec(line);
  if (setMatch && setMatch[1] !== undefined) {
    return titleCaseSet(setMatch[1]);
  }
  if (ENCORE_HEADER_RE.test(line)) {
    return 'Encore';
  }
  const braceMatch = BRACE_HEADER_RE.exec(line);
  if (braceMatch && braceMatch[1] !== undefined) {
    return braceMatch[1].trim();
  }
  const hashMatch = HASH_HEADER_RE.exec(line);
  if (hashMatch && hashMatch[1] !== undefined) {
    return hashMatch[1].trim();
  }
  return null;
}

export function parseSetlist(text: string): ParseResult {
  const sections: ParsedSection[] = [];

  // The current open section. `null` means no header has been seen yet
  // (and no implicit Set has been needed). Implicit `Set N+1` sections
  // created by the `---` separator are opened lazily when the next song
  // row arrives, so a paste that ends with `---` does not emit a trailing
  // empty section.
  let current: ParsedSection | null = null;

  // `pendingImplicit` carries a section the separator wants us to open
  // when the next non-blank, non-header line appears. Stored as a name
  // only; the actual section object is materialized on first row.
  let pendingImplicit: string | null = null;

  // Implicit set counter — tracks how many implicit `Set N` sections we
  // have minted (including the very first default `Set 1` when no header
  // is seen). Reset semantics: any explicit header also resets the
  // pending-implicit counter so a subsequent `---` continues from the
  // explicit set number.
  let implicitSetCount = 0;

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    // Skip blank lines — they do NOT close a section.
    if (rawLine.trim() === '') continue;

    // Separator: close the current section and queue an implicit Set N+1.
    if (SEPARATOR_RE.test(rawLine)) {
      // The current section (if any) is already pushed; just queue the
      // implicit next section name. The actual current-section pointer
      // is cleared so subsequent songs land in the pending implicit.
      current = null;
      pendingImplicit = `Set ${sectionsCountForImplicit(sections) + 1}`;
      continue;
    }

    const headerName = classifyHeader(rawLine);
    if (headerName !== null) {
      // Any explicit header cancels a pending implicit (we have a real
      // header — use it).
      pendingImplicit = null;
      const newSection: ParsedSection = { name: headerName, rows: [] };
      sections.push(newSection);
      current = newSection;
      continue;
    }

    // Song row. Materialize the right section to put it in.
    if (current === null) {
      if (pendingImplicit !== null) {
        const newSection: ParsedSection = { name: pendingImplicit, rows: [] };
        sections.push(newSection);
        current = newSection;
        pendingImplicit = null;
      } else {
        // No header has been seen yet — open implicit Set 1.
        implicitSetCount += 1;
        const newSection: ParsedSection = { name: `Set ${implicitSetCount}`, rows: [] };
        sections.push(newSection);
        current = newSection;
      }
    }

    current.rows.push({ raw: rawLine, normalized: normalizeTitle(rawLine) });
  }

  return { sections };
}

// Implicit-set numbering for `---` separators considers ALL existing
// sections (explicit + implicit) so the next number doesn't collide with
// e.g. an explicit `Set 2` that came before.
function sectionsCountForImplicit(sections: ParsedSection[]): number {
  return sections.length;
}
