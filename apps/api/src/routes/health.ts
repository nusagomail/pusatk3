import { healthResponseSchema } from '@pusatk3/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const healthRoutes = new Hono<AppEnv>().get('/health', (c) => {
  const body = healthResponseSchema.parse({ status: 'ok', version: c.env.APP_VERSION });
  c.header('Cache-Control', 'no-store');
  return c.json(body);
});
