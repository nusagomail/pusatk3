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

const insertBranch = (id: string, providerId: string, name = 'Kantor pusat') =>
  run(
    `INSERT INTO branches (id, provider_id, name, city_id, address, is_main, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Jl. Contoh 1', 1, ?, ?)`,
    id,
    providerId,
    name,
    cityId,
    NOW,
    NOW,
  );
const insertLicense = (id: string, number = '5/1234/AS.01.02/2025', kind = 'izin_pjk3') =>
  run(
    `INSERT INTO provider_licenses (id, provider_id, kind, number, issuer, created_at, updated_at)
     VALUES (?, 'p1', ?, ?, 'Kemnaker RI', ?, ?)`,
    id,
    kind,
    number,
    NOW,
    NOW,
  );

describe('directory tables in D1', () => {
  it('accept a complete provider, branch, license and offline schedule', async () => {
    await insertProvider('p1', { whatsapp: '6281234567890' });
    await insertBranch('b1', 'p1');
    await insertLicense('l1');
    await insertSchedule('s1', { branch_id: 'b1', mode: 'offline', price_idr: 4500000 });
    const row = await env.DB.prepare('SELECT status, start_date FROM schedules').first();
    expect(row).toEqual({ status: 'published', start_date: '2027-01-10' });
  });

  it('accept the baseline online schedule used by the refusal tests', async () => {
    // Positive control: every refusal below changes exactly one thing from this row.
    await insertProvider('p1');
    await insertSchedule('s0');
    expect(await env.DB.prepare('SELECT count(*) AS n FROM schedules').first()).toEqual({ n: 1 });
  });

  it('use safe defaults for a new provider', async () => {
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
    ['unknown provider type', { type: 'agen' }, 'providers_type_check'],
    ['unknown status', { status: 'aktif' }, 'providers_status_check'],
    [
      'unknown verification status',
      { verification_status: 'ok' },
      'providers_verification_status_check',
    ],
    ['unknown plan', { plan: 'gold' }, 'providers_plan_check'],
  ])('refuse a provider with %s', async (_name, overrides, constraint) => {
    await expect(insertProvider('p2', overrides)).rejects.toThrow(constraint);
  });

  it('refuse duplicate provider slugs', async () => {
    await insertProvider('p1');
    await expect(insertProvider('p2', { slug: 'penyedia-p1' })).rejects.toThrow(/UNIQUE/);
  });

  it.each([
    ['unknown issuer', { issuer: 'iso' }, 'schedules_issuer_check'],
    ['unknown mode', { mode: 'hybrid' }, 'schedules_mode_check'],
    ['unknown status', { status: 'aktif' }, 'schedules_status_check'],
    ['unknown certificate kind', { certificate_kind: 'other' }, 'schedules_certificate_kind_check'],
    [
      'end before start',
      { start_date: '2027-01-21', end_date: '2027-01-10' },
      'schedules_dates_check',
    ],
    ['date that is not YYYY-MM-DD', { start_date: '10/01/2027' }, 'schedules_dates_check'],
    ['negative price', { price_idr: -1 }, 'schedules_price_check'],
    ['price stored as text', { price_idr: 'abc' }, 'schedules_price_check'],
    ['zero quota', { quota: 0 }, 'schedules_quota_check'],
    ['offline without a branch', { mode: 'offline' }, 'schedules_branch_check'],
  ])('refuse a schedule with %s', async (_name, overrides, constraint) => {
    await insertProvider('p1');
    await expect(insertSchedule('s2', overrides)).rejects.toThrow(constraint);
  });

  it('refuse an online schedule with a branch', async () => {
    await insertProvider('p1');
    await insertBranch('b1', 'p1');
    await expect(insertSchedule('s2', { branch_id: 'b1' })).rejects.toThrow(
      'schedules_branch_check',
    );
  });

  it('refuse a schedule at a branch of another provider', async () => {
    await insertProvider('p1');
    await insertProvider('p2');
    await insertBranch('b2', 'p2');
    await expect(insertSchedule('s4', { mode: 'offline', branch_id: 'b2' })).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  it('refuse a schedule for a provider that does not exist', async () => {
    await expect(insertSchedule('s3', { provider_id: 'tidak-ada' })).rejects.toThrow(/FOREIGN KEY/);
  });

  it('refuse duplicate branch names within a provider, but not across providers', async () => {
    await insertProvider('p1');
    await insertProvider('p2');
    await insertBranch('b1', 'p1');
    await expect(insertBranch('b2', 'p1')).rejects.toThrow(/UNIQUE/);
    await insertBranch('b3', 'p2');
  });

  it('refuse a duplicate license number of the same kind', async () => {
    await insertProvider('p1');
    await insertLicense('l1');
    await expect(insertLicense('l2')).rejects.toThrow(/UNIQUE/);
    await insertLicense('l3', '5/1234/AS.01.02/2025', 'lisensi_lsp');
  });

  it('refuse an unknown license kind', async () => {
    await insertProvider('p1');
    await expect(insertLicense('l2', '1', 'sio')).rejects.toThrow('provider_licenses_kind_check');
  });

  it('refuse coordinates outside the map or only one of them', async () => {
    await insertProvider('p1');
    await insertBranch('b1', 'p1');
    await expect(run(`UPDATE branches SET lat = 91, lng = 0 WHERE id = 'b1'`)).rejects.toThrow(
      'branches_coordinates_check',
    );
    await expect(run(`UPDATE branches SET lat = -6.2 WHERE id = 'b1'`)).rejects.toThrow(
      'branches_coordinates_check',
    );
  });
});
