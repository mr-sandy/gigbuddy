/**
 * Index of the current entry in the browser history, as React Router 7 records it.
 * React Router has no public API for history depth, and `location.key !== 'default'`
 * only says "not the first entry". Anything odd falls back to 0 (treat as shallow).
 */
export function historyIndex(): number {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' && Number.isFinite(idx) && idx >= 0 ? idx : 0;
}
