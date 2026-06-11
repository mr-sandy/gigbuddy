import { LoginAppliedResponseSchema, MeResponseSchema } from '@gigbuddy/shared';
import type { AuthState } from './auth-context.js';

/**
 * Calls GET /api/v1/me. Distinguishes:
 *   - HTTP 200 → 'authenticated' (with daysUntilExpiry from the validated response)
 *   - HTTP 401 from a successful network round-trip → 'unauthenticated'
 *   - Network failure (fetch rejects) → 'unknown'  (AR-16)
 */
export async function fetchMe(): Promise<AuthState> {
  let res: Response;
  try {
    res = await fetch('/api/v1/me', { credentials: 'same-origin' });
  } catch {
    return { status: 'unknown' };
  }
  if (res.status === 401) return { status: 'unauthenticated' };
  if (res.status === 200) {
    try {
      const body = MeResponseSchema.parse(await res.json());
      return { status: 'authenticated', daysUntilExpiry: body.data.daysUntilExpiry };
    } catch {
      return { status: 'unknown' };
    }
  }
  // 5xx or unexpected — treat as unknown so the SPA still renders the shell.
  return { status: 'unknown' };
}

/** Returns true on accepted login, false on wrong password, throws on network failure. */
export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'same-origin',
  });
  if (res.status === 200) {
    LoginAppliedResponseSchema.parse(await res.json());
    return true;
  }
  if (res.status === 401) return false;
  throw new Error(`Unexpected login status ${res.status}`);
}
