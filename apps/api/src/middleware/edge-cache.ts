import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { readDataVersion } from '../lib/data-version';
import { getDb } from '../lib/db';

// Edge cache for public GET responses (ADR 0021). Workers responses are not cached by the CDN on
// their own (ADR 0010), so successful public responses are stored with the Cache API. The key
// carries the data version and the deployed version: an import or a deploy makes every stored
// copy unreachable at once, without a purge API (which needs the production zone).
// On *.workers.dev the Cache API stores nothing; it takes effect on the pusatk3.id zone.

/** How long a stored copy may be served; the version in the key ends it earlier. */
export const EDGE_CACHE_TTL_SECONDS = 3600;
/** The data version is re-read at most this often per isolate. */
export const DATA_VERSION_TTL_MS = 10_000;

export const CACHE_STATUS_HEADER = 'X-Cache';
/** Client Cache-Control of a stored copy (the stored copy itself carries the edge TTL). */
const ORIGINAL_CACHE_CONTROL = 'X-PusatK3-Cache-Control';
/** Never stored: they belong to one request. */
const PER_REQUEST_HEADERS = ['X-Request-Id', 'Set-Cookie'];

export interface EdgeCacheOptions {
  /** The cache to use (deployed: `caches.default`). */
  cache: () => Cache | undefined;
  /** How long a read data version is reused (tests: 0). */
  versionTtlMs?: number;
}

/** Same URL plus the versions; a reserved parameter the API never accepts from clients. */
export function edgeCacheKey(url: string, dataVersion: string, appVersion: string): Request {
  const key = new URL(url);
  key.searchParams.set('__cache', `${dataVersion}.${appVersion}`);
  return new Request(key.toString(), { method: 'GET' });
}

export function edgeCache(options: EdgeCacheOptions): MiddlewareHandler<AppEnv> {
  const versionTtlMs = options.versionTtlMs ?? DATA_VERSION_TTL_MS;
  let memo: { version: string; at: number } | undefined;

  const dataVersion = async (env: AppEnv['Bindings'], now: number) => {
    if (memo && now - memo.at < versionTtlMs) return memo.version;
    memo = { version: await readDataVersion(getDb(env)), at: now };
    return memo.version;
  };

  return async (c, next) => {
    const cache = c.req.method === 'GET' ? options.cache() : undefined;
    if (!cache) return next();

    let key: Request;
    try {
      key = edgeCacheKey(c.req.url, await dataVersion(c.env, c.var.now()), c.env.APP_VERSION);
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
  };
}
