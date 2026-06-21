/// <reference lib="dom" />

/*
 * Session-resume marker — Story 4.5 (AC-8, AC-13).
 *
 * iOS Safari/PWA resets the URL to the manifest `start_url` (`/`) on a
 * cold relaunch (e.g. after the OS killed the process mid-Gig). A pure
 * URL-driven restore can't survive that, so we write a tiny
 * `localStorage` marker `{setlistId, songIndex}` whenever the URL is
 * inside `/performance/:setlistId/:songIndex` and clear it on URL exit.
 *
 * On boot (see `app-bootstrap.tsx`), if `window.location.pathname === '/'`
 * AND `readSessionMarker()` returns a marker, the boot flow performs
 * `navigate(...replace=true)` to the marked URL BEFORE first paint. The
 * mounted `performance-card.tsx` re-activates `performanceActive=true`
 * via its existing entry path — no new persistence in
 * `PerformanceModeContext`, no changes to Story 4.1 / 4.4 code paths.
 *
 * The Setlist + Song record caches already persist via the TanStack Query
 * IndexedDB persister (Story 2.4), so only the route marker needs to ride
 * the relaunch.
 *
 * All `localStorage` access is wrapped in `try/catch` — Safari private
 * mode forces a quota=0 store that throws on `setItem`. A failure here
 * is silent (no toast, no banner, no thrown error).
 */

export const STORAGE_KEY = 'gigbuddy_active_performance';

export interface SessionMarker {
  setlistId: string;
  songIndex: number;
}

/*
 * Match `/performance/:setlistId/:songIndex`. The pathname is the
 * runtime-typed URL string from React Router's `useLocation`; this
 * regex is intentionally strict — anything else (a stale `/performance`
 * without indices, a trailing fourth segment, etc.) drops the marker
 * rather than writing something we can't safely consume on the next
 * boot.
 */
const PERFORMANCE_PATH_RE = /^\/performance\/([^/]+)\/(\d+)$/;

function tryRemove(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // Silent — quota or access exception (Safari private mode).
  }
}

function tryWrite(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // Silent — quota or access exception (Safari private mode).
  }
}

function tryRead(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Parses the stored marker and returns it if shape-valid, otherwise
 * `null`. Schema mismatches (missing keys, wrong types, NaN songIndex)
 * resolve to `null` — the caller should NOT navigate when this happens
 * (the boot flow falls through to the normal `/` route).
 */
export function readSessionMarker(): SessionMarker | null {
  const raw = tryRead(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const setlistId = obj.setlistId;
    const songIndex = obj.songIndex;
    if (typeof setlistId !== 'string' || setlistId.length === 0) return null;
    if (typeof songIndex !== 'number' || !Number.isFinite(songIndex) || songIndex < 0) return null;
    return { setlistId, songIndex };
  } catch {
    return null;
  }
}

/**
 * Driven by URL changes (subscribed via `useLocation()` in a top-level
 * effect inside `AppBootstrap` / `AuthenticatedShell`). On any
 * `/performance/:setlistId/:songIndex` pathname this writes the marker;
 * on any other pathname it clears the marker. The writer is consistent
 * with `performanceActive` without coupling to context internals —
 * navigate-away (Story 4.4) ends performance state by changing the URL,
 * and that same URL change clears the marker here.
 */
export function syncSessionMarker(pathname: string): void {
  const match = PERFORMANCE_PATH_RE.exec(pathname);
  if (!match) {
    tryRemove(STORAGE_KEY);
    return;
  }
  const setlistId = match[1];
  const songIndexStr = match[2];
  if (setlistId === undefined || songIndexStr === undefined) {
    tryRemove(STORAGE_KEY);
    return;
  }
  const songIndex = Number.parseInt(songIndexStr, 10);
  if (!Number.isFinite(songIndex) || songIndex < 0) {
    tryRemove(STORAGE_KEY);
    return;
  }
  const marker: SessionMarker = { setlistId, songIndex };
  tryWrite(STORAGE_KEY, JSON.stringify(marker));
}

/**
 * Imperative one-shot clear — used when authentication is known to have
 * lapsed (e.g. the `/login` route's mount effect). The URL-driven writer
 * `syncSessionMarker` already removes the key whenever the pathname
 * leaves `/performance/...`, but a stale marker can still pin an
 * unauthenticated user to `/performance/...` on cold relaunch when the
 * writer never got a chance to run (e.g. logged-out shutdown). Idempotent.
 */
export function clearSessionMarker(): void {
  tryRemove(STORAGE_KEY);
}
