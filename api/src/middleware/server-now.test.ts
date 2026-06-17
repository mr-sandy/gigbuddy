import type { ErrorResponse } from '@gigbuddy/shared';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { serverNowMiddleware } from './server-now.js';

const unauthorized: ErrorResponse = {
  status: 'error',
  error: { code: 'UNAUTHORIZED', message: 'authentication required' },
};

function buildApp() {
  return new Hono()
    .use('*', serverNowMiddleware)
    .get('/ok', (c) => c.json({ status: 'ok' as const }))
    .get('/unauth', (c) => c.json(unauthorized, 401))
    .get('/server-error', (c) => c.json({ status: 'error' as const }, 500));
}

function isValidIsoRoundtrip(value: string): boolean {
  return new Date(value).toISOString() === value;
}

describe('serverNowMiddleware', () => {
  it('adds the x-server-now header on a 200 response', async () => {
    const res = await buildApp().request('/ok');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-server-now')).toBeTruthy();
  });

  it('adds the x-server-now header on a 401 response', async () => {
    const res = await buildApp().request('/unauth');
    expect(res.status).toBe(401);
    expect(res.headers.get('x-server-now')).toBeTruthy();
  });

  it('adds the x-server-now header on a 5xx response', async () => {
    const res = await buildApp().request('/server-error');
    expect(res.status).toBe(500);
    expect(res.headers.get('x-server-now')).toBeTruthy();
  });

  it('emits a valid ISO-8601 datetime that roundtrips through Date', async () => {
    const res = await buildApp().request('/ok');
    const value = res.headers.get('x-server-now');
    expect(value).toBeTruthy();
    expect(isValidIsoRoundtrip(value as string)).toBe(true);
  });

  it('emits a header value within 5 seconds of the test wallclock', async () => {
    const before = Date.now();
    const res = await buildApp().request('/ok');
    const after = Date.now();
    const value = res.headers.get('x-server-now') as string;
    const serverNow = new Date(value).getTime();
    expect(serverNow).toBeGreaterThanOrEqual(before - 5_000);
    expect(serverNow).toBeLessThanOrEqual(after + 5_000);
  });
});
