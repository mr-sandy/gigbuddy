import { sign, verify } from 'hono/jwt';
import { getJwtKey } from '../secrets/ssm.js';

const ALG = 'HS256';
const COOKIE_MAX_AGE_SECONDS = 31_536_000; // 365 days, matches Set-Cookie Max-Age

export interface SessionClaims {
  // Index signature satisfies hono/jwt's JWTPayload contract; the three
  // named fields below are the only ones we actually use.
  [key: string]: unknown;
  sub: 'sandy';
  iat: number; // seconds since epoch
  exp: number; // seconds since epoch
}

export async function signSession(nowSeconds: number): Promise<string> {
  const key = await getJwtKey();
  const claims: SessionClaims = {
    sub: 'sandy',
    iat: nowSeconds,
    exp: nowSeconds + COOKIE_MAX_AGE_SECONDS,
  };
  return sign(claims, key, ALG);
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const key = await getJwtKey();
  // hono/jwt verify throws on bad signature / expired exp / malformed JWT;
  // it returns the decoded payload otherwise. Cast through unknown — the
  // returned shape is validated by the route handlers reading it.
  const payload = (await verify(token, key, ALG)) as unknown as SessionClaims;
  return payload;
}

export { COOKIE_MAX_AGE_SECONDS };
