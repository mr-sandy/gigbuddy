/*
 * Tiny pub-sub for the stale-write banner (architecture.md line 299).
 *
 * Compatible with React's `useSyncExternalStore` so a banner component can
 * subscribe without pulling in a state library (AR-46). The flusher
 * (sync/flusher.ts) writes notices from a non-React context — that is why
 * this module has zero React imports.
 *
 * The store holds AT MOST ONE notice at a time. The architecture's banner
 * copy is generic ("Your earlier edit was superseded.") so a replace-on-new
 * semantic is sufficient for V1.
 */

export type StaleNotice = { recordKey: string; at: string };

let current: StaleNotice | null = null;
const subscribers = new Set<() => void>();

export function setStaleNotice(notice: StaleNotice): void {
  current = notice;
  notify();
}

export function clearStaleNotice(): void {
  if (current === null) return;
  current = null;
  notify();
}

export function subscribeStaleNotice(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function getStaleNotice(): StaleNotice | null {
  return current;
}

function notify(): void {
  for (const cb of subscribers) cb();
}

/** Test-only — resets state + subscribers between cases. */
export function __resetStaleNoticeForTests(): void {
  current = null;
  subscribers.clear();
}
