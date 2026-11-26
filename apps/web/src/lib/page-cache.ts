// Edge cache for SSR pages (ADR 0021), pure so it can be tested without the Workers runtime.
// Responses made by a Worker are not cached by the CDN on their own (ADR 0010). Complete public
// pages are stored with the Cache API under a key that carries the data version (from the API)
// and the build id: an import or a deploy makes every stored page unreachable at once, without a
// purge API. On *.workers.dev the Cache API stores nothing; it takes effect on the pusatk3.id zone.

/** How long a stored page may be served; the versions in the key end it earlier. */
export const PAGE_CACHE_TTL_SECONDS = 3600;
/** The data version is re-read at most this often per isolate. */
export const DATA_VERSION_TTL_MS = 10_000;
export const CACHE_STATUS_HEADER = 'X-Cache';
/** Client Cache-Control of a stored page (the stored copy itself carries the edge TTL). */
const ORIGINAL_CACHE_CONTROL = 'X-PusatK3-Cache-Control';

/** Same URL plus the versions, in a reserved parameter the pages never read. */
export function pageCacheKey(url: string, dataVersion: string, buildId: string): Request {
  const key = new URL(url);
  key.searchParams.set('__cache', `${dataVersion}.${buildId}`);
  return new Request(key.toString(), { method: 'GET' });
}

/** Only complete public pages are stored: degraded pages are `no-store` (ADR 0019). */
export function isStorable(response: Response): boolean {
  return (
    response.status === 200 &&
    (response.headers.get('Cache-Control') ?? '').startsWith('public') &&
    !response.headers.has('Set-Cookie')
  );
}

/** A cached page as the client should see it. */
export function fromCache(hit: Response): Response {
  const res = new Response(hit.body, hit);
  res.headers.set('Cache-Control', res.headers.get(ORIGINAL_CACHE_CONTROL) ?? 'no-store');
  res.headers.delete(ORIGINAL_CACHE_CONTROL);
  res.headers.set(CACHE_STATUS_HEADER, 'HIT');
  return res;
}

/** The copy to store, carrying the edge TTL. */
export function toCache(response: Response): Response {
  const stored = new Response(response.clone().body, response);
  stored.headers.set(ORIGINAL_CACHE_CONTROL, response.headers.get('Cache-Control') ?? '');
  stored.headers.set('Cache-Control', `public, max-age=${PAGE_CACHE_TTL_SECONDS}`);
  stored.headers.delete(CACHE_STATUS_HEADER);
  return stored;
}

/** Reuses a successfully read data version for `ttlMs`; failures are never remembered. */
export function memoizedVersion(
  read: () => Promise<string | null>,
  now: () => number = Date.now,
  ttlMs: number = DATA_VERSION_TTL_MS,
): () => Promise<string | null> {
  let memo: { version: string; at: number } | undefined;
  return async () => {
    if (memo && now() - memo.at < ttlMs) return memo.version;
    const version = await read();
    memo = version === null ? undefined : { version, at: now() };
    return version;
  };
}

export interface PageCacheDeps {
  /** Deployed: `caches.default`; undefined where there is no Cache API. */
  cache: Cache | undefined;
  /** Current data version, or null when the API cannot tell (then nothing is cached). */
  dataVersion: () => Promise<string | null>;
  buildId: string;
}

/**
 * Serves `request` from the page cache, or renders it and stores a complete public page. Any
 * cache failure falls back to rendering: the cache never breaks a page.
 */
export async function withPageCache(
  request: Request,
  deps: PageCacheDeps,
  render: () => Promise<Response>,
): Promise<Response> {
  const { cache } = deps;
  if (request.method !== 'GET' || !cache) return render();
  const version = await deps.dataVersion().catch(() => null);
  if (version === null) return render();

  const key = pageCacheKey(request.url, version, deps.buildId);
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) return fromCache(hit);

  const response = await render();
  if (!isStorable(response)) return response;
  await cache.put(key, toCache(response)).catch(() => undefined);
  response.headers.set(CACHE_STATUS_HEADER, 'MISS');
  return response;
}
