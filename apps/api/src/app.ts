import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './env';
import { notFound, onError } from './middleware/errors';
import { mutableResponse, requestId } from './middleware/request-id';
import { healthRoutes } from './routes/health';

export const API_BASE_PATH = '/api/v1';

type Router = Hono<AppEnv>;

export interface CreateAppOptions {
  /** Test-only hook to mount extra routes under /api/v1. Never used by src/index.ts. */
  extend?: (v1: Router) => void;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppEnv>();
  // Order matters: outer middleware sees the final response (including error responses).
  app.use(requestId);
  // JSON-only API: nothing may load from it or frame it (docs/keamanan.md).
  app.use(
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      referrerPolicy: 'no-referrer',
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      xFrameOptions: 'DENY',
    }),
  );
  app.use(mutableResponse);
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
