import { isIPhone } from './platform.js';

/*
 * Applies the boot-time atmosphere. iPhone → 'performance', everything else →
 * 'practice'. Called once from main.tsx before React renders. There is no
 * reactive mechanism — atmosphere is fixed for the session per architecture.md
 * "Theme atmosphere" (no JS theme provider).
 */
export function applyBootAtmosphere(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.atmosphere = isIPhone() ? 'performance' : 'practice';
}

/*
 * Read the boot-fixed atmosphere from
 * `document.documentElement.dataset.atmosphere`. Components branch on this
 * for MacBook (`practice`) vs iPhone (`performance`) rendering. Previously
 * inlined verbatim in song-detail.tsx, section-heading.tsx, setlist-song-
 * row.tsx, and setlist-creation.tsx; consolidated in Epic 3 retro action #7
 * once the copy count crossed three.
 */
export function readAtmosphere(): 'practice' | 'performance' {
  if (typeof document === 'undefined') return 'practice';
  return document.documentElement.dataset.atmosphere === 'performance' ? 'performance' : 'practice';
}
