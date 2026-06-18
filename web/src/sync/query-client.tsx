import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import type { ReactNode } from 'react';
import { queryCacheStore } from '../cache/idb.js';

/*
 * The single module-scope QueryClient (architecture.md Decision 4, AR-20)
 * plus the IndexedDB-backed persister and the React Provider that gates
 * render on the initial cache restore.
 *
 * Per-query staleTime / refetch policy is set at the hook layer
 * (Stories 2.5 / 2.6). The persister stores dehydrated data with no TTL
 * of its own — invalidation is owned by the `buster` field.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Number.POSITIVE_INFINITY,
    },
  },
});

export const persister = createAsyncStoragePersister({
  key: 'gigbuddy-query-cache-v1',
  storage: {
    getItem: (key) => get(key, queryCacheStore) as Promise<string | null>,
    setItem: (key, value) => set(key, value, queryCacheStore),
    removeItem: (key) => del(key, queryCacheStore),
  },
});

/*
 * PersistQueryClientProvider gates initial render on the restore promise.
 * `buster: 'v1'` invalidates the cache if the schema version changes —
 * bump it in lockstep with any breaking change to a persisted shape.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, buster: 'v1' }}>
      {children}
    </PersistQueryClientProvider>
  );
}
