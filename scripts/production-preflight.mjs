// Checks that must pass before any production deploy (run by .github/workflows/deploy-production.yml).
// Usage: node scripts/production-preflight.mjs [repoRoot]  → exit 1 with reasons when not ready.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTION_D1_PLACEHOLDER = 'ISI-ID-D1-PRODUCTION-OLEH-PEMILIK';

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

  const apiConfig = readFileSync(join(root, 'apps/api/wrangler.jsonc'), 'utf8');
  if (apiConfig.includes(PRODUCTION_D1_PLACEHOLDER)) {
    problems.push(
      'ID database production masih teks penanda di apps/api/wrangler.jsonc (lihat docs/setup-cloudflare.md langkah 2).',
    );
  }

  const pages = join(root, 'apps/web/src/pages');
  const samplePages = filesUnder(pages)
    .filter((file) => /\.(astro|ts|tsx|md|mdx)$/.test(file))
    .filter((file) => readFileSync(file, 'utf8').includes('SAMPLE_SCHEDULES'))
    .map((file) => relative(pages, file));
  if (samplePages.length > 0) {
    problems.push(
      `Halaman publik masih menampilkan jadwal contoh (keputusan pemilik #5: tidak ke production sebelum data asli): ${samplePages.join(', ')}.`,
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
