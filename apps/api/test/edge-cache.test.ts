import {
  dataVersionStatement,
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  referenceStatements,
  SAMPLE_CITIES,
} from '@pusatk3/db';
import { dataVersionResponseSchema, searchResponseSchema } from '@pusatk3/shared';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { edgeCacheKey, EDGE_CACHE_TTL_SECONDS } from '../src/middleware/edge-cache';
import categoriesCsv from '../../../docs/data/kategori-k3.csv?raw';
import cabang from '../../../docs/data/contoh/cabang.csv?raw';
import jadwal from '../../../docs/data/contoh/jadwal.csv?raw';
import legalitas from '../../../docs/data/contoh/legalitas.csv?raw';
import penyedia from '../../../docs/data/contoh/penyedia.csv?raw';
import { call as callWith, expectApiError } from './helpers';

// Edge cache for public GET responses (ADR 0021), with a private Cache API cache per test.
// Raw SQL here only prepares the database state under test.
const TODAY = Date.UTC(2026, 11, 1, 5, 0);
const run = (query: string) => env.DB.prepare(query).run();
const bumpVersion = (version: string) => run(dataVersionStatement(version));
/** A deployed version: the cache is off for the local `dev` version. */
const DEPLOYED = { ...env, APP_VERSION: 'sha-test' };
const call = (
  app: ReturnType<typeof createApp>,
  path: string,
  init?: RequestInit,
  bindings: Cloudflare.Env = DEPLOYED,
) => callWith(app, path, init, bindings);

let cache: Cache;
let clock: number;
const appWith = (versionTtlMs?: number) =>
  createApp({ now: () => clock, edgeCache: { cache: () => cache, versionTtlMs } });

beforeEach(async () => {
  clock = TODAY;
  cache = await caches.open(`edge-test-${crypto.randomUUID()}`);
  for (const table of ['schedules', 'provider_licenses', 'branches', 'providers', 'app_meta']) {
    await run(`DELETE FROM ${table}`);
  }
  const categories = parseCategoriesCsv(categoriesCsv);
  const { data } = parseDirectoryCsv(
    { penyedia, cabang, legalitas, jadwal },
    { categories: categories.categories, citySlugs: new Set(SAMPLE_CITIES.map((c) => c.slug)) },
  );
  await env.DB.batch(
    [
      ...referenceStatements({ ...categories, cities: SAMPLE_CITIES }),
      ...directoryStatements(data, { isSample: true }),
      dataVersionStatement('v1'),
    ].map((s) => env.DB.prepare(s)),
  );
});

const titles = async (res: Response) =>
  searchResponseSchema.parse(await res.json()).items.map((s) => s.title);

