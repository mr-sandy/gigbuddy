import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './error-boundary.js';

const { reportErrorMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn() }));

vi.mock('../lib/error-reporter.js', () => ({
  reportError: reportErrorMock,
}));

function Boom(): never {
  throw new Error('boundary-test');
}

beforeEach(() => {
  reportErrorMock.mockReset();
  // React logs caught errors via console.error — suppress to keep output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children in the happy path', () => {
    render(
      <ErrorBoundary>
        <span>ok</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('catches a child render error, renders the locked fallback, and reports', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try refreshing.');
    expect(reportErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: 'react-error-boundary', message: 'boundary-test' }),
    );
  });
});
