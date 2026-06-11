import { Hono } from 'hono';

export const meRoute = new Hono().get('/', (c) => {
  const session = c.get('session');
  const nowSeconds = Math.floor(Date.now() / 1000);
  const daysUntilExpiry = Math.max(0, Math.floor((session.exp - nowSeconds) / 86_400));
  return c.json({
    status: 'ok' as const,
    data: { authenticated: true as const, daysUntilExpiry },
  });
});
