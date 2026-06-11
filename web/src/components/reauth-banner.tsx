import { useState } from 'react';
import { useAuth } from '../auth/auth-context.js';
import { isIPhone } from '../lib/platform.js';

const SHOW_THRESHOLD_DAYS = 30;

export function ReauthBanner() {
  const { auth } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (auth.status !== 'authenticated') return null;
  if (isIPhone()) return null;
  if (auth.daysUntilExpiry > SHOW_THRESHOLD_DAYS) return null;
  if (dismissed) return null;

  return (
    <div role="status" aria-live="polite">
      <span>Re-authenticate within {auth.daysUntilExpiry} days.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss re-authentication reminder"
      >
        Dismiss
      </button>
    </div>
  );
}
