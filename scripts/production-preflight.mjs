// Checks that must pass before any production deploy (run first by
// .github/workflows/deploy-production.yml, before installing dependencies).
// Usage: node scripts/production-preflight.mjs [repoRoot]  → exit 1 with reasons when not ready.
// No dependencies on purpose.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ZERO_ID = '00000000-0000-0000-0000-000000000000';

/** Parses our wrangler.jsonc files: whole-line // comments and trailing commas. */
function readJsonc(path) {
  const text = readFileSync(path, 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text);
}

/** @param {string} dir */
function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).map((file) => join(dir, file));
}

/**
 * @param {string} root repository root
 * @returns {string[]} human-readable reasons (Indonesian) why production must not be deployed
 */
export function preflightProblems(root) {
  const problems = [];

  let productionId;
  let stagingId;
  try {
    const config = readJsonc(join(root, 'apps/api/wrangler.jsonc'));
    productionId = config.env?.production?.d1_databases?.[0]?.database_id;
    stagingId = config.env?.staging?.d1_databases?.[0]?.database_id;
  } catch {
    productionId = undefined;
  }
  if (
    typeof productionId !== 'string' ||
    !UUID.test(productionId) ||
    productionId === ZERO_ID ||
    productionId === stagingId
  ) {
    problems.push(
      'ID database production di apps/api/wrangler.jsonc belum diisi dengan ID D1 pusatk3-production yang benar (lihat docs/setup-cloudflare.md langkah 2).',
    );
  }

  // SSR pages read the API through the `API` service binding (ADR 0019). Without it every
  // directory page and the homepage would only say "cannot be loaded" in production.
  let webServices;
  try {
    webServices = readJsonc(join(root, 'apps/web/wrangler.jsonc')).env?.production?.services;
  } catch {
    webServices = undefined;
  }
  if (!Array.isArray(webServices)) webServices = [];
  const hasApiBinding = webServices.some(
    (s) => s?.binding === 'API' && s?.service === 'pusatk3-api-production',
  );
  if (!hasApiBinding) {
    problems.push(
      'Situs production belum tersambung ke API: tambahkan service binding API → pusatk3-api-production di env.production apps/web/wrangler.jsonc (persetujuan pemilik, ADR 0019).',
    );
  }

  // No hard-coded sample schedules in the web app (owner decision #5). Since #25 samples live in
  // the database (is_sample) and the production smoke test refuses them.
  const src = join(root, 'apps/web/src');
  const users = filesUnder(src)
    .filter((file) => /\.(astro|ts|tsx|js|mjs|md|mdx)$/.test(file))
    .filter((file) => !relative(src, file).startsWith('data/'))
    .filter((file) => readFileSync(file, 'utf8').includes('SAMPLE_SCHEDULES'))
    .map((file) => relative(src, file));
  if (users.length > 0) {
    problems.push(
      `Situs masih menampilkan jadwal contoh (keputusan pemilik #5: tidak ke production sebelum data asli): ${users.join(', ')}.`,
    );
  }

  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = preflightProblems(resolve(process.argv[2] ?? '.'));
  if (problems.length > 0) {
    console.error(`Deploy production ditolak:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Preflight production OK.');
}
