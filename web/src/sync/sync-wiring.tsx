import { useEffect } from 'react';
import { setUnauthorizedHandler } from '../api/client.js';
import { useAuth } from '../auth/auth-context.js';
import { isIPhone } from '../lib/platform.js';
import { setFlusherQueryClient, startFlusher } from './flusher.js';
import { requestPersistentStorage } from './persist.js';
import { queryClient } from './query-client.js';

/*
 * Side-effect-only component (returns null). Mounted INSIDE <AuthProvider>
 * so its useEffect can close over `setAuth`. Installs the 401 handler on
 * the fetch wrapper, requests persistent storage on iPhone, and starts
 * the outbox flusher.
 *
 * The unsubscribe path runs on unmount — under Vite HMR the cleanup avoids
 * a stale handler firing after a re-mount.
 */
export function SyncWiring(): null {
  const { setAuth } = useAuth();
  useEffect(() => {
    setUnauthorizedHandler(() => setAuth({ status: 'unauthenticated' }));
    setFlusherQueryClient(queryClient);
    if (isIPhone()) {
      void requestPersistentStorage();
    }
    const unsubFlusher = startFlusher();
    return () => {
      setUnauthorizedHandler(null);
      setFlusherQueryClient(null);
      unsubFlusher();
    };
  }, [setAuth]);
  return null;
}
