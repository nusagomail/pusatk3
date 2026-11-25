import { SAMPLE_CITIES, parseCategoriesCsv, seedReferenceData } from '@pusatk3/db';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { beforeEach, describe, expect, it } from 'vitest';
import csv from '../../../docs/data/kategori-k3.csv?raw';

// Constraints of the directory tables in a real (local) D1 with all migrations applied.
// Raw SQL on purpose: these tests check what the database itself refuses.
const run = (sql: string, ...params: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...params)
    .run();

const NOW = Date.now();
const insertProvider = (id: string, overrides: Record<string, unknown> = {}) => {
  const row = {
    id,
    slug: `penyedia-${id}`,
    name: `Penyedia ${id}`,
    type: 'pjk3',
    status: 'unclaimed',
    verification_status: 'none',
    plan: 'free',
    ...overrides,
  };
  const cols = [...Object.keys(row), 'created_at', 'updated_at'];
  return run(
    `INSERT INTO providers (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    ...Object.values(row),
    NOW,
    NOW,
  );
};

let categoryId = '';
let cityId = '';

beforeEach(async () => {
  // Storage is shared between tests in this file: start each test with empty directory tables.
  for (const table of ['schedules', 'provider_licenses', 'branches', 'providers']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  await seedReferenceData(drizzle(env.DB), { ...parseCategoriesCsv(csv), cities: SAMPLE_CITIES });
  const firstId = async (table: string) => {
    const row = await env.DB.prepare(`SELECT id FROM ${table} LIMIT 1`).first<{ id: string }>();
    if (!row) throw new Error(`seed left ${table} empty`);
    return row.id;
  };
  categoryId = await firstId('course_categories');
  cityId = await firstId('cities');
});

const insertSchedule = (id: string, overrides: Record<string, unknown> = {}) => {
  const row = {
    id,
    provider_id: 'p1',
    branch_id: null,
    category_id: categoryId,
    title: 'Ahli K3 Umum',
    issuer: 'kemnaker',
    mode: 'online',
    start_date: '2027-01-10',
    end_date: '2027-01-21',
    certificate_kind: 'official',
    status: 'published',
    ...overrides,
  };
  const cols = [...Object.keys(row), 'created_at', 'updated_at'];
  return run(
    `INSERT INTO schedules (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    ...Object.values(row),
    NOW,
    NOW,
  );
};

describe('directory tables in D1', () => {
  it('accept a complete provider, branch, license and schedule', async () => {
    await insertProvider('p1', { whatsapp: '6281234567890' });
    await run(
      `INSERT INTO branches (id, provider_id, name, city_id, address, is_main, created_at, updated_at)
       VALUES ('b1', 'p1', 'Kantor pusat', ?, 'Jl. Contoh 1', 1, ?, ?)`,
      cityId,
      NOW,
      NOW,
    );
    await run(
      `INSERT INTO provider_licenses (id, provider_id, kind, number, issuer, created_at, updated_at)
       VALUES ('l1', 'p1', 'izin_pjk3', '5/1234/AS.01.02/2025', 'Kemnaker RI', ?, ?)`,
      NOW,
      NOW,
    );
    await insertSchedule('s1', { branch_id: 'b1', mode: 'offline', price_idr: 4500000 });
    const row = await env.DB.prepare('SELECT status, start_date FROM schedules').first();
    expect(row).toEqual({ status: 'published', start_date: '2027-01-10' });
  });

  it('use safe defaults for a new provider and schedule', async () => {
    await run(
      `INSERT INTO providers (id, slug, name, type, created_at, updated_at)
       VALUES ('p9', 'baru', 'Baru', 'lsp', ?, ?)`,
      NOW,
      NOW,
    );
    expect(
      await env.DB.prepare('SELECT status, verification_status, plan FROM providers').first(),
    ).toEqual({ status: 'unclaimed', verification_status: 'none', plan: 'free' });
  });

  it.each([
    ['unknown provider type', { type: 'agen' }],
    ['unknown status', { status: 'aktif' }],
    ['unknown verification status', { verification_status: 'ok' }],
    ['unknown plan', { plan: 'gold' }],
  ])('refuse a provider with %s', async (_name, overrides) => {
    await expect(insertProvider('p2', overrides)).rejects.toThrow(/CHECK constraint/);
  });

  it('refuse duplicate provider slugs', async () => {
    await insertProvider('p1');
    await expect(insertProvider('p2', { slug: 'penyedia-p1' })).rejects.toThrow(/UNIQUE/);
  });

  it.each([
    ['unknown issuer', { issuer: 'iso' }],
    ['unknown mode', { mode: 'hybrid' }],
    ['unknown status', { status: 'aktif' }],
    ['unknown certificate kind', { certificate_kind: 'other' }],
    ['end before start', { start_date: '2027-01-21', end_date: '2027-01-10' }],
    ['date that is not YYYY-MM-DD', { start_date: '10/01/2027' }],
    ['negative price', { price_idr: -1 }],
    ['zero quota', { quota: 0 }],
  ])('refuse a schedule with %s', async (_name, overrides) => {
    await insertProvider('p1');
    await expect(insertSchedule('s2', overrides)).rejects.toThrow(/CHECK constraint/);
  });

  it('refuse a schedule for a provider that does not exist', async () => {
    await expect(insertSchedule('s3', { provider_id: 'tidak-ada' })).rejects.toThrow(/FOREIGN KEY/);
  });

  it('refuse an unknown license kind', async () => {
    await insertProvider('p1');
    await expect(
      run(
        `INSERT INTO provider_licenses (id, provider_id, kind, number, issuer, created_at, updated_at)
         VALUES ('l2', 'p1', 'sio', '1', 'Kemnaker RI', ?, ?)`,
        NOW,
        NOW,
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });
});
