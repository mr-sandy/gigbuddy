import { describe, expect, it } from 'vitest';
import { app } from '../app.js';

describe('GET /api/v1/health', () => {
  it('returns {status: "ok"} with HTTP 200 when called without auth', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
