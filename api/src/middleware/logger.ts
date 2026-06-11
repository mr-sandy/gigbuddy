import { createMiddleware } from 'hono/factory';

const REDACT_KEYS = new Set([
  'password',
  'cookie',
  'authorization',
  'set-cookie',
  'gigbuddy_session',
]);

function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  const line = {
    level: 'info',
    msg: 'request',
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
    headers: redact(Object.fromEntries(c.req.raw.headers.entries())),
  };
  console.log(JSON.stringify(line));
});
