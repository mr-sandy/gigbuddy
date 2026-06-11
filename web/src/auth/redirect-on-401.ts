/**
 * Encapsulates the "should we redirect to /login on a 401" decision.
 * In Story 1.4 the call sites pass performanceActive=false. Story 1.5
 * introduces PerformanceModeContext and Story 4.1 sets the flag true;
 * neither needs to modify this file — they pass the live value here.
 */
export function shouldRedirectOn401(args: {
  performanceActive: boolean;
  wasNetworkSuccess: boolean;
}): boolean {
  if (!args.wasNetworkSuccess) return false; // offline-cache 401 must not redirect
  if (args.performanceActive) return false; // AR-28 invariant
  return true;
}

/** Placeholder hook until Story 1.5 introduces PerformanceModeContext. */
export function usePerformanceActive(): boolean {
  return false;
}
