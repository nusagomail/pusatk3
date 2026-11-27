// Seeds the LOCAL D1 (apps/api/.wrangler/state) with reference data.
// Run from the repo root: `pnpm db:seed:local` (after `pnpm db:migrate:local`).
// Never points at a remote database: remote bindings are disabled explicitly and the state
// path is absolute (same as `wrangler dev` / `db:migrate:local` in apps/api).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCategoriesCsv, parseCitiesCsv, seedReferenceData } from '@pusatk3/db';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import type { Env } from '../src/env';

const dataDir = resolve(import.meta.dirname, '../../../docs/data');
// Same reference cities as the import (docs/data/kota.csv, #54).
const data = {
  ...parseCategoriesCsv(readFileSync(resolve(dataDir, 'kategori-k3.csv'), 'utf8')),
  cities: parseCitiesCsv(readFileSync(resolve(dataDir, 'kota.csv'), 'utf8')),
};

const proxy = await getPlatformProxy<Env>({
  configPath: resolve(import.meta.dirname, '../wrangler.jsonc'),
  remoteBindings: false,
  persist: { path: resolve(import.meta.dirname, '../.wrangler/state/v3') },
});
try {
  const report = await seedReferenceData(drizzle(proxy.env.DB), data);
  for (const [table, slugs] of Object.entries(report.orphans)) {
    if (slugs.length > 0) {
      console.warn(
        `Warning: ${table} in the database but not in the seed data (kept): ${slugs.join(', ')}`,
      );
    }
  }
  console.log(
    `Seeded local D1: ${data.fields.length} fields, ${data.categories.length} categories, ${data.cities.length} cities.`,
  );
} finally {
  await proxy.dispose();
}
