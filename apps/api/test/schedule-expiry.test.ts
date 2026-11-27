import {
  dataVersionStatement,
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  referenceStatements,
  SAMPLE_CITIES,
} from '@pusatk3/db';
import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { scheduled } from '../src/index';
import { getDb } from '../src/lib/db';
import * as leadRetention from '../src/lib/lead-retention';
import { expireFinishedSchedules } from '../src/lib/schedule-expiry';
import categoriesCsv from '../../../docs/data/kategori-k3.csv?raw';
import cabang from '../../../docs/data/contoh/cabang.csv?raw';
import jadwal from '../../../docs/data/contoh/jadwal.csv?raw';
import legalitas from '../../../docs/data/contoh/legalitas.csv?raw';
import penyedia from '../../../docs/data/contoh/penyedia.csv?raw';
import { call } from './helpers';

// Daily expiry of finished schedules (#57). Raw SQL here only prepares or inspects the state.
const run = (query: string) => env.DB.prepare(query).run();
const rows = async () =>
  (
    await env.DB.prepare('SELECT id, title, status, updated_at FROM schedules ORDER BY title').all<{
      id: string;
      title: string;
      status: string;
      updated_at: number;
    }>()
  ).results;
const version = async () =>
  (
    await env.DB.prepare(`SELECT value FROM app_meta WHERE key = 'data_version'`).first<{
      value: string;
    }>()
  )?.value;
const db = () => getDb(env);
const FAR_FUTURE = Date.UTC(2028, 0, 1);

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
    const now = Date.UTC(2027, 0, 15, 0, 30); // 2027-01-15 07:30 WIB
    expect(await expireFinishedSchedules(db(), now)).toBe(1);
    const after = await rows();
    const ended = after.find((r) => r.title === 'Uji Kompetensi Petugas K3 (Contoh)');
    expect(ended).toMatchObject({ status: 'expired', updated_at: now });
    expect(after.find((r) => r.title === 'Operator Forklift Kelas II (Contoh)')?.status).toBe(
      'published',
    );
  });

  it('uses the Jakarta date: 17:00 UTC is already the next day in WIB', async () => {
    await run(
      `UPDATE schedules SET end_date = '2027-01-14' WHERE title = 'Uji Kompetensi Petugas K3 (Contoh)'`,
    );
    expect(await expireFinishedSchedules(db(), Date.UTC(2027, 0, 14, 16, 59))).toBe(0); // 23:59 WIB
    expect(await expireFinishedSchedules(db(), Date.UTC(2027, 0, 14, 17, 0))).toBe(1); // 00:00 WIB
  });

  it('never touches drafts, never counts a row twice, and renews the data version every run', async () => {
    const published = (await rows()).filter((r) => r.status === 'published').length;
    const drafts = (await rows()).filter((r) => r.status === 'draft').length;
    expect(await expireFinishedSchedules(db(), FAR_FUTURE)).toBe(published);
    expect((await rows()).filter((r) => r.status === 'draft')).toHaveLength(drafts);
    const first = await version();
    expect(first).not.toBe('v1');
    expect(await expireFinishedSchedules(db(), FAR_FUTURE)).toBe(0);
    // Renewed even without changes: copies cached after midnight under the new date go stale too.
    expect(await version()).not.toBe(first);
  });
});

describe('daily job', () => {
  it('runs the schedule expiry and logs counts only', async () => {
    const published = (await rows()).filter((r) => r.status === 'published').length;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await scheduled(env, FAR_FUTURE);
    expect((await rows()).every((r) => r.status !== 'published')).toBe(true);
    expect(log.mock.calls.map((call) => call[0])).toContain(
      JSON.stringify({ job: 'schedule-expiry', expired: published }),
    );
  });

  it('one failing job never skips the next one, and the failure still surfaces', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(leadRetention, 'anonymizeExpiredLeads').mockRejectedValue(new RangeError('boom'));
    await expect(scheduled(env, FAR_FUTURE)).rejects.toThrow('boom');
    // The schedule expiry ran anyway.
    expect((await rows()).every((r) => r.status !== 'published')).toBe(true);
    expect(errors.mock.calls.map((call) => call[0])).toEqual([
      JSON.stringify({ job: 'lead-retention', error: 'RangeError' }),
      JSON.stringify({ job: 'daily', failed: ['lead-retention'] }),
    ]);
  });
});

describe('edge cache guard (ADR 0021)', () => {
  it('a cached detail of a finished schedule is dropped after the daily job', async () => {
    const cache = await caches.open(`expiry-${crypto.randomUUID()}`);
    const deployed = { ...env, APP_VERSION: 'sha-test' };
    const today = Date.UTC(2026, 11, 1, 5, 0);
    const app = createApp({ now: () => today, edgeCache: { cache: () => cache } });
    const [target] = await rows();
    const path = `/api/v1/schedules/${target?.id}`;
    expect((await call(app, path, undefined, deployed)).headers.get('x-cache')).toBe('MISS');
    expect((await call(app, path, undefined, deployed)).headers.get('x-cache')).toBe('HIT');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(
      `UPDATE schedules SET start_date = '2026-11-28', end_date = '2026-11-30' WHERE id = '${target?.id}'`,
    );
    await scheduled(env, today);
    const after = await call(app, path, undefined, deployed);
    expect(after.status).toBe(404);
    expect(after.headers.get('x-cache')).toBeNull();
  });
});
