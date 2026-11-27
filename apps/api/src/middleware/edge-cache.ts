import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { readDataVersion } from '../lib/data-version';
import { getDb } from '../lib/db';
import { jakartaToday } from '../lib/date';

// Edge cache for public GET responses (ADR 0021). Workers responses are not cached by the CDN on
// their own (ADR 0010), so successful public responses are stored with the Cache API. The key
// carries the data version, the deployed version and the Jakarta date: an import, a deploy or a
// new day makes every stored copy unreachable at once, without a purge API (which needs the
// production zone). On *.workers.dev the Cache API stores nothing; it works on the pusatk3.id zone.

/** How long a stored copy may be served; the versions in the key end it earlier. */
export const EDGE_CACHE_TTL_SECONDS = 3600;
/** Reserved query parameter of cache keys; a request carrying it is never cached. */
export const CACHE_KEY_PARAM = '__cache';
export const CACHE_STATUS_HEADER = 'X-Cache';
/** Local `wrangler dev` (and `pnpm dev`): no cache, so code changes show at once. */
const LOCAL_APP_VERSION = 'dev';
/** Client Cache-Control of a stored copy (the stored copy itself carries the edge TTL). */
const ORIGINAL_CACHE_CONTROL = 'X-PusatK3-Cache-Control';
/** Never stored: they belong to one request. */
const PER_REQUEST_HEADERS = ['X-Request-Id', 'Set-Cookie'];

export interface EdgeCacheOptions {
  /** The cache to use (deployed: `caches.default`). */
  cache: () => Cache | undefined;
  /**
   * How long a read data version is reused. Default 0: read on every request (a primary-key
   * lookup). The API must never use an older version than the web page that calls it, or a page
   * keyed on the new version could be filled with old API data (#29 review).
   */
  versionTtlMs?: number;
}

/** Same URL plus the versions and the date in the reserved parameter. */
export function edgeCacheKey(url: string, ...parts: string[]): Request {
  const key = new URL(url);
  key.searchParams.set(CACHE_KEY_PARAM, parts.join('.'));
  return new Request(key.toString(), { method: 'GET' });
}

/** Requests that must not read or fill the shared cache. */
function bypass(request: Request, appVersion: string): boolean {
  return (
    request.method !== 'GET' ||
    appVersion === LOCAL_APP_VERSION ||
    new URL(request.url).searchParams.has(CACHE_KEY_PARAM) ||
    // Shared cache = anonymous only, whatever a route's headers say (Fase 2 adds sessions).
    request.headers.has('Authorization') ||
    request.headers.has('Cookie')
  );
}

export function edgeCache(options: EdgeCacheOptions): MiddlewareHandler<AppEnv> {
  const versionTtlMs = options.versionTtlMs ?? 0;
  let memo: { version: string; at: number } | undefined;

  const dataVersion = async (env: AppEnv['Bindings'], now: number) => {
    if (versionTtlMs > 0 && memo && now - memo.at < versionTtlMs) return memo.version;
    memo = { version: await readDataVersion(getDb(env)), at: now };
    return memo.version;
  };

  return async (c, next) => {
    if (bypass(c.req.raw, c.env.APP_VERSION)) return next();
    const cache = options.cache();
    if (!cache) return next();

    let key: Request;
    try {
      const now = c.var.now();
      key = edgeCacheKey(
        c.req.url,
        await dataVersion(c.env, now),
        c.env.APP_VERSION,
        jakartaToday(now),
      );
    } catch {
      return next(); // No version, no cache: answer from the database.
    }

    const hit = await cache.match(key).catch(() => undefined);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set('Cache-Control', res.headers.get(ORIGINAL_CACHE_CONTROL) ?? 'no-store');
      res.headers.delete(ORIGINAL_CACHE_CONTROL);
      res.headers.set(CACHE_STATUS_HEADER, 'HIT');
      return res;
    }

    await next();
    const res = c.res;
    const cacheControl = res.headers.get('Cache-Control') ?? '';
    if (res.status !== 200 || !cacheControl.startsWith('public') || res.headers.has('Set-Cookie')) {
      return;
    }
    try {
      const stored = new Response(res.clone().body, res);
      for (const name of PER_REQUEST_HEADERS) stored.headers.delete(name);
      stored.headers.set(ORIGINAL_CACHE_CONTROL, cacheControl);
      stored.headers.set('Cache-Control', `public, max-age=${EDGE_CACHE_TTL_SECONDS}`);
      const put = cache.put(key, stored).catch(() => undefined);
      try {
        c.executionCtx.waitUntil(put);
      } catch {
        await put; // No execution context (tests): store before answering.
      }
      c.res.headers.set(CACHE_STATUS_HEADER, 'MISS');
    } catch {
      // The cache never breaks an answer.
    }
  };
}
