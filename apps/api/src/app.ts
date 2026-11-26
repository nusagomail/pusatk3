import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './env';
import { edgeCache, type EdgeCacheOptions } from './middleware/edge-cache';
import { rateLimit } from './middleware/rate-limit';
import { notFound, onError } from './middleware/errors';
import { mutableResponse, requestId } from './middleware/request-id';
import { categoriesRoutes } from './routes/categories';
import { directoryRoutes } from './routes/directory';
import { healthRoutes } from './routes/health';
import { landingRoutes } from './routes/landing';
import { leadRoutes } from './routes/leads';
import { metaRoutes } from './routes/meta';

export const API_BASE_PATH = '/api/v1';

/** Public GET reads: rate limited per visitor and edge cached (ADR 0021, ADR 0022). */
const PUBLIC_READ_PATHS = [
  '/search',
  '/schedules/*',
  '/providers/*',
  '/cities',
  '/categories',
  '/landing-pages',
  '/sitemap',
] as const;

type Router = Hono<AppEnv>;

export interface CreateAppOptions {
  /** Test-only hook to mount extra routes under /api/v1. Never used by src/index.ts. */
  extend?: (v1: Router) => void;
  /** Test-only clock (e.g. to pin "today" for date-based visibility). Defaults to Date.now. */
  now?: () => number;
  /** Edge cache for public GET responses (ADR 0021). Off unless given (src/index.ts does). */
  edgeCache?: EdgeCacheOptions;
  /** Test-only network access for Turnstile siteverify. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppEnv>();
  // Order matters: outer middleware sees the final response (including error responses).
  app.use(requestId);
  const now = options.now ?? Date.now;
  app.use(async (c, next) => {
    c.set('now', now);
    await next();
  });
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
  // Public reads: per-visitor limit before the cache, so cached answers count too (ADR 0022).
  const readLimit = rateLimit('RL_READ', 'read');
  for (const path of PUBLIC_READ_PATHS) {
    v1.use(path, readLimit);
  }
  if (options.edgeCache) {
    const cached = edgeCache(options.edgeCache);
    for (const path of PUBLIC_READ_PATHS) {
      v1.use(path, cached);
    }
  }
  v1.route('/', healthRoutes);
  v1.route('/', metaRoutes);
  v1.route('/', landingRoutes);
  v1.route('/', leadRoutes({ fetch: options.fetch }));
  v1.route('/', categoriesRoutes);
  v1.route('/', directoryRoutes);
  options.extend?.(v1);
  app.route(API_BASE_PATH, v1);
  return app;
}
