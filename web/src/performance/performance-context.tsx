import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/*
 * Canonical home for the Performance Mode state (architecture.md
 * "State management taxonomy" — React Context, not Redux/Zustand;
 * architecture lines 290–291, 1037).
 *
 * Read by sync, error, UI subsystems via `usePerformanceActive()`. Set by
 * Story 4.1 (Performance Mode entry) via `useStartPerformance` and by Story
 * 4.3 (× exit + Setlist overview strip wiring) via the session and view
 * setters added in this story.
 *
 * Non-React consumers (sync/flusher.ts, lib/error-reporter.ts) read the
 * value via the module-scope `getPerformanceActiveSnapshot()` accessor.
 * The Provider mirrors React state into the snapshot variable inside a
 * useEffect — the React state remains the source of truth; the snapshot
 * is a read-only mirror.
 *
 * Story 4.3 extension — `activeSetlistId` and `activeSongIndex` track the
 * Setlist + Song position so the `CurrentlyPerformingStrip` knows which
 * song to display and where `Resume ›` should navigate. `performanceView`
 * resolves the chrome-visibility conflict on the active Setlist overview:
 * the bottom tab bar is suppressed on the Performance Card but reappears
 * on the active Setlist overview after × exit (FR-19, epics.md Story 4.3
 * spec). `useChromeVisible()` reads both `performanceActive` and
 * `performanceView` to decide.
 */

type PerformanceView = 'card' | 'overview' | null;

interface PerformanceModeContextValue {
  performanceActive: boolean;
  setActive: (active: boolean) => void;
  activeSetlistId: string | null;
  activeSongIndex: number;
  // Story 4.4: `setlistId` is `string | null` so end-state cleanup can
  // reset the session pointer alongside `setActive(false)`. Existing
  // callers (`useStartPerformance`) pass a string at entry — no regression.
  setPerformanceSession: (setlistId: string | null, songIndex: number) => void;
  setActiveSongIndex: (songIndex: number) => void;
  performanceView: PerformanceView;
  setPerformanceView: (view: PerformanceView) => void;
  // Story 6.5 — detour override promoted out of PerformanceCard's local
  // state so `Resume ›` from the Currently-performing strip can preserve
  // the detour across the × exit / route remount (AC-6). `null` means "on
  // plan cursor"; a non-null songId means the card is displaying that
  // song instead of the plan-cursor song. Reset to `null` by
  // `setPerformanceSession()` (session boundary).
  activeDetourSongId: string | null;
  setActiveDetourSongId: (songId: string | null) => void;
}

const PerformanceModeContext = createContext<PerformanceModeContextValue | null>(null);

let snapshotPerformanceActive = false;

export function getPerformanceActiveSnapshot(): boolean {
  return snapshotPerformanceActive;
}

export function PerformanceModeProvider({ children }: { children: ReactNode }) {
  const [performanceActive, setPerformanceActive] = useState(false);
  const [activeSetlistId, setActiveSetlistIdState] = useState<string | null>(null);
  const [activeSongIndex, setActiveSongIndexState] = useState<number>(0);
  const [performanceView, setPerformanceViewState] = useState<PerformanceView>(null);
  const [activeDetourSongId, setActiveDetourSongIdState] = useState<string | null>(null);

  const setActive = useCallback((active: boolean) => {
    setPerformanceActive(active);
  }, []);
  const setPerformanceSession = useCallback((setlistId: string | null, songIndex: number) => {
    setActiveSetlistIdState(setlistId);
    setActiveSongIndexState(songIndex);
    // Story 6.5 — a session boundary (fresh `Start performance ›` or an
    // ended session) must never inherit a leftover detour override from
    // a prior session. Reset here — this is deliberately NOT in
    // `setActiveSongIndex()` because that setter mirrors the URL on
    // every within-mount plan-cursor change, and clearing detour there
    // would defeat the "Resume › preserves detour" requirement (AC-6).
    setActiveDetourSongIdState(null);
  }, []);
  const setActiveSongIndex = useCallback((songIndex: number) => {
    setActiveSongIndexState(songIndex);
  }, []);
  const setPerformanceView = useCallback((view: PerformanceView) => {
    setPerformanceViewState(view);
  }, []);
  const setActiveDetourSongId = useCallback((songId: string | null) => {
    setActiveDetourSongIdState(songId);
  }, []);

  useEffect(() => {
    snapshotPerformanceActive = performanceActive;
  }, [performanceActive]);
  const value = useMemo(
    () => ({
      performanceActive,
      setActive,
      activeSetlistId,
      activeSongIndex,
      setPerformanceSession,
      setActiveSongIndex,
      performanceView,
      setPerformanceView,
      activeDetourSongId,
      setActiveDetourSongId,
    }),
    [
      performanceActive,
      setActive,
      activeSetlistId,
      activeSongIndex,
      setPerformanceSession,
      setActiveSongIndex,
      performanceView,
      setPerformanceView,
      activeDetourSongId,
      setActiveDetourSongId,
    ],
  );
  return (
    <PerformanceModeContext.Provider value={value}>{children}</PerformanceModeContext.Provider>
  );
}

