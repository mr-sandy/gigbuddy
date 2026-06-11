/**
 * Encapsulates the "should we redirect to /login on a 401" decision.
 * Call sites pass the live `performanceActive` from PerformanceModeContext
 * (Story 1.5 owns the provider). Story 4.1 will flip the flag to true; this
 * function returns false in that case per AR-28 (no auth-failure redirects
 * during Performance Mode).
 */
export function shouldRedirectOn401(args: {
  performanceActive: boolean;
  wasNetworkSuccess: boolean;
}): boolean {
  if (!args.wasNetworkSuccess) return false; // offline-cache 401 must not redirect
  if (args.performanceActive) return false; // AR-28 invariant
  return true;
}
