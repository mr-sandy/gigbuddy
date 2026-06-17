import { createMiddleware } from 'hono/factory';

/*
 * Sets `x-server-now: <ISO-8601>` on every response (architecture.md AR-24).
 *
 * Client reads this header in api/client.ts (Story 2.4) and warns on
 * |serverNow - Date.now()| > 30s — clock-skew diagnostic for scenarios
 * that would otherwise corrupt LWW ordering.
 *
 * Set the header AFTER next() so the value reflects when the response
 * left the server, not when the request arrived.
 */
export const serverNowMiddleware = createMiddleware(async (c, next) => {
  await next();
  c.header('x-server-now', new Date().toISOString());
});
