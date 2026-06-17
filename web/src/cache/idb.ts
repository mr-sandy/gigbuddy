import { createStore, del, entries, get, set } from 'idb-keyval';

/*
 * IndexedDB primitives shared by the outbox + the TanStack persister
 * (architecture.md "Outbox state machine" + Decision 4).
 *
 * Two named databases own the offline state:
 *   - `gigbuddy-outbox` is the optimistic-write outbox (sync/outbox.ts).
 *   - `gigbuddy-query-cache` is the TanStack Query persister cache
 *     (sync/query-client.tsx wires the persister; this module exports the
 *     store handle so the persister storage adapter can read/write it).
 *
 * Two stores instead of one because the outbox is a hot write path while
 * the persister batches writes — keeping them in independent IDB databases
 * gives them independent lock domains.
 *
 * idb-keyval's `createStore('database', 'store')` opens (or creates) the
 * database lazily on first access. The handles are module-scope singletons.
 */
export const outboxStore = createStore('gigbuddy-outbox', 'entries');
export const queryCacheStore = createStore('gigbuddy-query-cache', 'entries');

export const idb = { get, set, del, entries };
