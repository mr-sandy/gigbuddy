import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthState } from '../auth/auth-context.js';
import { ReauthBanner } from './reauth-banner.js';

const { isIPhoneMock } = vi.hoisted(() => ({ isIPhoneMock: vi.fn() }));

vi.mock('../lib/platform.js', () => ({
  isIPhone: isIPhoneMock,
}));

beforeEach(() => {
  isIPhoneMock.mockReset();
  isIPhoneMock.mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderWith(auth: AuthState) {
  return render(
    <AuthProvider initial={auth}>
      <ReauthBanner />
    </AuthProvider>,
  );
}

describe('ReauthBanner', () => {
  it('shows the banner at the 30-day threshold', () => {
    renderWith({ status: 'authenticated', daysUntilExpiry: 30 });
    expect(screen.getByRole('status')).toHaveTextContent('Re-authenticate within 30 days.');
  });

  it('shows the banner near expiry', () => {
    renderWith({ status: 'authenticated', daysUntilExpiry: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('Re-authenticate within 1 days.');
  });

  it('hides above the threshold', () => {
    renderWith({ status: 'authenticated', daysUntilExpiry: 31 });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides on iPhone regardless of days', () => {
    isIPhoneMock.mockReturnValue(true);
    renderWith({ status: 'authenticated', daysUntilExpiry: 5 });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides after the dismiss button is clicked', async () => {
    const user = userEvent.setup();
    renderWith({ status: 'authenticated', daysUntilExpiry: 5 });
    expect(screen.getByRole('status')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides when auth.status is not authenticated', () => {
    renderWith({ status: 'unknown' });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