describe('edge cache (ADR 0021)', () => {
  it('stores a public response and serves the same body from the cache', async () => {
    const app = appWith();
    const first = await call(app, '/api/v1/search?limit=3');
    expect(first.headers.get('x-cache')).toBe('MISS');
    const second = await call(app, '/api/v1/search?limit=3');
    expect(second.headers.get('x-cache')).toBe('HIT');
    expect(await second.text()).toBe(await first.text());
    // Clients see the normal policy, never the internal edge TTL or bookkeeping headers.
    expect(second.headers.get('cache-control')).toBe(first.headers.get('cache-control'));
    expect(second.headers.get('cache-control')).toMatch(/^public, .*s-maxage=300/);
    expect([...second.headers.keys()].join()).not.toMatch(/x-pusatk3-cache-control/);
    // The request id is fresh on every answer, and security headers stay.
    expect(second.headers.get('x-request-id')).not.toBe(first.headers.get('x-request-id'));
    expect(second.headers.get('x-content-type-options')).toBe('nosniff');
    expect(second.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('stores the copy with the edge TTL, keyed on the data and app versions', async () => {
    await call(appWith(), '/api/v1/cities');
    const stored = await cache.match(
      edgeCacheKey('https://api.test/api/v1/cities', 'v1', 'sha-test', '2026-12-01'),
    );
    expect(stored?.headers.get('cache-control')).toBe(`public, max-age=${EDGE_CACHE_TTL_SECONDS}`);
    expect(stored?.headers.get('x-request-id')).toBeNull();
  });

  it('a new data version makes stored copies stale at once (import = purge)', async () => {
    const app = appWith();
    await call(app, '/api/v1/search?limit=50');
    await run(
      `UPDATE schedules SET title = 'Judul Baru (Contoh)' WHERE title LIKE 'Operator Forklift Kelas II (%'`,
    );

    const stale = await call(app, '/api/v1/search?limit=50');
    expect(stale.headers.get('x-cache')).toBe('HIT');
    expect(await titles(stale)).not.toContain('Judul Baru (Contoh)');

    await bumpVersion('v2');
    const fresh = await call(app, '/api/v1/search?limit=50');
    expect(fresh.headers.get('x-cache')).toBe('MISS');
    expect(await titles(fresh)).toContain('Judul Baru (Contoh)');
  });

  it('a new deploy (APP_VERSION) does not reuse copies of the previous one', async () => {
    const app = appWith();
    await call(app, '/api/v1/categories');
    const res = await call(app, '/api/v1/categories', undefined, { ...env, APP_VERSION: 'next' });
    expect(res.headers.get('x-cache')).toBe('MISS');
  });

  it('a new day in Jakarta does not reuse copies (finished schedules disappear)', async () => {
    const app = appWith();
    await call(app, '/api/v1/cities');
    clock = Date.UTC(2026, 11, 1, 17, 0); // 00:00 WIB on 2 December
    const res = await call(app, '/api/v1/cities');
    expect(res.headers.get('x-cache')).toBe('MISS');
  });

  it('reads the data version on every request by default (never older than the web, #29)', async () => {
    const app = appWith(undefined);
    await call(app, '/api/v1/cities');
    await bumpVersion('v2');
    expect((await call(app, '/api/v1/cities')).headers.get('x-cache')).toBe('MISS');
  });

  it('can reuse a read data version for a short time when asked', async () => {
    const app = appWith(10_000);
    await call(app, '/api/v1/cities');
    await bumpVersion('v2');
    expect((await call(app, '/api/v1/cities')).headers.get('x-cache')).toBe('HIT');
    clock += 10_000;
    expect((await call(app, '/api/v1/cities')).headers.get('x-cache')).toBe('MISS');
  });

  it.each([
    ['an invalid query', '/api/v1/search?limit=0', 422],
    ['a missing schedule', '/api/v1/schedules/01ARZ3NDEKTSV4RRFFQ69G5FAV', 404],
    ['a missing provider', '/api/v1/providers/tidak-ada', 404],
  ])('never stores %s', async (_name, path, status) => {
    const app = appWith();
    for (let i = 0; i < 2; i++) {
      const res = await call(app, path);
      expect(res.status).toBe(status);
      expect(res.headers.get('x-cache')).toBeNull();
    }
  });

  it('never stores a no-store answer (empty reference data)', async () => {
    for (const table of ['schedules', 'provider_licenses', 'branches', 'cities']) {
      await run(`DELETE FROM ${table}`);
    }
    const app = appWith();
    for (let i = 0; i < 2; i++) {
      const res = await call(app, '/api/v1/cities');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-cache')).toBeNull();
    }
  });

  it('never caches health, the data version or anything but GET', async () => {
    const app = appWith();
    for (const path of ['/api/v1/health', '/api/v1/meta/data-version']) {
      await call(app, path);
      expect((await call(app, path)).headers.get('x-cache')).toBeNull();
    }
    const head = await call(app, '/api/v1/cities', { method: 'HEAD' });
    expect(head.headers.get('x-cache')).toBeNull();
  });

  it('refuses the reserved cache parameter from clients', async () => {
    await expectApiError(
      await call(appWith(), '/api/v1/search?__cache=v1.x'),
      422,
      'VALIDATION_ERROR',
    );
  });

  it.each([
    ['a cookie', { Cookie: 'session=abc' }],
    ['an Authorization header', { Authorization: 'Bearer x' }],
  ])('never reads or fills the shared cache for a request with %s', async (_name, headers) => {
    const app = appWith();
    await call(app, '/api/v1/search?limit=2'); // anonymous copy stored
    for (let i = 0; i < 2; i++) {
      const res = await call(app, '/api/v1/search?limit=2', { headers });
      expect(res.status).toBe(200);
      expect(res.headers.get('x-cache')).toBeNull();
    }
  });

  it('ignores requests that carry the reserved parameter, even with a warm cache', async () => {
    const app = appWith();
    for (const path of ['/api/v1/search?limit=3', '/api/v1/providers/contoh-mitra-k3-jakarta']) {
      expect((await call(app, path)).headers.get('x-cache')).toBe('MISS');
      const sep = path.includes('?') ? '&' : '?';
      const res = await call(app, `${path}${sep}__cache=v1.sha-test.2026-12-01`);
      expect(res.headers.get('x-cache')).toBeNull();
      await expectApiError(res, 422, 'VALIDATION_ERROR');
    }
  });

  it('is off for the local dev version (wrangler dev, pnpm dev)', async () => {
    const app = appWith();
    for (let i = 0; i < 2; i++) {
      const res = await call(app, '/api/v1/cities', undefined, env);
      expect(env.APP_VERSION).toBe('dev');
      expect(res.headers.get('x-cache')).toBeNull();
    }
  });

  it('is off unless enabled (the default createApp)', async () => {
    const app = createApp({ now: () => clock });
    await call(app, '/api/v1/cities');
    expect((await call(app, '/api/v1/cities')).headers.get('x-cache')).toBeNull();
  });
});

describe('GET /api/v1/meta/data-version (public)', () => {
  it('returns the current version without login, never cached', async () => {
    const res = await call(createApp(), '/api/v1/meta/data-version', undefined, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(dataVersionResponseSchema.parse(await res.json())).toEqual({ version: 'v1.dev' });
    // An API deploy or rollback changes it too (web page keys follow the API output).
    const deployed = await call(createApp(), '/api/v1/meta/data-version');
    expect(dataVersionResponseSchema.parse(await deployed.json())).toEqual({
      version: 'v1.sha-test',
    });
  });

  it('is "0" before any import and changes with every import', async () => {
    await run('DELETE FROM app_meta');
    const read = async () =>
      dataVersionResponseSchema.parse(
        await (await call(createApp(), '/api/v1/meta/data-version')).json(),
      ).version;
    expect(await read()).toBe('0.sha-test');
    await run(dataVersionStatement());
    const first = await read();
    await run(dataVersionStatement());
    expect(await read()).not.toBe(first);
  });

  it('accepts no parameters', async () => {
    await expectApiError(
      await call(createApp(), '/api/v1/meta/data-version?x=1'),
      422,
      'VALIDATION_ERROR',
    );
  });
});
