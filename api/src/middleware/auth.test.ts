import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getJwtKeyMock } = vi.hoisted(() => ({ getJwtKeyMock: vi.fn() }));

vi.mock('../secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
}));

import { signSession } from '../auth/jwt.js';
import { authMiddleware, SESSION_COOKIE_NAME } from './auth.js';

const TEST_KEY = `test-key-${'x'.repeat(40)}`;

function buildApp() {
  return new Hono()
    .use('/api/v1/*', authMiddleware)
    .get('/api/v1/echo', (c) => c.json({ ok: true, sub: c.get('session').sub }))
    .get('/api/v1/health', (c) => c.json({ status: 'ok' as const }))
    .post('/api/v1/auth/login', (c) => c.json({ skipped: true }));
}

beforeEach(() => {
  getJwtKeyMock.mockReset();
  getJwtKeyMock.mockResolvedValue(TEST_KEY);
});

describe('authMiddleware', () => {
  it('returns 401 with the error envelope when no session cookie is present', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/echo');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      status: 'error',
      error: { code: 'UNAUTHORIZED', message: 'authentication required' },
    });
  });

  it('returns 401 when the session cookie value is garbage', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/echo', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=garbage` },
    });
    expect(res.status).toBe(401);
  });

  it('passes through and sets the session variable on a valid signed cookie', async () => {
    const app = buildApp();
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession(now);
    const res = await app.request('/api/v1/echo', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, sub: 'sandy' });
  });

  it('skips /api/v1/health without a cookie', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
  });

  it('skips /api/v1/auth/login without a cookie', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/auth/login', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: true });
  });
});
