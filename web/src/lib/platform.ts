/*
 * Platform detection helpers.
 *
 * Tablets and other phones are out of scope (NFR-26). The UA check is exhaustive
 * for the V1 device set: MacBook (any non-iPhone) vs iPhone Safari.
 *
 * Atmosphere wiring (this story) and the Wake Lock / install gate (Stories 2.2,
 * 4.x) all read from `isIPhone()` so detection stays in lockstep.
 */

export function isIPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPod/.test(navigator.userAgent);
}
