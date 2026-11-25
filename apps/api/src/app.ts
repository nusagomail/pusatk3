import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import type { AppEnv } from './env';
import { notFound, onError } from './middleware/errors';
import { healthRoutes } from './routes/health';

export const API_BASE_PATH = '/api/v1';

type Router = Hono<AppEnv>;

export interface CreateAppOptions {
  /** Test-only hook to mount extra routes under /api/v1. */
  extend?: (v1: Router) => void;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppEnv>();
  app.use(requestId());
  // Hono only routes `Error` instances to onError; normalise anything else thrown.
  app.use(async (_c, next) => {
    try {
      await next();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Non-Error thrown');
    }
  });
  app.onError(onError);
  app.notFound(notFound);

  const v1: Router = new Hono<AppEnv>();
  v1.route('/', healthRoutes);
  options.extend?.(v1);
  app.route(API_BASE_PATH, v1);
  return app;
}
