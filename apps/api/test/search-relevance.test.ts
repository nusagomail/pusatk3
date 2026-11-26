import {
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  referenceStatements,
  SAMPLE_CITIES,
} from '@pusatk3/db';
import { searchResponseSchema } from '@pusatk3/shared';
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { searchTokens } from '../src/routes/directory';
import categoriesCsv from '../../../docs/data/kategori-k3.csv?raw';
import cabang from '../../../docs/data/contoh/cabang.csv?raw';
import jadwal from '../../../docs/data/contoh/jadwal.csv?raw';
import legalitas from '../../../docs/data/contoh/legalitas.csv?raw';
import penyedia from '../../../docs/data/contoh/penyedia.csv?raw';
import { call } from './helpers';

// Search relevance for common K3 terms (#26). Besides the sample data, every one of the 59
// categories gets one online schedule with a neutral title, so only the category name, its
// synonyms and the field name decide a match. Raw SQL here only prepares the database state.
const TODAY = Date.UTC(2026, 11, 1, 5, 0);
const app = createApp({ now: () => TODAY });
const NEUTRAL = 'Jadwal uji relevansi';

async function search(q: string) {
  const res = await call(app, `/api/v1/search?limit=100&q=${encodeURIComponent(q)}`);
  expect(res.status).toBe(200);
  return searchResponseSchema.parse(await res.json()).items;
}
/** Category slugs found through the neutral schedules only. */
const categoriesFor = async (q: string) =>
  new Set((await search(q)).filter((s) => s.title === NEUTRAL).map((s) => s.category.slug));

beforeAll(async () => {
  for (const table of ['schedules', 'provider_licenses', 'branches', 'providers']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
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
  await env.DB.prepare(
    `INSERT INTO schedules (id, created_at, updated_at, provider_id, category_id, title, issuer,
       mode, start_date, end_date, certificate_kind, status)
     SELECT 'rel-' || c.slug, 0, 0, (SELECT id FROM providers WHERE slug = 'contoh-lsp-k3-nusantara'),
       c.id, ?, 'kemnaker', 'online', '2027-06-01', '2027-06-02', 'official', 'published'
     FROM course_categories c`,
  )
    .bind(NEUTRAL)
    .run();
});

describe('searchTokens', () => {
  it.each([
    ['AK3U', ['ak3u']],
    ['  Ahli-K3, Umum! ', ['ahli', 'k3', 'umum']],
    ['sio SIO forklift', ['sio', 'forklift']],
    ['%_\\', []],
    ['a b c d e f g h', ['a', 'b', 'c', 'd', 'e', 'f']],
  ])('%j → %j', (q, tokens) => {
    expect(searchTokens(q)).toEqual(tokens);
  });
});

describe('search relevance for common K3 terms (#26)', () => {
  it.each([
    ['AK3U', ['ahli-k3-umum']],
    ['ahli k3 umum', ['ahli-k3-umum']],
    ['sio forklift', ['operator-forklift']],
    ['operator forklift', ['operator-forklift']],
    ['lisensi forklift', ['operator-forklift']],
    ['excavator', ['operator-alat-berat']],
    ['scaffolding', ['teknisi-perancah', 'supervisi-perancah']],
    ['confined space', ['petugas-ruang-terbatas', 'rescuer-ruang-terbatas']],
    ['fire warden', ['petugas-peran-kebakaran']],
    ['P3K', ['petugas-p3k']],
    ['first aid', ['petugas-p3k']],
    ['rigger', ['juru-ikat']],
    ['welder', ['juru-las']],
    ['boiler', ['operator-boiler', 'ahli-k3-pubt']],
    ['work at height', ['tkbt', 'tkpk']],
    ['hiperkes', ['hiperkes-dokter', 'hiperkes-paramedis']],
    ['ska k3', ['skk-ahli-k3-konstruksi']],
    ['BOSIET', ['offshore-survival']],
    ['iso 45001', ['iso-45001']],
  ])('%j finds %j', async (q, expected) => {
    const found = await categoriesFor(q);
    for (const slug of expected) expect(found, `${q} → ${slug}`).toContain(slug);
  });

  it.each([
    ['sio forklift', ['operator-crane', 'pengawas-operasional-tambang', 'juru-ikat']],
    // Whole words from the start: "sio" is not inside "operasional", "las" not inside "kelas".
    ['sio', ['pengawas-operasional-tambang', 'ahli-k3-kebakaran']],
    ['las', ['ahli-k3-kebakaran', 'regu-kebakaran']],
    ['fire warden', ['regu-kebakaran', 'ahli-k3-kebakaran']],
    ['scaffolding', ['tkbt', 'operator-crane']],
  ])('%j does not find unrelated %j', async (q, unrelated) => {
    const found = await categoriesFor(q);
    for (const slug of unrelated) expect(found, `${q} ↛ ${slug}`).not.toContain(slug);
  });

  it('every word must match, in any field: category, provider, city or title', async () => {
    const items = await search('forklift bekasi');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((s) => s.category.slug === 'operator-forklift')).toBe(true);
    expect(items.every((s) => s.city?.slug === 'bekasi')).toBe(true);
    expect(await search('forklift surabaya')).toHaveLength(0);
  });

  it('finds the field name ("listrik") and the provider name', async () => {
    const electrical = await categoriesFor('listrik');
    for (const slug of ['ahli-k3-listrik', 'teknisi-k3-listrik', 'skttk']) {
      expect(electrical).toContain(slug);
    }
    expect(electrical).not.toContain('operator-forklift');
    const byProvider = await search('nusantara ahli k3 muda');
    expect(byProvider.some((s) => s.provider.slug === 'contoh-lsp-k3-nusantara')).toBe(true);
  });

  it('is case and punctuation insensitive', async () => {
    expect(await categoriesFor('AHLI-K3 (umum)')).toEqual(await categoriesFor('ahli k3 umum'));
  });

  it('text made only of symbols finds nothing', async () => {
    expect(await search('%')).toHaveLength(0);
    expect(await search('()')).toHaveLength(0);
  });
});
