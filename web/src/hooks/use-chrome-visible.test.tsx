import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  PerformanceModeProvider,
  useSetPerformanceActive,
} from '../performance/performance-context.js';
import { useChromeVisible } from './use-chrome-visible.js';

function ChromeProbe() {
  const visible = useChromeVisible();
  return <span data-testid="chrome">{visible ? 'shown' : 'hidden'}</span>;
}

function ActivateButton() {
  const setActive = useSetPerformanceActive();
  return (
    <button type="button" onClick={() => setActive(true)}>
      enter performance
    </button>
  );
}

describe('useChromeVisible', () => {
  it('returns true when Performance Mode is inactive (Epic 1 default)', () => {
    render(
      <PerformanceModeProvider>
        <ChromeProbe />
      </PerformanceModeProvider>,
    );
    expect(screen.getByTestId('chrome')).toHaveTextContent('shown');
  });

  it('returns false once useSetPerformanceActive(true) is called', async () => {
    const user = userEvent.setup();
    render(
      <PerformanceModeProvider>
        <ChromeProbe />
        <ActivateButton />
      </PerformanceModeProvider>,
    );
    expect(screen.getByTestId('chrome')).toHaveTextContent('shown');
    await user.click(screen.getByRole('button', { name: 'enter performance' }));
    expect(screen.getByTestId('chrome')).toHaveTextContent('hidden');
  });
});
