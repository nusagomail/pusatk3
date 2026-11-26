import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { preflightProblems } from '../scripts/production-preflight.mjs';

// Fixtures only: the real repository is expected to fail until the owner fills in the
// production database ID and the web app's production API binding (ADR 0019).
const repo = resolve(import.meta.dirname, '..');
const STAGING_ID = 'b8fcd041-9853-4ed2-81db-0901dba670b8';

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'preflight-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const apiConfig = (productionId: string) => `// comment
{
  "name": "pusatk3-api",
  "env": {
    "staging": { "d1_databases": [{ "binding": "DB", "database_id": "${STAGING_ID}" }] },
    "production": {
      // filled by the owner
      "d1_databases": [{ "binding": "DB", "database_id": "${productionId}", }],
    },
  },
}
`;

const READY = {
  'apps/api/wrangler.jsonc': apiConfig('0b8f6c2e-1111-4222-8333-944455556666'),
  'apps/web/src/pages/index.astro': '---\nimport { getSchedules } from "../lib/api";\n---',
  'apps/web/wrangler.jsonc': `{
  "name": "pusatk3-web",
  "env": {
    "production": {
      // added with the owner's approval
      "services": [{ "binding": "API", "service": "pusatk3-api-production" }],
    },
  },
}
`,
  // The sample data module may stay in the repo as long as nothing uses it.
  'apps/web/src/data/home.ts': 'export const SAMPLE_SCHEDULES = [];',
};

const problems = (files: Record<string, string>) => preflightProblems(fixture(files)).join('\n');

describe('production preflight', () => {
  it('passes when the production ID is real and nothing shows sample schedules', () => {
    expect(preflightProblems(fixture(READY))).toEqual([]);
  });

  it.each([
    ['the placeholder', 'ISI-ID-D1-PRODUCTION-OLEH-PEMILIK'],
    ['the staging ID', STAGING_ID],
    ['the local all-zero ID', '00000000-0000-0000-0000-000000000000'],
    ['a non-UUID', 'pusatk3-production'],
  ])('refuses %s as production database ID', (_name, id) => {
    expect(problems({ ...READY, 'apps/api/wrangler.jsonc': apiConfig(id) })).toMatch(
      /ID database production/,
    );
  });

  it.each([
    ['no production API binding', '{ "name": "pusatk3-web", "env": { "production": {} } }'],
    [
      'a binding to the staging API',
      '{ "env": { "production": { "services": [{ "binding": "API", "service": "pusatk3-api-staging" }] } } }',
    ],
  ])('refuses %s for the web app', (_name, config) => {
    expect(problems({ ...READY, 'apps/web/wrangler.jsonc': config })).toMatch(
      /belum tersambung ke API/,
    );
  });

  it('refuses the real web config until the owner adds the production binding', () => {
    const real = readFileSync(resolve(repo, 'apps/web/wrangler.jsonc'), 'utf8');
    expect(problems({ ...READY, 'apps/web/wrangler.jsonc': real })).toMatch(
      /belum tersambung ke API/,
    );
  });

  it('refuses a config without a production database', () => {
    expect(problems({ ...READY, 'apps/api/wrangler.jsonc': '{ "name": "x" }' })).toMatch(
      /ID database production/,
    );
  });

  it.each([
    'apps/web/src/pages/kota/[slug].astro',
    'apps/web/src/components/home/UpcomingSchedules.astro',
    'apps/web/src/lib/schedules.ts',
  ])('refuses sample schedules used in %s (owner decision, #5)', (path) => {
    const output = problems({
      ...READY,
      [path]: 'import { SAMPLE_SCHEDULES } from "../data/home";',
    });
    expect(output).toMatch(/jadwal contoh/);
    expect(output).toContain(path.replace('apps/web/src/', ''));
  });

  it('parses the real apps/api/wrangler.jsonc once the owner fills in the ID', () => {
    const real = readFileSync(resolve(repo, 'apps/api/wrangler.jsonc'), 'utf8');
    expect(real).toContain('ISI-ID-D1-PRODUCTION-OLEH-PEMILIK');
    const filled = real.replace(
      'ISI-ID-D1-PRODUCTION-OLEH-PEMILIK',
      '0b8f6c2e-1111-4222-8333-944455556666',
    );
    expect(problems({ ...READY, 'apps/api/wrangler.jsonc': filled })).toBe('');
  });

  it('exits non-zero with readable reasons when run as a script', () => {
    const script = resolve(repo, 'scripts/production-preflight.mjs');
    const bad = fixture({ ...READY, 'apps/api/wrangler.jsonc': apiConfig(STAGING_ID) });
    const failed = spawnSync('node', [script, bad], { encoding: 'utf8' });
    expect(failed.status).toBe(1);
    expect(failed.stderr).toMatch(/Deploy production ditolak/);
    const ok = spawnSync('node', [script, fixture(READY)], { encoding: 'utf8' });
    expect(ok.status).toBe(0);
  });
});
