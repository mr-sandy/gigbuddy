import { ClientErrorReportSchema } from '@gigbuddy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetErrorReporterForTests, reportError, startErrorReporter } from './error-reporter.js';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(null, {
      status: 204,
      headers: { 'x-server-now': new Date().toISOString() },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  __resetErrorReporterForTests();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('startErrorReporter', () => {
  it('POSTs a parseable ClientErrorReport on window error events', async () => {
    const unsub = startErrorReporter();
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'boom',
        error: Object.assign(new Error('boom'), { stack: 'stacktrace' }),
      }),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(() => ClientErrorReportSchema.parse(body)).not.toThrow();
    expect(body).toMatchObject({ where: 'window.onerror', message: 'boom' });
    unsub();
  });

  it('POSTs on unhandledrejection events with the reason message', async () => {
    const unsub = startErrorReporter();
    const rejectionEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejectionEvent, 'reason', {
      value: { message: 'rejected', stack: 'rstack' },
    });
    window.dispatchEvent(rejectionEvent);
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ where: 'unhandledrejection', message: 'rejected' });
    unsub();
  });

  it('is idempotent (calling twice only installs one listener)', async () => {
    const unsub1 = startErrorReporter();
    const unsub2 = startErrorReporter();
    window.dispatchEvent(new ErrorEvent('error', { message: 'once' }));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unsub1();
    unsub2();
  });

  it('does NOT raise when the POST itself fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const unsub = startErrorReporter();
    expect(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'silent' }));
    }).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    unsub();
  });

  it('reportError() exposes the same send pipeline as the listeners', async () => {
    reportError({ where: 'manual', message: 'hi' });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.where).toBe('manual');
  });
});
