/*
 * Platform detection helpers.
 *
 * Tablets and other phones are out of scope (NFR-26). The UA check is exhaustive
 * for the V1 device set: MacBook (any non-iPhone) vs iPhone Safari.
 *
 * Atmosphere wiring, the install gate (Story 2.2), and Wake Lock (Story 4.x)
 * all read from these helpers so detection stays in lockstep.
 */

export function isIPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPod/.test(navigator.userAgent);
}

/*
 * Reports whether the app is running as an installed PWA. On iPhone this is
 * the install-gate signal consumed by app-bootstrap (Story 2.2).
 *
 * Two signals, both honored on current iOS:
 *   - `window.matchMedia('(display-mode: standalone)').matches` — modern
 *     spec-compliant signal (PWA manifest `display: "standalone"`)
 *   - `navigator.standalone === true` — legacy iOS Safari signal (pre-spec;
 *     still emitted by current iOS as a redundant compatibility hint)
 * Either being truthy is sufficient to consider the app installed.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const legacyStandalone = (navigator as { standalone?: boolean }).standalone;
  return legacyStandalone === true;
}
