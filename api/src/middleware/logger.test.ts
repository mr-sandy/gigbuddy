import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loggerMiddleware } from './logger.js';

function buildApp() {
  return new Hono().use('*', loggerMiddleware).get('/ping', (c) => c.json({ pong: true }));
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
});

function lastLogLine(): Record<string, unknown> {
  const lastCall = logSpy.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  expect(typeof lastCall?.[0]).toBe('string');
  return JSON.parse(lastCall?.[0] as string) as Record<string, unknown>;
}

describe('loggerMiddleware', () => {
  it('emits a JSON line with method, path, status, durationMs', async () => {
    const app = buildApp();
    await app.request('/ping');
    const line = lastLogLine();
    expect(line.method).toBe('GET');
    expect(line.path).toBe('/ping');
    expect(line.status).toBe(200);
    expect(typeof line.durationMs).toBe('number');
  });

  it('redacts the gigbuddy_session cookie header to [REDACTED]', async () => {
    const app = buildApp();
    await app.request('/ping', {
      headers: { Cookie: 'gigbuddy_session=secret-value' },
    });
    const line = lastLogLine();
    const headers = line.headers as Record<string, unknown>;
    expect(headers.cookie).toBe('[REDACTED]');
  });

  it('redacts authorization headers case-insensitively', async () => {
    const app = buildApp();
    await app.request('/ping', { headers: { Authorization: 'Bearer x' } });
    const headers = lastLogLine().headers as Record<string, unknown>;
    expect(headers.authorization).toBe('[REDACTED]');
  });

  it('does not redact unrelated headers', async () => {
    const app = buildApp();
    await app.request('/ping', { headers: { 'x-trace-id': 'abc123' } });
    const headers = lastLogLine().headers as Record<string, unknown>;
    expect(headers['x-trace-id']).toBe('abc123');
  });
});
