import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The import script used locally and by the staging deploy (ADR 0015) must end with a new data
// version, so edge caches drop the old data right after an import (ADR 0021).
const repo = resolve(import.meta.dirname, '..');

describe('apps/api/scripts/import-sql.ts', () => {
  it('writes the sample import and announces a new data version last', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'import-sql-')), 'contoh.sql');
    const result = spawnSync(
      resolve(repo, 'apps/api/node_modules/.bin/tsx'),
      ['scripts/import-sql.ts', '--dir', '../../docs/data/contoh', '--sample', '--out', out],
      { cwd: resolve(repo, 'apps/api'), encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const statements = readFileSync(out, 'utf8').trim().split(';\n');
    expect(statements.at(-1)).toMatch(/^insert into "app_meta"/);
    expect(statements.filter((s) => s.includes('"app_meta"'))).toHaveLength(1);
  }, 60_000);
});
