import { type ClientErrorReport, ClientErrorReportSchema } from '@gigbuddy/shared';
import { z } from 'zod';
import { apiFetch } from '../api/client.js';
import { getPerformanceActiveSnapshot } from '../performance/performance-context.js';

/*
 * Client-side error reporter (architecture.md AR-39, "Logging" §, lines
 * 755–766). Three sources feed `POST /api/v1/client-errors`:
 *   - window 'error' (uncaught JS exceptions)
 *   - window 'unhandledrejection' (unhandled promise rejections)
 *   - React <ErrorBoundary> (componentDidCatch)
 *
 * Failure of the POST is itself silent. The reporter MUST NOT raise an
 * error from inside its own pipeline — that would be reentrant.
 */

let started = false;

function send(input: { where: string; message: string; stack?: string }): void {
  const payload: ClientErrorReport = {
    where: input.where,
    message: input.message,
    ...(input.stack !== undefined ? { stack: input.stack } : {}),
    performanceActive: getPerformanceActiveSnapshot(),
    timestamp: new Date().toISOString(),
  };
  try {
    ClientErrorReportSchema.parse(payload);
  } catch {
    // A schema violation in the reporter itself is non-fatal — never crash
    // out of the boundary error path.
    return;
  }
  apiFetch('/api/v1/client-errors', {
    method: 'POST',
    body: payload,
    schema: z.unknown(),
  }).catch(() => {
    // Silent — architecture line 766.
  });
}

export function reportError(input: { where: string; message: string; stack?: string }): void {
  send(input);
}

export function startErrorReporter(): () => void {
  if (started) return () => {};
  started = true;
  const onError = (e: ErrorEvent): void => {
    send({
      where: 'window.onerror',
      message: e.message || 'unknown error',
      ...(e.error?.stack ? { stack: e.error.stack as string } : {}),
    });
  };
  const onRejection = (e: PromiseRejectionEvent): void => {
    const reason = e.reason as { message?: string; stack?: string } | string | undefined;
    const message =
      typeof reason === 'string' ? reason : (reason?.message ?? 'unhandled rejection');
    const stack = typeof reason === 'object' && reason !== null ? reason.stack : undefined;
    send({
      where: 'unhandledrejection',
      message,
      ...(stack !== undefined ? { stack } : {}),
    });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    started = false;
  };
}

/** Test-only — resets the started flag between cases. */
export function __resetErrorReporterForTests(): void {
  started = false;
}
