import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth.js';
import { loggerMiddleware } from './middleware/logger.js';
import { serverNowMiddleware } from './middleware/server-now.js';
import { authRoute } from './routes/auth.js';
import { clientErrorsRoute } from './routes/client-errors.js';
import { healthRoute } from './routes/health.js';
import { meRoute } from './routes/me.js';
import { songsRoute } from './routes/songs.js';

export const app = new Hono()
  .use('*', loggerMiddleware)
  .use('*', serverNowMiddleware)
  .use('/api/v1/*', authMiddleware)
  .route('/api/v1/health', healthRoute)
  .route('/api/v1/auth', authRoute)
  .route('/api/v1/me', meRoute)
  .route('/api/v1/songs', songsRoute)
  .route('/api/v1/client-errors', clientErrorsRoute);
