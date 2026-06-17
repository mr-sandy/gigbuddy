import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { __resetDriftWarningForTests, apiFetch, setUnauthorizedHandler } from './client.js';

const okSchema = z.object({ status: z.literal('ok'), data: z.object({ hello: z.string() }) });

function jsonRes(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function emptyRes(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  __resetDriftWarningForTests();
  setUnauthorizedHandler(null);
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('parses a 200 with x-server-now and reports wasNetworkSuccess=true', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes(
        200,
        { status: 'ok', data: { hello: 'world' } },
        { 'x-server-now': new Date().toISOString() },
      ),
    );
    const result = await apiFetch('/api/v1/test', { method: 'GET', schema: okSchema });
    expect(result.status).toBe(200);
    expect(result.wasNetworkSuccess).toBe(true);
    expect(result.data).toEqual({ status: 'ok', data: { hello: 'world' } });
  });

  it('logs a warn and marks wasNetworkSuccess=false when x-server-now is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: { hello: 'cache' } }));
    const result = await apiFetch('/api/v1/test', { method: 'GET', schema: okSchema });
    expect(result.wasNetworkSuccess).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('x-server-now header missing for /api/v1/test'),
    );
  });

  it('logs a clock-drift warn when |serverNow - Date.now()| exceeds 30s, once per session', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const skewed = new Date(Date.now() + 31_000).toISOString();
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, { status: 'ok', data: { hello: 'w' } }, { 'x-server-now': skewed }),
    );
    await apiFetch('/api/v1/test', { method: 'GET', schema: okSchema });
    expect(warnSpy).toHaveBeenCalledWith(
      'apiFetch: clock drift',
      expect.objectContaining({ path: '/api/v1/test' }),
    );
    // Second call with the same skew must NOT warn again (one-shot per session).
    warnSpy.mockClear();
    fetchMock.mockResolvedValueOnce(
      jsonRes(
        200,
        { status: 'ok', data: { hello: 'w' } },
        { 'x-server-now': new Date(Date.now() + 31_000).toISOString() },
      ),
    );
    await apiFetch('/api/v1/test', { method: 'GET', schema: okSchema });
    expect(warnSpy).not.toHaveBeenCalledWith('apiFetch: clock drift', expect.anything());
  });

  it('dispatches the unauthorized handler on 401 with x-server-now (real-network 401)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValueOnce(
      jsonRes(
        401,
        { status: 'error', error: { code: 'UNAUTHORIZED', message: 'no' } },
        { 'x-server-now': new Date().toISOString() },
      ),
    );
    await expect(
      apiFetch('/api/v1/me', {
        method: 'GET',
        schema: z.object({
          status: z.literal('error'),
          error: z.object({ code: z.string(), message: z.string() }),
        }),
      }),
    ).resolves.toMatchObject({ status: 401, wasNetworkSuccess: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does NOT dispatch the unauthorized handler on 401 without x-server-now (cache-hit)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(
      jsonRes(401, { status: 'error', error: { code: 'UNAUTHORIZED', message: 'no' } }),
    );
    await apiFetch('/api/v1/me', {
      method: 'GET',
      schema: z.object({
        status: z.literal('error'),
        error: z.object({ code: z.string(), message: z.string() }),
      }),
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns undefined data on a 204 No Content response', async () => {
    fetchMock.mockResolvedValueOnce(emptyRes(204, { 'x-server-now': new Date().toISOString() }));
    const result = await apiFetch('/api/v1/client-errors', {
      method: 'POST',
      body: {
        where: 'x',
        message: 'y',
        performanceActive: false,
        timestamp: new Date().toISOString(),
      },
      schema: z.unknown(),
    });
    expect(result.status).toBe(204);
    expect(result.data).toBeUndefined();
  });

  it('throws when the response body fails schema validation', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, { wrong: 'shape' }, { 'x-server-now': new Date().toISOString() }),
    );
    await expect(apiFetch('/api/v1/test', { method: 'GET', schema: okSchema })).rejects.toThrow();
  });

  it('sets credentials:same-origin and content-type only when a body is present', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes(
        200,
        { status: 'ok', data: { hello: 'w' } },
        { 'x-server-now': new Date().toISOString() },
      ),
    );
    await apiFetch('/api/v1/test', { method: 'GET', schema: okSchema });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();

    fetchMock.mockResolvedValueOnce(
      jsonRes(
        200,
        { status: 'ok', data: { hello: 'w' } },
        { 'x-server-now': new Date().toISOString() },
      ),
    );
    await apiFetch('/api/v1/test', { method: 'PUT', body: { a: 1 }, schema: okSchema });
    const [, putInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(putInit.headers).toEqual({ 'content-type': 'application/json' });
    expect(putInit.body).toBe(JSON.stringify({ a: 1 }));
  });
});
