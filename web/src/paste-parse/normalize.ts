/*
 * Title normalization for the paste-to-parse pipeline (Story 3.5, FR-7/8/9).
 *
 * `normalizeTitle` reduces a raw pasted title (or a Library `Song.title`)
 * to a stable comparison key for the matcher: lowercase, diacritic-free,
 * apostrophe-free, whitespace-collapsed, with enumerators and trailing
 * annotations stripped.
 *
 * The pipeline runs in the exact order specified in Story 3.5 AC-3 — the
 * order matters (e.g. em-dash split must run before NFKD because the
 * em-dash character is a single non-combining code point). Each step is a
 * pure string transform; the function is allocation-light but not
 * micro-optimised — V1 corpus is ~20 lines so straight-line regex work is
 * within the 500ms budget (NFR-3 / AC-11).
 */

/*
 * Human-readable display form: same cleaning as normalizeTitle but without
 * NFKD diacritic-stripping, apostrophe removal, or lowercasing. Used as
 * the initial display title for Unknown rows and as the Song.title when
 * "Add to library" is used — so the Library gets "Mas Que Nada" not
 * "mas que nada".
 */
export function extractDisplayTitle(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^\d+[.)]\s+/, '');
  s = s.replace(/^[-•]\s+/, '');
  const emDashIdx = s.indexOf(' – ');
  if (emDashIdx !== -1) s = s.slice(0, emDashIdx);
  const hyphenIdx = s.indexOf(' - ');
  if (hyphenIdx !== -1) s = s.slice(0, hyphenIdx);
  s = s.replace(/\s*\[[^\]]*\]\s*$/, '');
  s = s.replace(/\s*\([^)]*\)\s*$/, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function normalizeTitle(raw: string): string {
  // 1. Trim whitespace.
  let s = raw.trim();

  // 2. Strip leading enumerator: `1. `, `1) `, `- `, `• `.
  s = s.replace(/^\d+[.)]\s+/, '');
  s = s.replace(/^[-•]\s+/, '');

  // 3. Strip from the first ` – ` (em-dash surrounded by spaces) onward.
  const emDashIdx = s.indexOf(' – ');
  if (emDashIdx !== -1) s = s.slice(0, emDashIdx);

  // 4. Strip from the first ` - ` (hyphen surrounded by spaces) onward.
  const hyphenIdx = s.indexOf(' - ');
  if (hyphenIdx !== -1) s = s.slice(0, hyphenIdx);

  // 5. Strip trailing `[...]` brackets.
  s = s.replace(/\s*\[[^\]]*\]\s*$/, '');

  // 6. Strip trailing `(...)` parens.
  s = s.replace(/\s*\([^)]*\)\s*$/, '');

  // 7. NFKD-normalize then strip combining marks (diacritics).
  s = s.normalize('NFKD').replace(/\p{M}/gu, '');

  // 8. Strip ASCII and curly apostrophes.
  s = s.replace(/['‘’]/g, '');

  // 9. Lowercase.
  s = s.toLowerCase();

  // 10. Collapse whitespace, then trim.
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
