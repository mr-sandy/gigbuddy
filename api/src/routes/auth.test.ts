import { argon2id } from 'hash-wasm';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { getJwtKeyMock, getPasswordHashMock, verifyPasswordSpy } = vi.hoisted(() => ({
  getJwtKeyMock: vi.fn(),
  getPasswordHashMock: vi.fn(),
  verifyPasswordSpy: vi.fn(),
}));

vi.mock('../secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
  getPasswordHash: getPasswordHashMock,
}));

vi.mock('../auth/password.js', async () => {
  const actual = await vi.importActual<typeof import('../auth/password.js')>('../auth/password.js');
  return {
    ...actual,
    verifyPassword: verifyPasswordSpy.mockImplementation(actual.verifyPassword),
  };
});

import { app } from '../app.js';

const TEST_KEY = `test-key-${'x'.repeat(40)}`;
let storedHash: string;

beforeAll(async () => {
  const salt = new Uint8Array(16);
  for (let i = 0; i < salt.length; i++) salt[i] = i + 1;
  storedHash = await argon2id({
    password: 'right-password',
    salt,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });
});

beforeEach(() => {
  getJwtKeyMock.mockReset();
  getPasswordHashMock.mockReset();
  verifyPasswordSpy.mockClear();
  getJwtKeyMock.mockResolvedValue(TEST_KEY);
  getPasswordHashMock.mockResolvedValue(storedHash);
});

describe('POST /api/v1/auth/login', () => {
  it('issues the session cookie on the correct password', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'right-password' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'applied' });

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/gigbuddy_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Max-Age=31536000/);
    expect(setCookie).toMatch(/Path=\//);

    expect(verifyPasswordSpy).toHaveBeenCalledTimes(1);
  });

  it('returns 401 INVALID_CREDENTIALS on the wrong password and sets no cookie', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      status: 'error',
      error: { code: 'INVALID_CREDENTIALS', message: 'wrong password' },
    });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(verifyPasswordSpy).toHaveBeenCalledTimes(1);
  });

  it('returns 400 VALIDATION_FAILED on missing password field', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      status: 'error',
      error: { code: 'VALIDATION_FAILED', message: 'password is required' },
    });
    // Uniform-timing: even the malformed body path runs verifyPassword once.
    expect(verifyPasswordSpy).toHaveBeenCalledTimes(1);
  });

  it('returns 400 VALIDATION_FAILED on a non-JSON body', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    expect(verifyPasswordSpy).toHaveBeenCalledTimes(1);
  });
});
