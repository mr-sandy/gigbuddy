import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchMe, login } from '../auth/auth-api.js';
import { useAuth } from '../auth/auth-context.js';
import { clearSessionMarker } from '../performance/session-resume.js';

export function Login() {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  // Story 4.5 (AC-13 follow-up) — landing on `/login` means the prior
  // session is no longer authenticated; clear any stale session-resume
  // marker so the next cold relaunch doesn't trap an unauthenticated
  // user in a `/login`-redirect loop via the marker-driven URL rewrite
  // in `main.tsx`. Idempotent — `localStorage.removeItem` is a no-op
  // when the key is absent.
  useEffect(() => {
    clearSessionMarker();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ok = await login(password);
      if (!ok) {
        setError('Wrong password.');
        setSubmitting(false);
        return;
      }
      // Cookie is set server-side. Re-probe /me to fill AuthContext
      // with the freshly-issued daysUntilExpiry value.
      const next = await fetchMe();
      if (next.status === 'authenticated') {
        setAuth(next);
        navigate('/');
      } else {
        setError('Service unavailable.');
        setSubmitting(false);
      }
    } catch {
      setError('Service unavailable.');
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>GigBuddy</h1>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting || password.length === 0}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        {error && (
          <p role="alert" aria-live="polite">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
