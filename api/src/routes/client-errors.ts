import { ClientErrorReportSchema } from '@gigbuddy/shared';
import { Hono } from 'hono';

/*
 * Fire-and-forget client-error reporter (architecture.md §Logging, AR-39).
 * Valid payloads emit one structured CloudWatch log line at level=error.
 * Malformed payloads log at level=warn so the gig-night alert query
 * (filter level=error) is not polluted by buggy clients.
 *
 * Returns 204 No Content — the client expects no echo.
 */
export const clientErrorsRoute = new Hono().post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    console.log(
      JSON.stringify({
        level: 'warn',
        msg: 'client-errors malformed payload',
        reason: 'not JSON',
      }),
    );
    return c.json(
      {
        status: 'error' as const,
        error: { code: 'VALIDATION_FAILED', message: 'body is not JSON' },
      },
      400,
    );
  }
  const parsed = ClientErrorReportSchema.safeParse(body);
  if (!parsed.success) {
    console.log(
      JSON.stringify({
        level: 'warn',
        msg: 'client-errors malformed payload',
        reason: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
      }),
    );
    return c.json(
      {
        status: 'error' as const,
        error: { code: 'VALIDATION_FAILED', message: 'malformed client-error report' },
      },
      400,
    );
  }
  console.log(JSON.stringify({ level: 'error', msg: 'client-error', ...parsed.data }));
  return c.body(null, 204);
});
