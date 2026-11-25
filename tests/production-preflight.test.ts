import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { preflightProblems } from '../scripts/production-preflight.mjs';

const repo = resolve(import.meta.dirname, '..');

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'preflight-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const READY = {
  'apps/api/wrangler.jsonc': '{ "database_id": "0b8f6c2e-1111-4222-8333-944455556666" }',
  'apps/web/src/pages/index.astro': '---\nimport { getSchedules } from "../lib/api";\n---',
};

describe('production preflight', () => {
  it('passes when the production ID is set and the homepage uses real data', () => {
    expect(preflightProblems(fixture(READY))).toEqual([]);
  });

  it('refuses the production D1 placeholder', () => {
    const root = fixture({
      ...READY,
      'apps/api/wrangler.jsonc': '{ "database_id": "ISI-ID-D1-PRODUCTION-OLEH-PEMILIK" }',
    });
    expect(preflightProblems(root).join('\n')).toMatch(/ID database production/);
  });

  it('refuses public pages that still show sample schedules (owner decision, #5)', () => {
    const root = fixture({
      ...READY,
      'apps/web/src/pages/kota/[slug].astro': 'import { SAMPLE_SCHEDULES } from "../../data/home";',
    });
    expect(preflightProblems(root).join('\n')).toMatch(/jadwal contoh.*kota\/\[slug\]\.astro/s);
  });

  it('blocks the current repository until both are resolved', () => {
    expect(preflightProblems(repo)).toHaveLength(2);
  });

  it('exits non-zero with readable reasons when run as a script', () => {
    const result = spawnSync('node', [resolve(repo, 'scripts/production-preflight.mjs'), repo], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Deploy production ditolak/);
    const ok = spawnSync(
      'node',
      [resolve(repo, 'scripts/production-preflight.mjs'), fixture(READY)],
      {
        encoding: 'utf8',
      },
    );
    expect(ok.status).toBe(0);
  });
});
