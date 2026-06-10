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
