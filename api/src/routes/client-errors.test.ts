import type { ClientErrorReport } from '@gigbuddy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getJwtKeyMock } = vi.hoisted(() => ({ getJwtKeyMock: vi.fn() }));

vi.mock('../secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
  getPasswordHash: vi.fn(),
}));

import { app } from '../app.js';
import { signSession } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

const TEST_KEY = `test-key-${'x'.repeat(40)}`;
let authCookie: string;
let logSpy: ReturnType<typeof vi.spyOn>;

const validPayload: ClientErrorReport = {
  where: 'window.onerror',
  message: 'TypeError: foo is undefined',
  stack: 'at handleClick (button.tsx:42)',
  performanceActive: false,
  timestamp: '2026-06-16T12:34:56.789Z',
};

beforeEach(async () => {
  getJwtKeyMock.mockReset();
  getJwtKeyMock.mockResolvedValue(TEST_KEY);
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession(now);
  authCookie = `${SESSION_COOKIE_NAME}=${token}`;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
});

function jsonLines(): Record<string, unknown>[] {
  return logSpy.mock.calls
    .map((c) => c[0])
    .filter((v): v is string => typeof v === 'string')
    .map((s) => {
      try {
        return JSON.parse(s) as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    });
}

async function authedPost(body: string): Promise<Response> {
  return app.request('/api/v1/client-errors', {
    method: 'POST',
    headers: { Cookie: authCookie, 'content-type': 'application/json' },
    body,
  });
}

function isIso(v: string | null): boolean {
  return !!v && new Date(v).toISOString() === v;
}

describe('POST /api/v1/client-errors', () => {
  it('returns 204 No Content with an empty body on a valid payload', async () => {
    const res = await authedPost(JSON.stringify(validPayload));
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe('');
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
  });

  it('emits one structured log line at level=error with the payload fields', async () => {
    await authedPost(JSON.stringify(validPayload));
    const errorLine = jsonLines().find((l) => l.level === 'error' && l.msg === 'client-error');
    expect(errorLine).toBeDefined();
    expect(errorLine).toMatchObject({
      level: 'error',
      msg: 'client-error',
      where: validPayload.where,
      message: validPayload.message,
      stack: validPayload.stack,
      performanceActive: validPayload.performanceActive,
      timestamp: validPayload.timestamp,
    });
  });

  it('returns 400 and emits a warn-level log line on a malformed payload (missing where)', async () => {
    const { where: _w, ...invalid } = validPayload;
    const res = await authedPost(JSON.stringify(invalid));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');

    const lines = jsonLines();
    const warnLine = lines.find(
      (l) => l.level === 'warn' && l.msg === 'client-errors malformed payload',
    );
    expect(warnLine).toBeDefined();
    const errorLine = lines.find((l) => l.msg === 'client-error');
    expect(errorLine).toBeUndefined();
  });

  it('returns 400 on a non-JSON body and logs at warn level', async () => {
    const res = await app.request('/api/v1/client-errors', {
      method: 'POST',
      headers: { Cookie: authCookie, 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const lines = jsonLines();
    expect(
      lines.some((l) => l.level === 'warn' && l.msg === 'client-errors malformed payload'),
    ).toBe(true);
  });

  it('carries x-server-now on the 400 response', async () => {
    const res = await authedPost('{}');
    expect(res.status).toBe(400);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
  });
});
