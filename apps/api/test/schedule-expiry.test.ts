import {
  dataVersionStatement,
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  referenceStatements,
  SAMPLE_CITIES,
} from '@pusatk3/db';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduled } from '../src/index';
import { expireFinishedSchedules } from '../src/lib/schedule-expiry';
import categoriesCsv from '../../../docs/data/kategori-k3.csv?raw';
import cabang from '../../../docs/data/contoh/cabang.csv?raw';
import jadwal from '../../../docs/data/contoh/jadwal.csv?raw';
import legalitas from '../../../docs/data/contoh/legalitas.csv?raw';
import penyedia from '../../../docs/data/contoh/penyedia.csv?raw';

// Daily expiry of finished schedules (#57). Raw SQL here only prepares or inspects the state.
const run = (query: string) => env.DB.prepare(query).run();
const statuses = async () =>
  (
    await env.DB.prepare('SELECT title, status FROM schedules ORDER BY title').all<{
      title: string;
      status: string;
    }>()
  ).results;
const version = async () =>
  (
    await env.DB.prepare(`SELECT value FROM app_meta WHERE key = 'data_version'`).first<{
      value: string;
    }>()
  )?.value;
const db = () => drizzle(env.DB) as never;

beforeEach(async () => {
  for (const table of [
    'leads',
    'schedules',
    'provider_licenses',
    'branches',
    'providers',
    'app_meta',
  ]) {
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
afterEach(() => vi.restoreAllMocks());

describe('expireFinishedSchedules', () => {
  it('expires published schedules that ended before today (Jakarta), not the ones ending today', async () => {
    await run(
      `UPDATE schedules SET end_date = '2027-01-14' WHERE title = 'Uji Kompetensi Petugas K3 (Contoh)'`,
    );
    await run(
      `UPDATE schedules SET end_date = '2027-01-15' WHERE title = 'Operator Forklift Kelas II (Contoh)'`,
    );
    // 2027-01-15 07:30 WIB = 00:30 UTC
    expect(await expireFinishedSchedules(db(), Date.UTC(2027, 0, 15, 0, 30))).toBe(1);
    const rows = await statuses();
    expect(rows.find((r) => r.title === 'Uji Kompetensi Petugas K3 (Contoh)')?.status).toBe(
      'expired',
    );
    expect(rows.find((r) => r.title === 'Operator Forklift Kelas II (Contoh)')?.status).toBe(
      'published',
    );
  });

  it('uses the Jakarta date: 23:30 UTC is already the next day in WIB', async () => {
    await run(
      `UPDATE schedules SET end_date = '2027-01-14' WHERE title = 'Uji Kompetensi Petugas K3 (Contoh)'`,
    );
    expect(await expireFinishedSchedules(db(), Date.UTC(2027, 0, 14, 16, 59))).toBe(0); // 23:59 WIB
    expect(await expireFinishedSchedules(db(), Date.UTC(2027, 0, 14, 17, 0))).toBe(1); // 00:00 WIB
  });

  it('never touches drafts, is idempotent, and announces a new data version only on change', async () => {
    const before = await version();
    expect(await expireFinishedSchedules(db(), Date.UTC(2026, 11, 1))).toBe(0);
    expect(await version()).toBe(before);

    const after = Date.UTC(2028, 0, 1);
    const expired = await expireFinishedSchedules(db(), after);
    expect(expired).toBe(13); // every published sample schedule; the draft stays a draft
    expect((await statuses()).filter((r) => r.status === 'draft')).toHaveLength(1);
    expect(await version()).not.toBe(before);
    const changed = await version();
    expect(await expireFinishedSchedules(db(), after)).toBe(0);
    expect(await version()).toBe(changed);
  });
});

describe('daily job', () => {
  it('runs the schedule expiry and logs counts only', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await scheduled(env, Date.UTC(2028, 0, 1));
    expect((await statuses()).every((r) => r.status !== 'published')).toBe(true);
    expect(log.mock.calls.map((call) => call[0])).toContain(
      JSON.stringify({ job: 'schedule-expiry', expired: 13 }),
    );
  });
});
