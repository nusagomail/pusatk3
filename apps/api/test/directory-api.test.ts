import {
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  referenceStatements,
  SAMPLE_CITIES,
} from '@pusatk3/db';
import {
  citiesResponseSchema,
  providerProfileSchema,
  scheduleDetailSchema,
  searchResponseSchema,
} from '@pusatk3/shared';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { jakartaToday } from '../src/routes/directory';
import categoriesCsv from '../../../docs/data/kategori-k3.csv?raw';
import cabang from '../../../docs/data/contoh/cabang.csv?raw';
import jadwal from '../../../docs/data/contoh/jadwal.csv?raw';
import legalitas from '../../../docs/data/contoh/legalitas.csv?raw';
import penyedia from '../../../docs/data/contoh/penyedia.csv?raw';
import { call, expectApiError } from './helpers';

// Public directory API against the Jabodetabek sample data (13 published + 1 draft schedule).
// Raw SQL here only prepares the database state under test.
// "Today" is pinned so the 2027 sample schedules stay upcoming whenever the tests run.
const TODAY = Date.UTC(2026, 11, 1, 5, 0);
const app = createApp({ now: () => TODAY });
const api = (path: string, init?: RequestInit) => call(app, `/api/v1${path}`, init);
const run = (query: string) => env.DB.prepare(query).run();
const search = async (query = '') => {
  const res = await api(`/search${query}`);
  expect(res.status).toBe(200);
  return searchResponseSchema.parse(await res.json());
};

beforeEach(async () => {
  for (const table of ['schedules', 'provider_licenses', 'branches', 'providers']) {
    await run(`DELETE FROM ${table}`);
  }
  const categories = parseCategoriesCsv(categoriesCsv);
  const { data } = parseDirectoryCsv(
    { penyedia, cabang, legalitas, jadwal },
    { categories: categories.categories, citySlugs: new Set(SAMPLE_CITIES.map((c) => c.slug)) },
  );
  const statements = [
    ...referenceStatements({ ...categories, cities: SAMPLE_CITIES }),
    ...directoryStatements(data, { isSample: true }),
  ];
  await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
});

