import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceModeProvider } from '../performance/performance-context.js';
import {
  __resetStaleNoticeForTests,
  getStaleNotice,
  setStaleNotice,
} from './stale-notice-store.js';
import { StaleWriteBanner } from './stale-write-banner.js';

const { isIPhoneMock, usePerformanceActiveMock } = vi.hoisted(() => ({
  isIPhoneMock: vi.fn(),
  usePerformanceActiveMock: vi.fn(),
}));

vi.mock('../lib/platform.js', () => ({
  isIPhone: isIPhoneMock,
}));

vi.mock('../performance/performance-context.js', async () => {
  const actual = await vi.importActual<typeof import('../performance/performance-context.js')>(
    '../performance/performance-context.js',
  );
  return {
    ...actual,
    usePerformanceActive: usePerformanceActiveMock,
  };
});

beforeEach(() => {
  __resetStaleNoticeForTests();
  isIPhoneMock.mockReset();
  isIPhoneMock.mockReturnValue(false);
  usePerformanceActiveMock.mockReset();
  usePerformanceActiveMock.mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderBanner() {
  return render(
    <PerformanceModeProvider>
      <StaleWriteBanner />
    </PerformanceModeProvider>,
  );
}

describe('StaleWriteBanner', () => {
  it('renders the locked copy when a notice is set and we are MacBook + not in performance mode', () => {
    setStaleNotice({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    renderBanner();
    expect(screen.getByRole('status')).toHaveTextContent('Your earlier edit was superseded.');
  });

  it('renders nothing when no notice is set', () => {
    renderBanner();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides on iPhone regardless of notice (FR-30 silent on iPhone)', () => {
    isIPhoneMock.mockReturnValue(true);
    setStaleNotice({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    renderBanner();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides when performanceActive is true (AR-28)', () => {
    usePerformanceActiveMock.mockReturnValue(true);
    setStaleNotice({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    renderBanner();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('the dismiss button clears the notice', async () => {
    const user = userEvent.setup();
    setStaleNotice({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    renderBanner();
    expect(screen.getByRole('status')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(getStaleNotice()).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
