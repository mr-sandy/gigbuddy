import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPerformanceActiveSnapshot,
  PerformanceModeProvider,
  useActiveDetourSongId,
  usePerformanceActive,
  useSetActiveDetourSongId,
  useSetActivePerformanceSession,
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

  /*
   * Story 6.5 — `activeDetourSongId` + session-boundary reset.
   */
  describe('activeDetourSongId (Story 6.5)', () => {
    function DetourReader({ label }: { label: string }) {
      const value = useActiveDetourSongId();
      return <span data-testid={label}>{value ?? 'null'}</span>;
    }

    function SetDetour({ songId }: { songId: string | null }) {
      const setDetour = useSetActiveDetourSongId();
      return (
        <button type="button" onClick={() => setDetour(songId)}>
          set-detour
        </button>
      );
    }

    function StartSession() {
      const setSession = useSetActivePerformanceSession();
      return (
        <button type="button" onClick={() => setSession('setlistid0000001', 0)}>
          start-session
        </button>
      );
    }

    it('defaults to null', () => {
      render(
        <PerformanceModeProvider>
          <DetourReader label="a" />
        </PerformanceModeProvider>,
      );
      expect(screen.getByTestId('a')).toHaveTextContent('null');
    });

    it('the setter updates the value for all consumers', async () => {
      const user = userEvent.setup();
      render(
        <PerformanceModeProvider>
          <DetourReader label="a" />
          <SetDetour songId="song0000000099zz" />
          <DetourReader label="b" />
        </PerformanceModeProvider>,
      );
      expect(screen.getByTestId('a')).toHaveTextContent('null');
      expect(screen.getByTestId('b')).toHaveTextContent('null');
      await user.click(screen.getByRole('button', { name: 'set-detour' }));
      expect(screen.getByTestId('a')).toHaveTextContent('song0000000099zz');
      expect(screen.getByTestId('b')).toHaveTextContent('song0000000099zz');
    });

    it('setPerformanceSession resets activeDetourSongId back to null after it was set', async () => {
      const user = userEvent.setup();
      render(
        <PerformanceModeProvider>
          <DetourReader label="a" />
          <SetDetour songId="song0000000099zz" />
          <StartSession />
        </PerformanceModeProvider>,
      );
      await user.click(screen.getByRole('button', { name: 'set-detour' }));
      expect(screen.getByTestId('a')).toHaveTextContent('song0000000099zz');
      await user.click(screen.getByRole('button', { name: 'start-session' }));
      expect(screen.getByTestId('a')).toHaveTextContent('null');
    });

    it('keeps the setter identity stable across renders', () => {
      const seen = new Set<unknown>();
      function SetterProbe() {
        const setDetour = useSetActiveDetourSongId();
        seen.add(setDetour);
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
});
