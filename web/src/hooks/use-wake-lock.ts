import { useEffect, useState } from 'react';

/*
 * Holds a screen wake lock while the calling component is mounted (Story
 * 7.15). Re-requests when the page becomes visible again, or when the system
 * drops the lock while visible; no timed retries. `failed` is true once a
 * request has failed or the API is missing, never before the first settles.
 */
export function useWakeLock(): { failed: boolean } {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let sentinel: WakeLockSentinel | null = null;
    let pending = false;

    const onRelease = () => {
      sentinel = null;
      if (active && document.visibilityState === 'visible') request();
    };

    function request() {
      if (!('wakeLock' in navigator)) {
        setFailed(true);
        return;
      }
      if (pending) return;
      pending = true;
      navigator.wakeLock.request('screen').then(
        (lock) => {
          pending = false;
          if (!active) {
            void lock.release();
            return;
          }
          sentinel = lock;
          setFailed(false);
          lock.addEventListener('release', onRelease, { once: true });
        },
        () => {
          pending = false;
          if (active) setFailed(true);
        },
      );
    }

    const onVisibility = () => {
      if (active && document.visibilityState === 'visible' && !sentinel) request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        sentinel.removeEventListener('release', onRelease);
        void sentinel.release();
        sentinel = null;
      }
    };
  }, []);

  return { failed };
}
