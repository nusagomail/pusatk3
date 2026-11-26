import {
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  referenceStatements,
  SAMPLE_CITIES,
} from '@pusatk3/db';
import { landingPagesResponseSchema, sitemapResponseSchema } from '@pusatk3/shared';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import categoriesCsv from '../../../docs/data/kategori-k3.csv?raw';
import cabang from '../../../docs/data/contoh/cabang.csv?raw';
import jadwal from '../../../docs/data/contoh/jadwal.csv?raw';
import legalitas from '../../../docs/data/contoh/legalitas.csv?raw';
import penyedia from '../../../docs/data/contoh/penyedia.csv?raw';
import { call, expectApiError } from './helpers';

// SEO pages and sitemap (#27, ADR 0023). Sample data: Operator Forklift × Bekasi has 3 upcoming
// offline schedules from 2 providers (passes); everything else is thinner.
// Raw SQL here only prepares the database state under test.
const TODAY = Date.UTC(2026, 11, 1, 5, 0);
const app = createApp({ now: () => TODAY });
const run = (query: string) => env.DB.prepare(query).run();
const landing = async () => {
  const res = await call(app, '/api/v1/landing-pages');
  expect(res.status).toBe(200);
  return landingPagesResponseSchema.parse(await res.json()).items;
};
const sitemap = async () => {
  const res = await call(app, '/api/v1/sitemap');
  expect(res.status).toBe(200);
  return sitemapResponseSchema.parse(await res.json());
};

beforeEach(async () => {
  for (const table of ['leads', 'schedules', 'provider_licenses', 'branches', 'providers']) {
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
    ].map((s) => env.DB.prepare(s)),
  );
});

describe('GET /api/v1/landing-pages (public)', () => {
  it('lists only category × city pages with ≥3 schedules from ≥2 providers, cacheable', async () => {
    const res = await call(app, '/api/v1/landing-pages');
    expect(res.headers.get('cache-control')).toMatch(/^public, .*s-maxage=/);
    expect(await landing()).toEqual([
      {
        category: { slug: 'operator-forklift', name: expect.stringMatching(/^Operator Forklift/) },
        city: { slug: 'bekasi', name: 'Bekasi' },
        schedules: 3,
        providers: 2,
        isSample: true,
      },
    ]);
  });

  it.each([
    ['a draft', `UPDATE schedules SET status = 'draft' WHERE title LIKE '%Cabang Bekasi%'`],
    [
      'a schedule that already started',
      `UPDATE schedules SET start_date = '2026-11-30' WHERE title LIKE '%Cabang Bekasi%'`,
    ],
    [
      'a closed provider',
      `UPDATE providers SET status = 'closed' WHERE slug = 'contoh-mitra-k3-jakarta'`,
    ],
  ])('drops the page when %s leaves it below the threshold', async (_name, change) => {
    await run(change);
    expect(await landing()).toEqual([]);
  });

  it('needs two providers: three schedules of one provider are thin content', async () => {
    await run(
      `UPDATE schedules SET provider_id = (SELECT id FROM providers WHERE slug = 'contoh-pusat-pelatihan-k3-bekasi'),
         branch_id = (SELECT id FROM branches WHERE name = 'Kampus Bekasi')
       WHERE title LIKE '%Cabang Bekasi%'`,
    );
    expect(await landing()).toEqual([]);
  });

  it('never counts online schedules (they belong to no city)', async () => {
    await run(
      `UPDATE schedules SET mode = 'online', branch_id = NULL WHERE title LIKE '%Cabang Bekasi%'`,
    );
    expect(await landing()).toEqual([]);
  });

  it('is sample (noindex) when real data alone does not pass, as in the sitemap', async () => {
    await run(`UPDATE providers SET is_sample = 0 WHERE slug = 'contoh-pusat-pelatihan-k3-bekasi'`);
    // Real: 2 schedules from 1 provider; the third is sample → still noindex, not in the sitemap.
    expect((await landing())[0]?.isSample).toBe(true);
    expect((await sitemap()).landingPages).toEqual([]);
  });

  it('marks a page with real data only as not sample', async () => {
    await run(`UPDATE providers SET is_sample = 0`);
    expect((await landing())[0]?.isSample).toBe(false);
  });

  it('accepts no parameters', async () => {
    await expectApiError(
      await call(app, '/api/v1/landing-pages?city=bekasi'),
      422,
      'VALIDATION_ERROR',
    );
  });
});

describe('GET /api/v1/sitemap (public)', () => {
  it('never lists sample data', async () => {
    expect(await sitemap()).toEqual({ landingPages: [], providers: [], schedules: [] });
  });

  it('lists real landing pages, open providers and visible schedules', async () => {
    await run(`UPDATE providers SET is_sample = 0`);
    await run(`UPDATE providers SET status = 'closed' WHERE slug = 'contoh-tuk-k3-tangerang'`);
    const body = await sitemap();
    expect(body.landingPages).toEqual([{ category: 'operator-forklift', city: 'bekasi' }]);
    expect(body.providers).toEqual([
      'contoh-lsp-k3-nusantara',
      'contoh-mitra-k3-jakarta',
      'contoh-pusat-pelatihan-k3-bekasi',
    ]);
    // 13 published minus the one of the closed provider; the draft never appears.
    expect(body.schedules).toHaveLength(12);
  });

  it('exposes nothing but URL keys (no names, contacts, plans)', async () => {
    await run(`UPDATE providers SET is_sample = 0, plan = 'business', whatsapp = '6281234567890'`);
    const text = await (await call(app, '/api/v1/sitemap')).text();
    expect(text).not.toMatch(/business|6281234567890|Contoh\)/);
  });

  it('accepts no parameters', async () => {
    await expectApiError(await call(app, '/api/v1/sitemap?x=1'), 422, 'VALIDATION_ERROR');
  });
});
