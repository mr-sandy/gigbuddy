import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMe, login } from './auth-api.js';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchMe', () => {
  it('returns authenticated with daysUntilExpiry on 200 with a valid body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
    );
    const result = await fetchMe();
    expect(result).toEqual({ status: 'authenticated', daysUntilExpiry: 365 });
  });

  it('returns unknown on a 200 with an invalid body shape', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { wrong: 'shape' }));
    const result = await fetchMe();
    expect(result).toEqual({ status: 'unknown' });
  });

  it('returns unauthenticated on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const result = await fetchMe();
    expect(result).toEqual({ status: 'unauthenticated' });
  });

  it('returns unknown when fetch rejects (offline-cache distinction)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const result = await fetchMe();
    expect(result).toEqual({ status: 'unknown' });
  });

  it('returns unknown on an unexpected 5xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const result = await fetchMe();
    expect(result).toEqual({ status: 'unknown' });
  });
});

describe('login', () => {
  it('returns true on 200 with applied body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'applied' }));
    const result = await login('correct');
    expect(result).toBe(true);
  });

  it('returns false on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const result = await login('wrong');
    expect(result).toBe(false);
  });

  it('throws on an unexpected status', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(login('whatever')).rejects.toThrow(/503/);
  });
});
