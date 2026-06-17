import { Component, type ReactNode } from 'react';
import { reportError } from '../lib/error-reporter.js';
import { BANNERS } from '../lib/microcopy.js';

/*
 * React error boundary (architecture.md AR-39, line 766). Class component
 * is React's required shape — `componentDidCatch` + `getDerivedStateFromError`.
 *
 * On catch:
 *   - Renders the locked fallback copy (BANNERS.errorBoundary) — never the
 *     raw error text (architecture line 751).
 *   - Reports via the same pipeline as window.onerror.
 *
 * No retry button; Sandy reloads (V1 floor).
 */
interface State {
  hasError: boolean;
}

interface Props {
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: unknown): void {
    reportError({
      where: 'react-error-boundary',
      message: error.message,
      ...(error.stack !== undefined ? { stack: error.stack } : {}),
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" aria-live="assertive">
          {BANNERS.errorBoundary}
        </div>
      );
    }
    return this.props.children;
  }
}
