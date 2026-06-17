import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPerformanceActiveSnapshot,
  PerformanceModeProvider,
  usePerformanceActive,
  useSetPerformanceActive,
} from './performance-context.js';

function Reader({ label }: { label: string }) {
  const active = usePerformanceActive();
  return <span data-testid={label}>{active ? 'on' : 'off'}</span>;
}

function Toggle() {
  const setActive = useSetPerformanceActive();
  return (
    <button type="button" onClick={() => setActive(true)}>
      activate
    </button>
  );
}

describe('PerformanceModeContext', () => {
  it('exposes performanceActive=false by default', () => {
    render(
      <PerformanceModeProvider>
        <Reader label="one" />
      </PerformanceModeProvider>,
    );
    expect(screen.getByTestId('one')).toHaveTextContent('off');
  });

  it('flips the value for all consumers when the setter is invoked', async () => {
    const user = userEvent.setup();
    render(
      <PerformanceModeProvider>
        <Reader label="one" />
        <Toggle />
        <Reader label="two" />
      </PerformanceModeProvider>,
    );
    expect(screen.getByTestId('one')).toHaveTextContent('off');
    expect(screen.getByTestId('two')).toHaveTextContent('off');
    await user.click(screen.getByRole('button', { name: 'activate' }));
    expect(screen.getByTestId('one')).toHaveTextContent('on');
    expect(screen.getByTestId('two')).toHaveTextContent('on');
  });

  describe('outside <PerformanceModeProvider>', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      // React logs the thrown error via console.error; suppress it for clean test output.
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('usePerformanceActive throws the documented error', () => {
      expect(() => render(<Reader label="solo" />)).toThrow(/inside <PerformanceModeProvider>/);
    });

    it('useSetPerformanceActive throws the documented error', () => {
      expect(() => render(<Toggle />)).toThrow(/inside <PerformanceModeProvider>/);
    });
  });

  describe('getPerformanceActiveSnapshot (non-React surface)', () => {
    it('mirrors the React state into the module-scope snapshot when setActive flips', async () => {
      const user = userEvent.setup();
      render(
        <PerformanceModeProvider>
          <Toggle />
        </PerformanceModeProvider>,
      );
      // Before the toggle fires, the snapshot reflects the provider's initial
      // value (false). Reading immediately after first paint is sufficient
      // because the snapshot-sync useEffect runs synchronously after mount.
      expect(getPerformanceActiveSnapshot()).toBe(false);
      await user.click(screen.getByRole('button', { name: 'activate' }));
      expect(getPerformanceActiveSnapshot()).toBe(true);
    });
  });

  it('keeps the setter identity stable across renders (useCallback contract)', () => {
    const seen = new Set<unknown>();
    function SetterProbe() {
      const setActive = useSetPerformanceActive();
      seen.add(setActive);
      return null;
    }
    const { rerender } = render(
      <PerformanceModeProvider>
        <SetterProbe />
      </PerformanceModeProvider>,
    );
    rerender(
      <PerformanceModeProvider>
        <SetterProbe />
      </PerformanceModeProvider>,
    );
    expect(seen.size).toBe(1);
  });
});
