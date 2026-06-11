import { argon2id, argon2Verify } from 'hash-wasm';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { getPasswordHashMock } = vi.hoisted(() => ({ getPasswordHashMock: vi.fn() }));

vi.mock('../secrets/ssm.js', () => ({
  getPasswordHash: getPasswordHashMock,
}));

vi.mock('hash-wasm', async () => {
  const actual = await vi.importActual<typeof import('hash-wasm')>('hash-wasm');
  return {
    ...actual,
    argon2Verify: vi.fn(actual.argon2Verify),
  };
});

import { verifyPassword } from './password.js';

const PLAINTEXT = 'correct horse battery staple';
let storedHash: string;

beforeAll(async () => {
  const salt = new Uint8Array(16);
  for (let i = 0; i < salt.length; i++) salt[i] = i + 1;
  storedHash = await argon2id({
    password: PLAINTEXT,
    salt,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });
});

beforeEach(() => {
  getPasswordHashMock.mockReset();
  (argon2Verify as unknown as ReturnType<typeof vi.fn>).mockClear();
});

describe('verifyPassword', () => {
  it('returns true for the correct password against the SSM-stored hash', async () => {
    getPasswordHashMock.mockResolvedValueOnce(storedHash);
    const result = await verifyPassword(PLAINTEXT);
    expect(result).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    getPasswordHashMock.mockResolvedValueOnce(storedHash);
    const result = await verifyPassword('wrong');
    expect(result).toBe(false);
  });

  it('returns false AND still runs an argon2Verify (uniform timing) when SSM throws', async () => {
    getPasswordHashMock.mockRejectedValueOnce(new Error('SSM unavailable'));
    const result = await verifyPassword('any-input');
    expect(result).toBe(false);
    expect(argon2Verify).toHaveBeenCalledTimes(1);
  });

  it('returns false AND runs a dummy verify when the stored hash is malformed', async () => {
    getPasswordHashMock.mockResolvedValueOnce('not-a-real-hash');
    const result = await verifyPassword('any-input');
    expect(result).toBe(false);
    // One real-hash attempt (which throws) + one dummy-hash attempt = 2 verifies.
    expect(argon2Verify).toHaveBeenCalledTimes(2);
  });
});