describe('GET /api/v1/search (public)', () => {
  it('works without login, soonest first, cacheable, sponsors separate', async () => {
    const res = await api('/search');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/^public, .*s-maxage=/);
    const body = searchResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(13);
    expect(body.sponsored).toEqual([]);
    const dates = body.items.map((s) => s.startDate);
    expect(dates).toEqual([...dates].sort());
  });

  it('returns only the documented fields (no plan, raw status or internal ids)', async () => {
    await run(`UPDATE providers SET plan = 'business'`);
    const raw = (await (await api('/search?limit=1')).json()) as {
      items: Record<string, unknown>[];
    };
    const item = raw.items[0] as Record<string, Record<string, unknown>>;
    expect(Object.keys(item).sort()).toEqual(
      [
        'category',
        'certificateKind',
        'city',
        'endDate',
        'id',
        'issuer',
        'level',
        'mode',
        'priceIdr',
        'provider',
        'startDate',
        'title',
      ].sort(),
    );
    expect(Object.keys(item.provider ?? {}).sort()).toEqual(
      ['isSample', 'name', 'slug', 'type', 'verified'].sort(),
    );
    expect(JSON.stringify(raw)).not.toMatch(/business|plan|verification|is_sample|provider_id/);
  });

  it('marks sample data and derives the badge only from verification (never from the plan)', async () => {
    await run(`UPDATE providers SET plan = 'business'`);
    const body = await search();
    expect(body.items.every((s) => s.provider.isSample && !s.provider.verified)).toBe(true);
    await run(
      `UPDATE providers SET verification_status = 'verified' WHERE slug = 'contoh-lsp-k3-nusantara'`,
    );
    const verified = await search('?verified=true');
    expect(verified.items.map((s) => s.provider.slug)).toEqual([
      'contoh-lsp-k3-nusantara',
      'contoh-lsp-k3-nusantara',
    ]);
    expect(verified.items.every((s) => s.provider.verified)).toBe(true);
  });

  it('never ranks by plan: a paying provider keeps its date position', async () => {
    const before = (await search()).items.map((s) => s.id);
    await run(`UPDATE providers SET plan = 'business' WHERE slug = 'contoh-tuk-k3-tangerang'`);
    expect((await search()).items.map((s) => s.id)).toEqual(before);
  });

  it.each([
    ['?city=bekasi', (s: { city: { slug: string } | null }) => s.city?.slug === 'bekasi', 6],
    [
      '?mode=online',
      (s: { mode: string; city: unknown }) => s.mode === 'online' && s.city === null,
      2,
    ],
    ['?issuer=bnsp', (s: { issuer: string }) => s.issuer === 'bnsp', 3],
    [
      '?category=operator-forklift',
      (s: { category: { slug: string } }) => s.category.slug === 'operator-forklift',
      3,
    ],
    [
      '?field=kebakaran',
      (s: { category: { slug: string } }) => s.category.slug === 'ahli-k3-kebakaran',
      1,
    ],
    ['?month=2027-02', (s: { startDate: string }) => s.startDate.startsWith('2027-02'), 5],
    [
      '?priceMin=3500000&priceMax=4000000',
      (s: { priceIdr: number | null }) =>
        (s.priceIdr ?? 0) >= 3_500_000 && (s.priceIdr ?? 0) <= 4_000_000,
      5,
    ],
    ['?q=forklift', (s: { title: string }) => /forklift/i.test(s.title), 3],
    [
      '?q=NUSANTARA',
      (s: { provider: { slug: string } }) => s.provider.slug === 'contoh-lsp-k3-nusantara',
      2,
    ],
  ])('filters %s', async (query, predicate, expected) => {
    const body = await search(query);
    expect(body.items).toHaveLength(expected);
    expect(body.items.every((s) => (predicate as (s: unknown) => boolean)(s))).toBe(true);
  });

  it('treats empty form values as not set', async () => {
    expect((await search('?q=&city=&mode=&sort=')).items).toHaveLength(13);
  });

  it('hides schedules that already started (registration is over), detail still opens', async () => {
    await run(
      `UPDATE schedules SET start_date = '2026-11-30', end_date = '2026-12-05' WHERE title = 'Pembinaan Ahli K3 Umum (Contoh)'`,
    );
    const titles = (await search()).items.map((s) => s.title);
    expect(titles).not.toContain('Pembinaan Ahli K3 Umum (Contoh)');
    const id = (
      await env.DB.prepare(
        `SELECT id FROM schedules WHERE title = 'Pembinaan Ahli K3 Umum (Contoh)'`,
      ).first<{ id: string }>()
    )?.id;
    expect((await api(`/schedules/${id}`)).status).toBe(200);
  });

  it('accepts the last allowed cursor and stops there', async () => {
    const body = await search('?cursor=1000');
    expect(body).toMatchObject({ items: [], nextCursor: null });
  });

  it('breaks date ties by id, never by plan', async () => {
    await run(`UPDATE schedules SET start_date = '2027-01-11' WHERE status = 'published'`);
    const before = (await search()).items.map((s) => s.id);
    expect(before).toEqual([...before].sort());
    await run(`UPDATE providers SET plan = 'business' WHERE slug = 'contoh-tuk-k3-tangerang'`);
    expect((await search()).items.map((s) => s.id)).toEqual(before);
    expect((await search('?sort=price')).items.length).toBe(13);
  });

  it('answers the same for everyone and never sets cookies (safe to cache)', async () => {
    const anonymous = await api('/search?limit=3');
    const withCredentials = await api('/search?limit=3', {
      headers: { Cookie: 'session=abc', Authorization: 'Bearer x' },
    });
    expect(anonymous.headers.get('set-cookie')).toBeNull();
    expect(withCredentials.headers.get('set-cookie')).toBeNull();
    expect(await withCredentials.text()).toBe(await anonymous.text());
  });

  it('treats % and _ in the text as letters, not wildcards', async () => {
    expect((await search('?q=%25')).items).toHaveLength(0);
    expect((await search('?q=_')).items).toHaveLength(0);
  });

  it('sorts by price with unknown prices last', async () => {
    await run(`UPDATE schedules SET price_idr = NULL WHERE title LIKE 'Pelatihan Pemahaman ISO%'`);
    const prices = (await search('?sort=price')).items.map((s) => s.priceIdr);
    expect(prices.at(-1)).toBeNull();
    const known = prices.filter((p): p is number => p !== null);
    expect(known).toEqual([...known].sort((a, b) => a - b));
  });

  it('pages with a cursor and ends with nextCursor null', async () => {
    const first = await search('?limit=5');
    expect(first.items).toHaveLength(5);
    expect(first.nextCursor).toBe('5');
    const second = await search('?limit=5&cursor=5');
    const third = await search('?limit=5&cursor=10');
    expect(third.items).toHaveLength(3);
    expect(third.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items, ...third.items].map((s) => s.id);
    expect(new Set(ids).size).toBe(13);
  });

  it('hides drafts, expired and ended schedules, and closed providers', async () => {
    await run(`UPDATE schedules SET status = 'expired' WHERE title LIKE 'Operator Forklift%'`);
    await run(
      `UPDATE schedules SET start_date = '2020-01-01', end_date = '2020-01-02' WHERE title LIKE 'Pembinaan Ahli K3 Listrik%'`,
    );
    await run(`UPDATE providers SET status = 'closed' WHERE slug = 'contoh-tuk-k3-tangerang'`);
    const titles = (await search()).items.map((s) => s.title);
    expect(titles).toHaveLength(8);
    expect(titles.join()).not.toMatch(/Forklift|Listrik|TUK Tangerang|Gelombang 2/);
  });

  it.each([
    '?unknown=1',
    '?utm_source=x',
    '?month=2027-13',
    '?priceMin=5000000&priceMax=1000',
    '?priceMin=1.000',
    '?limit=0',
    '?cursor=abc',
    '?cursor=2000',
    '?sort=plan',
    '?verified=1',
    '?mode=hybrid',
    `?q=${'a'.repeat(101)}`,
  ])('rejects %s with 422', async (query) => {
    await expectApiError(await api(`/search${query}`), 422, 'VALIDATION_ERROR');
  });
});

