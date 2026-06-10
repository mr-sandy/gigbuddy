import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';

export const app = new Hono().route('/api/v1/health', healthRoute);
