// Edge cache for SSR pages (ADR 0021), pure so it can be tested without the Workers runtime.
// Responses made by a Worker are not cached by the CDN on their own (ADR 0010). Complete public
// pages are stored with the Cache API under a key that carries the data and API version (from
// the API), the build id and the Jakarta date: an import, a deploy of either Worker or a new day
// makes every stored page unreachable at once, without a purge API. On *.workers.dev the Cache
// API stores nothing; it takes effect on the pusatk3.id zone.

/** How long a stored page may be served; the versions in the key end it earlier. */
export const PAGE_CACHE_TTL_SECONDS = 3600;
/** A read data version is reused this long per isolate; a failed read is retried sooner. */
export const DATA_VERSION_TTL_MS = 10_000;
export const DATA_VERSION_FAILURE_TTL_MS = 2_000;
/** Reserved query parameter of cache keys; a request carrying it is never cached. */
export const CACHE_KEY_PARAM = '__cache';
export const CACHE_STATUS_HEADER = 'X-Cache';
/** Client Cache-Control of a stored page (the stored copy itself carries the edge TTL). */
const ORIGINAL_CACHE_CONTROL = 'X-PusatK3-Cache-Control';

/**
 * Cache key: path, only the query parameters the page reads (`keptParams`, in that order; e.g.
 * utm_* or fbclid never split the cache), then the versions in the reserved parameter.
 */
export function pageCacheKey(
  url: string,
  parts: readonly string[],
  keptParams: readonly string[] = [],
): Request {
  const source = new URL(url);
  const key = new URL(source.pathname, source.origin);
  for (const name of keptParams) {
    const value = source.searchParams.get(name);
    if (value) key.searchParams.set(name, value);
  }
  key.searchParams.set(CACHE_KEY_PARAM, parts.join('.'));
  return new Request(key.toString(), { method: 'GET' });
}

/** Requests that must not read or fill the shared cache (anonymous GET only). */
export function bypassesCache(request: Request): boolean {
  return (
    request.method !== 'GET' ||
    new URL(request.url).searchParams.has(CACHE_KEY_PARAM) ||
    request.headers.has('Authorization') ||
    request.headers.has('Cookie')
  );
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

/**
 * Reuses a read data version for `ttlMs`. A failure (API down) is remembered briefly, so pages do
 * not each wait for the version first while the API is unreachable.
 */
export function memoizedVersion(
  read: () => Promise<string | null>,
  now: () => number = Date.now,
  ttlMs: number = DATA_VERSION_TTL_MS,
  failureTtlMs: number = DATA_VERSION_FAILURE_TTL_MS,
): () => Promise<string | null> {
  let memo: { version: string | null; at: number } | undefined;
  return async () => {
    const at = now();
    if (memo && at - memo.at < (memo.version === null ? failureTtlMs : ttlMs)) return memo.version;
    const version = await read().catch(() => null);
    memo = { version, at };
    return version;
  };
}

export interface PageCacheDeps {
  /** Deployed production build: `caches.default`; undefined disables the cache. */
  cache: Cache | undefined;
  /** Data + API version from the API, or null when it cannot tell (then nothing is cached). */
  dataVersion: () => Promise<string | null>;
  buildId: string;
  /** Jakarta date (YYYY-MM-DD): finished schedules disappear at midnight WIB. */
  today: () => string;
  /** Query parameters the page at this path reads (kept in the key). */
  keptParams: (pathname: string) => readonly string[];
  /** True when the page set cookies (Astro adds Set-Cookie only after the middleware). */
  setsCookies: () => boolean;
  /** Runs the cache write after the answer (`waitUntil`); awaited when absent. */
  defer?: (task: Promise<unknown>) => void;
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
  if (!cache || bypassesCache(request)) return render();
  const version = await deps.dataVersion().catch(() => null);
  if (version === null) return render();

  let key: Request;
  try {
    const url = new URL(request.url);
    key = pageCacheKey(
      request.url,
      [version, deps.buildId, deps.today()],
      deps.keptParams(url.pathname),
    );
  } catch {
    return render();
  }
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) return fromCache(hit);

  const response = await render();
  if (!isStorable(response) || deps.setsCookies()) return response;
  try {
    const put = cache.put(key, toCache(response)).catch(() => undefined);
    if (deps.defer) deps.defer(put);
    else await put;
    response.headers.set(CACHE_STATUS_HEADER, 'MISS');
  } catch {
    // The cache never breaks a page.
  }
  return response;
}