describe('detail and profile take no query parameters (ADR 0021)', () => {
  it.each([
    '/providers/contoh-mitra-k3-jakarta?x=1',
    '/providers/contoh-mitra-k3-jakarta?__cache=a',
  ])('%s → 422', async (path) => {
    await expectApiError(await api(path), 422, 'VALIDATION_ERROR');
  });

  it('rejects a query on a schedule detail too', async () => {
    const [first] = (await search('?limit=1')).items;
    await expectApiError(
      await api(`/schedules/${first?.id ?? ''}?utm_source=x`),
      422,
      'VALIDATION_ERROR',
    );
    expect((await api(`/schedules/${first?.id ?? ''}`)).status).toBe(200);
  });
});

describe('GET /api/v1/schedules/:id (public)', () => {
  const idOf = async (titleLike: string) =>
    (
      await env.DB.prepare(`SELECT id FROM schedules WHERE title LIKE ?`)
        .bind(titleLike)
        .first<{ id: string }>()
    )?.id as string;

  it('returns the detail with branch, contact and licenses, without document keys', async () => {
    await run(`UPDATE provider_licenses SET document_key = 'rahasia/izin.pdf'`);
    const res = await api(`/schedules/${await idOf('Pembinaan Ahli K3 Umum (Contoh)')}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/^public, /);
    const text = await res.text();
    expect(text).not.toMatch(/rahasia|document|plan/);
    const body = scheduleDetailSchema.parse(JSON.parse(text));
    expect(body.branch).toMatchObject({ name: 'Kantor Pusat Jakarta', city: { slug: 'jakarta' } });
    expect(body.provider.licenses).toEqual([
      {
        kind: 'izin_pjk3',
        number: 'CONTOH/PJK3/001',
        issuer: 'Kemnaker RI (contoh)',
        validUntil: '2029-12-31',
      },
    ]);
    expect(body.provider.contact).toEqual({
      whatsapp: null,
      email: null,
      phone: null,
      website: null,
    });
    // Unclaimed: nobody reads questions yet, so the form stays hidden (ADR 0022).
    expect(body.provider.acceptsQuestions).toBe(false);
  });

  it('accepts questions only once the provider claimed its profile', async () => {
    const id = await idOf('Pembinaan Ahli K3 Umum (Contoh)');
    await run(`UPDATE providers SET status = 'claimed' WHERE slug = 'contoh-mitra-k3-jakarta'`);
    const body = scheduleDetailSchema.parse(await (await api(`/schedules/${id}`)).json());
    expect(body.provider.acceptsQuestions).toBe(true);
  });

  it('404 for expired schedules', async () => {
    const id = await idOf('Pembinaan Ahli K3 Listrik%');
    await run(`UPDATE schedules SET status = 'expired' WHERE id = '${id}'`);
    await expectApiError(await api(`/schedules/${id}`), 404, 'NOT_FOUND');
  });

  it('online schedules have no branch', async () => {
    const res = await api(`/schedules/${await idOf('Pembinaan Ahli K3 Umum Online%')}`);
    expect(scheduleDetailSchema.parse(await res.json()).branch).toBeNull();
  });

  it('404 for drafts, closed providers and unknown ids (no leak)', async () => {
    await expectApiError(await api(`/schedules/${await idOf('%Gelombang 2%')}`), 404, 'NOT_FOUND');
    const id = await idOf('Uji Kompetensi Petugas K3 di TUK%');
    await run(`UPDATE providers SET status = 'closed' WHERE slug = 'contoh-tuk-k3-tangerang'`);
    await expectApiError(await api(`/schedules/${id}`), 404, 'NOT_FOUND');
    await expectApiError(await api('/schedules/01JAAAAAAAAAAAAAAAAAAAAAAA'), 404, 'NOT_FOUND');
  });

  it.each(['abc', '01jaaaaaaaaaaaaaaaaaaaaaaa', "1' OR '1'='1"])(
    'rejects id %j with 422',
    async (id) => {
      await expectApiError(
        await api(`/schedules/${encodeURIComponent(id)}`),
        422,
        'VALIDATION_ERROR',
      );
    },
  );
});

describe('GET /api/v1/providers/:slug (public)', () => {
  it('returns the profile: main branch first, licenses, visible schedules only', async () => {
    const res = await api('/providers/contoh-mitra-k3-jakarta');
    expect(res.status).toBe(200);
    const body = providerProfileSchema.parse(await res.json());
    expect(body).toMatchObject({
      name: 'Mitra K3 Jakarta (Contoh)',
      type: 'pjk3',
      isSample: true,
      verified: false,
    });
    expect(body.branches.map((b) => b.name)).toEqual(['Kantor Pusat Jakarta', 'Cabang Bekasi']);
    expect(body.licenses).toHaveLength(1);
    expect(body.schedules).toHaveLength(5);
  });

  it('does not list the draft schedule', async () => {
    const body = providerProfileSchema.parse(
      await (await api('/providers/contoh-pusat-pelatihan-k3-bekasi')).json(),
    );
    expect(body.schedules.map((s) => s.title).join()).not.toMatch(/Gelombang 2/);
  });

  it('404 for closed and unknown providers', async () => {
    await run(`UPDATE providers SET status = 'closed' WHERE slug = 'contoh-tuk-k3-tangerang'`);
    await expectApiError(await api('/providers/contoh-tuk-k3-tangerang'), 404, 'NOT_FOUND');
    await expectApiError(await api('/providers/tidak-ada'), 404, 'NOT_FOUND');
  });

  it('rejects a malformed slug with 422', async () => {
    await expectApiError(await api('/providers/Bukan%20Slug'), 422, 'VALIDATION_ERROR');
  });
});

describe('GET /api/v1/cities (public)', () => {
  it('lists cities by name, cacheable', async () => {
    const res = await api('/cities');
    expect(res.headers.get('cache-control')).toMatch(/^public, /);
    const names = citiesResponseSchema.parse(await res.json()).items.map((c) => c.name);
    expect(names).toHaveLength(SAMPLE_CITIES.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('rejects parameters', async () => {
    await expectApiError(await api('/cities?x=1'), 422, 'VALIDATION_ERROR');
  });
});

describe('jakartaToday', () => {
  it('uses UTC+7: 18:00 UTC is already the next day in Jakarta', () => {
    expect(jakartaToday(Date.UTC(2027, 0, 10, 18, 0))).toBe('2027-01-11');
    expect(jakartaToday(Date.UTC(2027, 0, 10, 16, 59))).toBe('2027-01-10');
  });
});
