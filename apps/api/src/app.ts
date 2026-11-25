import { Hono } from 'hono';
import type { AppEnv } from './env';
import { healthRoutes } from './routes/health';

export const API_BASE_PATH = '/api/v1';

/** Builds the API app. Tests may add routes to the returned `v1` router before use. */
export function createApp() {
  const app = new Hono<AppEnv>();
  const v1 = new Hono<AppEnv>();
  v1.route('/', healthRoutes);
  app.route(API_BASE_PATH, v1);
  return app;
}
