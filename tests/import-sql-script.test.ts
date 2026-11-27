import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

  it('--check only checks: success writes nothing, problems exit 1 with readable lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'data-check-'));
    for (const name of ['penyedia', 'cabang', 'legalitas', 'jadwal']) {
      const text = readFileSync(resolve(repo, `docs/data/contoh/${name}.csv`), 'utf8');
      writeFileSync(
        join(dir, `${name}.csv`),
        name === 'cabang' ? text.replace(',bekasi,', ',kota-fiktif,') : text,
      );
    }
    const check = (folder: string) =>
      spawnSync('node', [resolve(repo, 'scripts/data-check.mjs'), folder], {
        cwd: repo,
        encoding: 'utf8',
      });
    const ok = check('docs/data/contoh');
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/Cek berhasil.*Tidak ada yang ditulis/);
    const bad = check(dir);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('cabang.csv baris 3: kota_slug "kota-fiktif" tidak dikenal');
    expect(readdirSync(dir).sort()).toEqual([
      'cabang.csv',
      'jadwal.csv',
      'legalitas.csv',
      'penyedia.csv',
    ]);
  }, 60_000);
});
