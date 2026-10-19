/**
 * Encapsulates the "should we redirect to /login on a 401" decision.
 */
export function shouldRedirectOn401(args: { wasNetworkSuccess: boolean }): boolean {
  if (!args.wasNetworkSuccess) return false; // offline-cache 401 must not redirect
  return true;
}
