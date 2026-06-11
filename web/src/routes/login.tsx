import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchMe, login } from '../auth/auth-api.js';
import { useAuth } from '../auth/auth-context.js';

export function Login() {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

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
