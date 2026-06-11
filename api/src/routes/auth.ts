import { type ErrorResponse, LoginRequestSchema } from '@gigbuddy/shared';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { COOKIE_MAX_AGE_SECONDS, signSession } from '../auth/jwt.js';
import { verifyPassword } from '../auth/password.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

const badRequest: ErrorResponse = {
  status: 'error',
  error: { code: 'VALIDATION_FAILED', message: 'password is required' },
};

const invalidCredentials: ErrorResponse = {
  status: 'error',
  error: { code: 'INVALID_CREDENTIALS', message: 'wrong password' },
};

/** Constant-time-equivalent dummy run when the body is malformed (AC-4). */
async function uniformReject(): Promise<void> {
  await verifyPassword('—malformed-body—');
}

export const authRoute = new Hono().post('/login', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    await uniformReject();
    return c.json(badRequest, 400);
  }
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    await uniformReject();
    return c.json(badRequest, 400);
  }
  const ok = await verifyPassword(parsed.data.password);
  if (!ok) return c.json(invalidCredentials, 401);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = await signSession(nowSeconds);
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });
  return c.json({ status: 'applied' as const });
});
