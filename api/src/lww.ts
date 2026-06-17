/*
 * Canonical LWW comparator (architecture.md §LWW server logic, AR-23).
 *
 * Per-record, not per-field (FR-32). ISO-8601 strings are lexically
 * sortable so plain `>=` is correct without any Date parsing.
 *
 * Same-timestamp incoming wins (`incoming >= existing`, per architecture)
 * — matches what a single client expects when the same write arrives
 * twice (e.g., outbox retry after a transient 5xx).
 *
 * Generic over `T extends { clientWrittenAt: string }` so Story 3.1 can
 * reuse this for Setlist records without any change.
 */
export function compareLww<T extends { clientWrittenAt: string }>(
  incoming: T,
  existing: T | undefined,
): 'apply' | 'drop' {
  if (!existing) return 'apply';
  return incoming.clientWrittenAt >= existing.clientWrittenAt ? 'apply' : 'drop';
}
