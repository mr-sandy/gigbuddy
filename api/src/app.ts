import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth.js';
import { loggerMiddleware } from './middleware/logger.js';
import { authRoute } from './routes/auth.js';
import { healthRoute } from './routes/health.js';
import { meRoute } from './routes/me.js';

export const app = new Hono()
  .use('*', loggerMiddleware)
  .use('/api/v1/*', authMiddleware)
  .route('/api/v1/health', healthRoute)
  .route('/api/v1/auth', authRoute)
  .route('/api/v1/me', meRoute);
