import {
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  referenceStatements,
  SAMPLE_CITIES,
  type DirectoryCsvFiles,
} from '@pusatk3/db';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import categoriesCsv from '../../../docs/data/kategori-k3.csv?raw';
import cabang from '../../../docs/data/contoh/cabang.csv?raw';
import jadwal from '../../../docs/data/contoh/jadwal.csv?raw';
import legalitas from '../../../docs/data/contoh/legalitas.csv?raw';
import penyedia from '../../../docs/data/contoh/penyedia.csv?raw';

// The import SQL (same statements as `pnpm db:import:local` and the staging pipeline) applied to
// a real local D1. Raw SQL in this file only inspects or prepares the database under test.
const categories = parseCategoriesCsv(categoriesCsv);
const reference = {
  categories: categories.categories,
  citySlugs: new Set(SAMPLE_CITIES.map((c) => c.slug)),
};
const sample: DirectoryCsvFiles = { penyedia, cabang, legalitas, jadwal };

async function runImport(files: DirectoryCsvFiles = sample) {
  const { data, problems } = parseDirectoryCsv(files, reference);
  expect(problems).toEqual([]);
  const statements = [
    ...referenceStatements({ ...categories, cities: SAMPLE_CITIES }),
    ...directoryStatements(data, { isSample: true }),
  ];
  await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
}
const all = async <T>(query: string) => (await env.DB.prepare(query).all<T>()).results;
const one = async <T>(query: string) => env.DB.prepare(query).first<T>();
const count = async (table: string) =>
  (await one<{ n: number }>(`SELECT count(*) AS n FROM ${table}`))?.n;

beforeEach(async () => {
  for (const table of ['schedules', 'provider_licenses', 'branches', 'providers']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe('directory import into D1', () => {
  it('loads the reference data and the sample region', async () => {
    await runImport();
    expect(await count('course_categories')).toBe(59);
    expect(await count('cities')).toBe(SAMPLE_CITIES.length);
    expect(await count('providers')).toBe(4);
    expect(await count('branches')).toBe(5);
    expect(await count('provider_licenses')).toBe(4);
    expect(await count('schedules')).toBe(12);
  });

  it('marks sample providers and never sets status, verification or plan', async () => {
    await runImport();
    expect(
      await all('SELECT DISTINCT is_sample, status, verification_status, plan FROM providers'),
    ).toEqual([{ is_sample: 1, status: 'unclaimed', verification_status: 'none', plan: 'free' }]);
  });

  it('links offline schedules to a branch of the same provider and online ones to none', async () => {
    await runImport();
    const rows = await all<{ mode: string; branch_owner: string | null; provider_id: string }>(
      `SELECT s.mode, b.provider_id AS branch_owner, s.provider_id
       FROM schedules s LEFT JOIN branches b ON b.id = s.branch_id`,
    );
    for (const row of rows) {
      if (row.mode === 'offline') expect(row.branch_owner).toBe(row.provider_id);
      else expect(row.branch_owner).toBeNull();
    }
    expect(rows.filter((r) => r.mode === 'online')).toHaveLength(2);
  });

  it('is idempotent: a second run keeps ids and adds nothing', async () => {
    await runImport();
    const before = await all('SELECT id, slug FROM providers ORDER BY slug');
    const schedulesBefore = await all('SELECT id FROM schedules ORDER BY id');
    await runImport();
    expect(await all('SELECT id, slug FROM providers ORDER BY slug')).toEqual(before);
    expect(await all('SELECT id FROM schedules ORDER BY id')).toEqual(schedulesBefore);
  });

  it('updates changed values in place', async () => {
    await runImport();
    await runImport({ ...sample, jadwal: jadwal.replace('5.500.000', '5.750.000') });
    expect(
      await one(`SELECT price_idr FROM schedules WHERE title = 'Pembinaan Ahli K3 Umum (Contoh)'`),
    ).toEqual({ price_idr: 5_750_000 });
    expect(await count('schedules')).toBe(12);
  });

  it('never deletes rows that are missing from the import', async () => {
    await runImport();
    await runImport({ ...sample, jadwal: jadwal.split('\n').slice(0, 2).join('\n') });
    expect(await count('schedules')).toBe(12);
  });

  it('keeps plan and status set outside the import', async () => {
    await runImport();
    await env.DB.prepare(`UPDATE providers SET plan = 'pro', status = 'claimed'`).run();
    await runImport();
    expect(await all('SELECT DISTINCT plan, status FROM providers')).toEqual([
      { plan: 'pro', status: 'claimed' },
    ]);
  });

  describe('rule 6: verified providers go back to pending', () => {
    const slug = 'contoh-mitra-k3-jakarta';
    const status = async () =>
      (
        await one<{ s: string }>(
          `SELECT verification_status AS s FROM providers WHERE slug = '${slug}'`,
        )
      )?.s;
    const verify = () =>
      env.DB.prepare(
        `UPDATE providers SET verification_status = 'verified' WHERE slug = '${slug}'`,
      ).run();

    it('stays verified when nothing relevant changed', async () => {
      await runImport();
      await verify();
      await runImport({ ...sample, jadwal: jadwal.replace('5.500.000', '5.600.000') });
      expect(await status()).toBe('verified');
    });

    it('when the WhatsApp number changes', async () => {
      await runImport();
      await verify();
      const withWa = penyedia.replace('ketinggian.",,,,', 'ketinggian.",0812-3456-7890,,,');
      await runImport({ ...sample, penyedia: withWa });
      expect(await status()).toBe('pending');
    });

    it('when license data changes', async () => {
      await runImport();
      await verify();
      await runImport({ ...sample, legalitas: legalitas.replace('2029-12-31', '2030-12-31') });
      expect(await status()).toBe('pending');
    });

    it('only for the provider whose data changed', async () => {
      await runImport();
      await env.DB.prepare(`UPDATE providers SET verification_status = 'verified'`).run();
      await runImport({ ...sample, legalitas: legalitas.replace('2029-12-31', '2030-12-31') });
      expect(
        await all(
          `SELECT DISTINCT verification_status AS s FROM providers WHERE slug <> '${slug}'`,
        ),
      ).toEqual([{ s: 'verified' }]);
    });
  });
});
