import { sign } from 'hono/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getJwtKeyMock } = vi.hoisted(() => ({ getJwtKeyMock: vi.fn() }));

vi.mock('../secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
  getPasswordHash: vi.fn(),
}));

import { app } from '../app.js';
import { COOKIE_MAX_AGE_SECONDS, signSession } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

const TEST_KEY = `test-key-${'x'.repeat(40)}`;

beforeEach(() => {
  getJwtKeyMock.mockReset();
  getJwtKeyMock.mockResolvedValue(TEST_KEY);
});

describe('GET /api/v1/me', () => {
  it('returns 401 when no session cookie is present', async () => {
    const res = await app.request('/api/v1/me');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'error', error: { code: 'UNAUTHORIZED' } });
  });

  it('returns {authenticated:true, daysUntilExpiry≈365} for a fresh signed cookie', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession(now);
    const res = await app.request('/api/v1/me', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      data: { authenticated: boolean; daysUntilExpiry: number };
    };
    expect(body.status).toBe('ok');
    expect(body.data.authenticated).toBe(true);
    // 365 days ± a small drift (test wallclock vs. computed `now`).
    expect(body.data.daysUntilExpiry).toBeGreaterThanOrEqual(364);
    expect(body.data.daysUntilExpiry).toBeLessThanOrEqual(365);
  });

  it('returns 401 for an expired cookie', async () => {
    const past = Math.floor(Date.now() / 1000) - COOKIE_MAX_AGE_SECONDS - 10;
    const expired = await sign({ sub: 'sandy', iat: past, exp: past + 60 }, TEST_KEY, 'HS256');
    const res = await app.request('/api/v1/me', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${expired}` },
    });
    expect(res.status).toBe(401);
  });
});
