// Seeds the LOCAL D1 (apps/api/.wrangler/state) with reference data.
// Run from the repo root: `pnpm db:seed:local` (after `pnpm db:migrate:local`).
// Never points at a remote database: getPlatformProxy only exposes local bindings.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCategoriesCsv, SAMPLE_CITIES, seedReferenceData } from '@pusatk3/db';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import type { Env } from '../src/env';

const csvPath = resolve(import.meta.dirname, '../../../docs/data/kategori-k3.csv');
const data = { ...parseCategoriesCsv(readFileSync(csvPath, 'utf8')), cities: SAMPLE_CITIES };

const proxy = await getPlatformProxy<Env>({
  configPath: resolve(import.meta.dirname, '../wrangler.jsonc'),
});
try {
  await seedReferenceData(drizzle(proxy.env.DB), data);
  console.log(
    `Seeded local D1: ${data.fields.length} fields, ${data.categories.length} categories, ${data.cities.length} cities.`,
  );
} finally {
  await proxy.dispose();
}