function useCtx(): PerformanceModeContextValue {
  const ctx = useContext(PerformanceModeContext);
  if (!ctx) throw new Error('PerformanceMode hooks must be used inside <PerformanceModeProvider>');
  return ctx;
}

export function usePerformanceActive(): boolean {
  return useCtx().performanceActive;
}

export function useSetPerformanceActive(): (active: boolean) => void {
  return useCtx().setActive;
}

/*
 * Story 4.3 — session and view hooks.
 *
 * `useActivePerformanceSession()` returns the current session pointer
 * (which Setlist is being performed + which Song index was last active).
 * `useSetActivePerformanceSession()` updates both at once (used on
 * Performance Mode entry). `useSetActiveSongIndex()` updates only the
 * Song index (used on song-to-song navigation inside the card).
 *
 * `usePerformanceView()` / `useSetPerformanceView()` track whether the
 * user is currently on the Performance Card (`'card'`) or the active
 * Setlist overview (`'overview'`). The chrome visibility hook reads this
 * to keep tabs visible on the overview even though `performanceActive`
 * remains true.
 */
export function useActivePerformanceSession(): {
  activeSetlistId: string | null;
  activeSongIndex: number;
} {
  const { activeSetlistId, activeSongIndex } = useCtx();
  return { activeSetlistId, activeSongIndex };
}

export function useSetActivePerformanceSession(): (
  setlistId: string | null,
  songIndex: number,
) => void {
  return useCtx().setPerformanceSession;
}

/*
 * Story 4.4 — convenience hook returning a stable callback that resets the
 * session pointer (activeSetlistId → null, activeSongIndex → 0). Used by
 * `usePerformanceEnd()` to clear the session as part of end-state cleanup
 * so a subsequent `Start performance ›` on the same or a different Setlist
 * starts from a clean slate.
 */
export function useResetPerformanceSession(): () => void {
  const { setPerformanceSession } = useCtx();
  return useCallback(() => {
    setPerformanceSession(null, 0);
  }, [setPerformanceSession]);
}

export function useSetActiveSongIndex(): (songIndex: number) => void {
  return useCtx().setActiveSongIndex;
}

export function usePerformanceView(): PerformanceView {
  return useCtx().performanceView;
}

export function useSetPerformanceView(): (view: PerformanceView) => void {
  return useCtx().setPerformanceView;
}

/*
 * Story 6.5 — detour override hooks. `useActiveDetourSongId()` returns
 * the id of the song the Performance Card is currently displaying as a
 * detour (or `null` when Sandy is on the plan cursor). Read on the
 * Performance Card (to swap the position slot to `DETOUR` and to change
 * the `‹` button's behaviour) and on the Setlist overview (to render the
 * italic + `↩` detour signal on the Currently-performing strip). Written
 * by `PerformanceCard`'s jump-overlay callback + within-mount clearing
 * effect. Session-boundary reset lives inside `setPerformanceSession()`
 * (see the Provider). Reasoning for the promotion: `Resume ›` from the
 * strip remounts `PerformanceCard`, and the override must survive that
 * remount — component-local state is gone. See Story 6.5 spec Dev Notes
 * "Why this story is 'plan-cursor persistence'" for the full rationale.
 */
export function useActiveDetourSongId(): string | null {
  return useCtx().activeDetourSongId;
}

export function useSetActiveDetourSongId(): (songId: string | null) => void {
  return useCtx().setActiveDetourSongId;
}
