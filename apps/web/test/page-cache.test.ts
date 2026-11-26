import { describe, expect, it, vi } from 'vitest';
import {
  memoizedVersion,
  PAGE_CACHE_TTL_SECONDS,
  pageCacheKey,
  withPageCache,
} from '../src/lib/page-cache';

// Page cache for SSR pages (ADR 0021), with an in-memory stand-in for the Cache API.
class MemoryCache {
  readonly store = new Map<string, Response>();
  match = vi.fn(async (key: Request) => this.store.get(key.url)?.clone());
  put = vi.fn(async (key: Request, res: Response) => {
    this.store.set(key.url, res);
  });
}

const PUBLIC = 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=600';
const page =
  (body: string, cacheControl = PUBLIC, status = 200) =>
  async () =>
    new Response(body, {
      status,
      headers: { 'Cache-Control': cacheControl, 'Content-Type': 'text/html' },
    });
const request = (path = '/cari?q=forklift', init?: RequestInit) =>
  new Request(`https://pusatk3.test${path}`, init);

function setup(version: string | null = 'v1') {
  const cache = new MemoryCache();
  const deps = {
    cache: cache as unknown as Cache,
    dataVersion: vi.fn(async () => version),
    buildId: 'b1',
  };
  return { cache, deps };
}

describe('withPageCache', () => {
  it('renders and stores a complete public page, then serves it from the cache', async () => {
    const { cache, deps } = setup();
    const first = await withPageCache(request(), deps, page('<p>A</p>'));
    expect(first.headers.get('x-cache')).toBe('MISS');
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(await first.text()).toBe('<p>A</p>');

    const render = vi.fn(page('<p>B</p>'));
    const second = await withPageCache(request(), deps, render);
    expect(render).not.toHaveBeenCalled();
    expect(second.headers.get('x-cache')).toBe('HIT');
    expect(await second.text()).toBe('<p>A</p>');
    // Clients see the page policy, never the edge TTL or bookkeeping headers.
    expect(second.headers.get('cache-control')).toBe(PUBLIC);
    expect([...second.headers.keys()].join()).not.toMatch(/x-pusatk3/);
  });

  it('stores the copy with the edge TTL under a key with data version and build id', async () => {
    const { cache, deps } = setup();
    await withPageCache(request(), deps, page('x'));
    const stored = cache.store.get(pageCacheKey(request().url, 'v1', 'b1').url);
    expect(stored?.headers.get('cache-control')).toBe(`public, max-age=${PAGE_CACHE_TTL_SECONDS}`);
    expect(stored?.headers.get('x-cache')).toBeNull();
  });

  it('a new data version or a new build renders again (import or deploy = purge)', async () => {
    const { cache, deps } = setup();
    await withPageCache(request(), deps, page('old'));
    deps.dataVersion.mockResolvedValue('v2');
    expect(await (await withPageCache(request(), deps, page('new'))).text()).toBe('new');
    const nextBuild = { ...deps, buildId: 'b2' };
    expect(await (await withPageCache(request(), nextBuild, page('newer'))).text()).toBe('newer');
    expect(cache.store.size).toBe(3);
  });

  it('keeps different queries apart', async () => {
    const { deps } = setup();
    await withPageCache(request('/cari?q=a'), deps, page('a'));
    expect(await (await withPageCache(request('/cari?q=b'), deps, page('b'))).text()).toBe('b');
  });

  it.each([
    ['a degraded page (no-store)', page('x', 'no-store')],
    ['a 404 page', page('x', PUBLIC, 404)],
    ['a 503 page', page('x', 'no-store', 503)],
    [
      'a page that sets a cookie',
      async () => new Response('x', { headers: { 'Cache-Control': PUBLIC, 'Set-Cookie': 'a=b' } }),
    ],
  ])('never stores %s', async (_name, render) => {
    const { cache, deps } = setup();
    const res = await withPageCache(request(), deps, render);
    expect(res.headers.get('x-cache')).toBeNull();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('does not cache when the data version is unknown (API down)', async () => {
    const { cache, deps } = setup(null);
    await withPageCache(request(), deps, page('x'));
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('renders normally without a Cache API, for non-GET requests, or when the cache fails', async () => {
    const { deps } = setup();
    const none = await withPageCache(request(), { ...deps, cache: undefined }, page('a'));
    expect(await none.text()).toBe('a');

    const { cache, deps: d2 } = setup();
    await withPageCache(request('/cari', { method: 'POST' }), d2, page('b'));
    expect(cache.match).not.toHaveBeenCalled();

    const broken = {
      match: vi.fn(async () => {
        throw new Error('cache down');
      }),
      put: vi.fn(async () => {
        throw new Error('cache down');
      }),
    } as unknown as Cache;
    const res = await withPageCache(request(), { ...deps, cache: broken }, page('c'));
    expect(await res.text()).toBe('c');
  });
});

describe('memoizedVersion', () => {
  it('reuses a version for the TTL and never remembers failures', async () => {
    let clock = 0;
    const read = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('v1')
      .mockResolvedValueOnce('v2');
    const version = memoizedVersion(read, () => clock, 10_000);
    expect(await version()).toBeNull();
    expect(await version()).toBe('v1');
    clock = 9_999;
    expect(await version()).toBe('v1');
    clock = 10_000;
    expect(await version()).toBe('v2');
    expect(read).toHaveBeenCalledTimes(3);
  });
});
