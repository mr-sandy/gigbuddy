import type { ErrorResponse } from '@gigbuddy/shared';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { type SessionClaims, verifySession } from '../auth/jwt.js';

export const SESSION_COOKIE_NAME = 'gigbuddy_session';
const SKIP_PATHS = new Set(['/api/v1/auth/login', '/api/v1/health']);

declare module 'hono' {
  interface ContextVariableMap {
    session: SessionClaims;
  }
}

function unauthorized(): ErrorResponse {
  return {
    status: 'error',
    error: { code: 'UNAUTHORIZED', message: 'authentication required' },
  };
}

export const authMiddleware = createMiddleware(async (c, next) => {
  if (SKIP_PATHS.has(c.req.path)) return next();
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) return c.json(unauthorized(), 401);
  try {
    const claims = await verifySession(token);
    c.set('session', claims);
    return next();
  } catch {
    return c.json(unauthorized(), 401);
  }
});
