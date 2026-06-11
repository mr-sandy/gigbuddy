import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
  GetParameterCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

import { __resetSecretsCacheForTests, getJwtKey, getPasswordHash } from './ssm.js';

beforeEach(() => {
  sendMock.mockReset();
  __resetSecretsCacheForTests();
  delete process.env.JWT_KEY_PARAM;
  delete process.env.PASSWORD_HASH_PARAM;
});

afterEach(() => {
  __resetSecretsCacheForTests();
});

describe('getJwtKey', () => {
  it('fetches the parameter named by JWT_KEY_PARAM', async () => {
    process.env.JWT_KEY_PARAM = '/gigbuddy/jwt-key';
    sendMock.mockResolvedValueOnce({ Parameter: { Value: 'super-secret-key' } });

    const value = await getJwtKey();

    expect(value).toBe('super-secret-key');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]?.[0];
    expect(command.input).toEqual({ Name: '/gigbuddy/jwt-key', WithDecryption: true });
  });

  it('caches the fetched value across calls (single SSM round-trip)', async () => {
    process.env.JWT_KEY_PARAM = '/gigbuddy/jwt-key';
    sendMock.mockResolvedValueOnce({ Parameter: { Value: 'cached-key' } });

    const first = await getJwtKey();
    const second = await getJwtKey();

    expect(first).toBe('cached-key');
    expect(second).toBe('cached-key');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('throws a helpful error if JWT_KEY_PARAM env var is not set', async () => {
    await expect(getJwtKey()).rejects.toThrow(/JWT_KEY_PARAM/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws when SSM returns an empty Parameter.Value', async () => {
    process.env.JWT_KEY_PARAM = '/gigbuddy/jwt-key';
    sendMock.mockResolvedValueOnce({ Parameter: { Value: '' } });
    await expect(getJwtKey()).rejects.toThrow(/empty or missing/);
  });

  it('throws when SSM returns no Parameter at all', async () => {
    process.env.JWT_KEY_PARAM = '/gigbuddy/jwt-key';
    sendMock.mockResolvedValueOnce({});
    await expect(getJwtKey()).rejects.toThrow(/empty or missing/);
  });
});

describe('getPasswordHash', () => {
  it('fetches the parameter named by PASSWORD_HASH_PARAM', async () => {
    process.env.PASSWORD_HASH_PARAM = '/gigbuddy/password-hash';
    sendMock.mockResolvedValueOnce({ Parameter: { Value: '$argon2id$v=19$...' } });

    const value = await getPasswordHash();

    expect(value).toBe('$argon2id$v=19$...');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('caches the fetched hash across calls', async () => {
    process.env.PASSWORD_HASH_PARAM = '/gigbuddy/password-hash';
    sendMock.mockResolvedValueOnce({ Parameter: { Value: 'cached-hash' } });

    await getPasswordHash();
    await getPasswordHash();

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('throws if PASSWORD_HASH_PARAM env var is not set', async () => {
    await expect(getPasswordHash()).rejects.toThrow(/PASSWORD_HASH_PARAM/);
  });
});
