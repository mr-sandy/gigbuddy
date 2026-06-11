import { sign } from 'hono/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getJwtKeyMock } = vi.hoisted(() => ({ getJwtKeyMock: vi.fn() }));

vi.mock('../secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
}));

import { COOKIE_MAX_AGE_SECONDS, signSession, verifySession } from './jwt.js';

const TEST_KEY = `test-key-${'x'.repeat(40)}`;

beforeEach(() => {
  getJwtKeyMock.mockReset();
  getJwtKeyMock.mockResolvedValue(TEST_KEY);
});

describe('signSession + verifySession', () => {
  it('produces a 3-part HS256 JWT', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession(now);
    expect(token.split('.')).toHaveLength(3);
  });

  it('round-trips the claims including sub=sandy and the expected exp', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession(now);
    const claims = await verifySession(token);
    expect(claims.sub).toBe('sandy');
    expect(claims.iat).toBe(now);
    expect(claims.exp).toBe(now + COOKIE_MAX_AGE_SECONDS);
  });

  it('rejects malformed JWT strings', async () => {
    await expect(verifySession('not-a-jwt')).rejects.toThrow();
  });

  it('rejects a token whose payload has been tampered with', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession(now);
    const parts = token.split('.');
    const payloadSegment = parts[1] ?? '';
    // Flip one character in the payload segment to invalidate the signature.
    const firstChar = payloadSegment.charAt(0);
    const swapped = firstChar === 'A' ? 'B' : 'A';
    const tampered = [parts[0], swapped + payloadSegment.slice(1), parts[2]].join('.');
    await expect(verifySession(tampered)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - COOKIE_MAX_AGE_SECONDS - 10;
    const expired = await sign(
      { sub: 'sandy', iat: past, exp: past + 60 }, // exp ~year ago
      TEST_KEY,
      'HS256',
    );
    await expect(verifySession(expired)).rejects.toThrow();
  });
});
