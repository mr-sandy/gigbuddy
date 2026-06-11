import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

/*
 * Canonical home for the `performanceActive` flag (architecture.md
 * "State management taxonomy" — React Context, not Redux/Zustand).
 *
 * Read by sync, error, UI subsystems via `usePerformanceActive()`. Set by
 * Story 4.1 (Performance Mode entry) and Story 4.3 (× exit) via
 * `useSetPerformanceActive()`. Story 1.5 only PROVIDES the seam — the live
 * setter is not wired into any handler yet, so `performanceActive` stays
 * `false` for the entirety of Epic 1.
 */

interface PerformanceModeContextValue {
  performanceActive: boolean;
  setActive: (active: boolean) => void;
}

const PerformanceModeContext = createContext<PerformanceModeContextValue | null>(null);

export function PerformanceModeProvider({ children }: { children: ReactNode }) {
  const [performanceActive, setPerformanceActive] = useState(false);
  const setActive = useCallback((active: boolean) => {
    setPerformanceActive(active);
  }, []);
  const value = useMemo(() => ({ performanceActive, setActive }), [performanceActive, setActive]);
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
