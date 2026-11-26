import { describe, expect, it, vi } from 'vitest';
import {
  memoizedVersion,
  PAGE_CACHE_TTL_SECONDS,
  pageCacheKey,
  withPageCache,
  type PageCacheDeps,
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

function setup(version: string | null = 'v1.api1') {
  const cache = new MemoryCache();
  const deps = {
    cache: cache as unknown as Cache,
    dataVersion: vi.fn(async () => version),
    buildId: 'b1',
    today: vi.fn(() => '2026-12-01'),
    keptParams: (pathname: string) => (pathname === '/cari' ? ['q', 'city'] : []),
    setsCookies: vi.fn(() => false),
  } satisfies PageCacheDeps;
  return { cache, deps };
}
const text = async (res: Promise<Response>) => (await res).text();

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

  it('stores the copy with the edge TTL under a key with versions, build id and date', async () => {
    const { cache, deps } = setup();
    await withPageCache(request(), deps, page('x'));
    const key = pageCacheKey(request().url, ['v1.api1', 'b1', '2026-12-01'], ['q', 'city']);
    expect(key.url).toBe('https://pusatk3.test/cari?q=forklift&__cache=v1.api1.b1.2026-12-01');
    const stored = cache.store.get(key.url);
    expect(stored?.headers.get('cache-control')).toBe(`public, max-age=${PAGE_CACHE_TTL_SECONDS}`);
    expect(stored?.headers.get('x-cache')).toBeNull();
  });

  it('a new data/API version, build or day renders again (import, deploy, midnight)', async () => {
    const { cache, deps } = setup();
    await withPageCache(request(), deps, page('old'));
    deps.dataVersion.mockResolvedValue('v2.api1');
    expect(await text(withPageCache(request(), deps, page('import')))).toBe('import');
    deps.dataVersion.mockResolvedValue('v2.api2');
    expect(await text(withPageCache(request(), deps, page('api deploy')))).toBe('api deploy');
    expect(await text(withPageCache(request(), { ...deps, buildId: 'b2' }, page('web')))).toBe(
      'web',
    );
    deps.today.mockReturnValue('2026-12-02');
    expect(await text(withPageCache(request(), deps, page('new day')))).toBe('new day');
    expect(cache.store.size).toBe(5);
  });

  it('keeps only the parameters a page reads, in a fixed order', async () => {
    const { cache, deps } = setup();
    await withPageCache(request('/cari?q=a&city=bekasi'), deps, page('a'));
    const same = await withPageCache(
      request('/cari?utm_source=ad&city=bekasi&fbclid=x&q=a'),
      deps,
      page('other'),
    );
    expect(same.headers.get('x-cache')).toBe('HIT');
    expect(await text(withPageCache(request('/cari?q=b'), deps, page('b')))).toBe('b');
    // Pages that read no parameters share one copy whatever the query says.
    await withPageCache(request('/penyedia/x'), deps, page('profile'));
    const tagged = await withPageCache(request('/penyedia/x?utm_campaign=y'), deps, page('?'));
    expect(await tagged.text()).toBe('profile');
    expect(cache.store.size).toBe(3);
  });

  it.each([
    ['a degraded page (no-store)', page('x', 'no-store')],
    ['a 404 page', page('x', PUBLIC, 404)],
    ['a 503 page', page('x', 'no-store', 503)],
    [
      'a page with a Set-Cookie header',
      async () => new Response('x', { headers: { 'Cache-Control': PUBLIC, 'Set-Cookie': 'a=b' } }),
    ],
  ])('never stores %s', async (_name, render) => {
    const { cache, deps } = setup();
    const res = await withPageCache(request(), deps, render);
    expect(res.headers.get('x-cache')).toBeNull();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('never stores a page that set cookies through Astro (added after the middleware)', async () => {
    const { cache, deps } = setup();
    deps.setsCookies.mockReturnValue(true);
    await withPageCache(request(), deps, page('x'));
    expect(cache.put).not.toHaveBeenCalled();
  });

  it.each([
    ['a cookie', { Cookie: 'session=abc' }],
    ['an Authorization header', { Authorization: 'Bearer x' }],
  ])('never reads or fills the cache for a request with %s', async (_name, headers) => {
    const { cache, deps } = setup();
    await withPageCache(request(), deps, page('anonymous'));
    const res = await withPageCache(request('/cari?q=forklift', { headers }), deps, page('own'));
    expect(await res.text()).toBe('own');
    expect(cache.match).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it('ignores requests that carry the reserved parameter, even with a warm cache', async () => {
    const { cache, deps } = setup();
    await withPageCache(request(), deps, page('a'));
    const res = await withPageCache(
      request('/cari?q=forklift&__cache=v1.api1.b1.2026-12-01'),
      deps,
      page('rendered'),
    );
    expect(await res.text()).toBe('rendered');
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it('does not cache when the data version is unknown (API down)', async () => {
    const { cache, deps } = setup(null);
    await withPageCache(request(), deps, page('x'));
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('writes after answering when it can defer the work (waitUntil)', async () => {
    const { cache, deps } = setup();
    const deferred: Promise<unknown>[] = [];
    const res = await withPageCache(
      request(),
      { ...deps, defer: (task) => deferred.push(task) },
      page('x'),
    );
    expect(res.headers.get('x-cache')).toBe('MISS');
    expect(deferred).toHaveLength(1);
    await Promise.all(deferred);
    expect(cache.store.size).toBe(1);
  });

  it('renders normally without a Cache API, for non-GET requests, or when the cache fails', async () => {
    const { deps } = setup();
    expect(await text(withPageCache(request(), { ...deps, cache: undefined }, page('a')))).toBe(
      'a',
    );

    const { cache, deps: d2 } = setup();
    await withPageCache(request('/cari', { method: 'POST' }), d2, page('b'));
    expect(cache.match).not.toHaveBeenCalled();

    const broken = {
      match: vi.fn(async () => {
        throw new Error('cache down');
      }),
      put: vi.fn(() => {
        throw new Error('thrown synchronously');
      }),
    } as unknown as Cache;
    expect(await text(withPageCache(request(), { ...deps, cache: broken }, page('c')))).toBe('c');
  });
});

describe('memoizedVersion', () => {
  it('reuses a version for the TTL and a failure only briefly', async () => {
    let clock = 0;
    const read = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('v1')
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce('v2');
    const version = memoizedVersion(read, () => clock, 10_000, 2_000);
    expect(await version()).toBeNull();
    clock = 1_999;
    expect(await version()).toBeNull(); // failure remembered: no second wait
    clock = 2_000;
    expect(await version()).toBe('v1');
    clock = 11_999;
    expect(await version()).toBe('v1');
    clock = 12_000;
    expect(await version()).toBeNull(); // a throw counts as a failure
    clock = 14_000;
    expect(await version()).toBe('v2');
    expect(read).toHaveBeenCalledTimes(4);
  });
});
