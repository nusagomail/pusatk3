// pnpm data:check <folder>: checks four directory CSV files (docs/data/README.md) against the
// reference data without writing anything (#54). The folder is relative to where you run it.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const folder = process.argv[2];
if (!folder) {
  console.error(
    'Pakai: pnpm data:check <folder berisi penyedia.csv, cabang.csv, legalitas.csv, jadwal.csv>',
  );
  process.exit(2);
}
const api = resolve(import.meta.dirname, '../apps/api');
const result = spawnSync(
  resolve(api, 'node_modules/.bin/tsx'),
  [
    'scripts/import-sql.ts',
    '--check',
    '--dir',
    resolve(process.env.INIT_CWD ?? process.cwd(), folder),
  ],
  { cwd: api, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
