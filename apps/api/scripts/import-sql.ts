// Builds the import SQL: reference data (14 fields, 59 categories, cities) + directory data from
// four CSV files (format: docs/data/README.md). Writes a file for `wrangler d1 execute --file`;
// it never connects to a database itself.
//
//   tsx scripts/import-sql.ts --dir <folder with the 4 CSV files> [--sample] --out <file.sql>
//   tsx scripts/import-sql.ts --dir <folder> --check     (only checks the files; writes nothing)
//
// Cities: docs/data/kota.csv (reference list, #54).
// Local: `pnpm db:import:local`. Staging: the Workers Builds deploy command (ADR 0015, ADR 0017).
// All-or-nothing: any problem in the CSV files → exit code 1 and no SQL file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  dataVersionStatement,
  referenceStatements,
  parseCitiesCsv,
  toSqlScript,
  type DirectoryCsvFiles,
} from '@pusatk3/db';

const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    out: { type: 'string' },
    sample: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
  },
});
if (!values.dir || (!values.out && !values.check)) {
  console.error(
    'Pakai: tsx scripts/import-sql.ts --dir <folder CSV> [--sample] --out <file.sql>\n' +
      '   atau: tsx scripts/import-sql.ts --dir <folder CSV> --check',
  );
  process.exit(2);
}

const dir = resolve(values.dir);
const cities = parseCitiesCsv(
  readFileSync(resolve(import.meta.dirname, '../../../docs/data/kota.csv'), 'utf8'),
);
const categories = parseCategoriesCsv(
  readFileSync(resolve(import.meta.dirname, '../../../docs/data/kategori-k3.csv'), 'utf8'),
);
function readCsv(name: string): string {
  const file = resolve(dir, `${name}.csv`);
  if (!existsSync(file)) {
    console.error(`File ${name}.csv tidak ada di folder ${dir}.`);
    process.exit(1);
  }
  return readFileSync(file, 'utf8');
}

const files = Object.fromEntries(
  (['penyedia', 'cabang', 'legalitas', 'jadwal'] as const).map((name) => [name, readCsv(name)]),
) as unknown as DirectoryCsvFiles;

const { data, problems } = parseDirectoryCsv(files, {
  categories: categories.categories,
  citySlugs: new Set(cities.map((c) => c.slug)),
});
if (problems.length > 0) {
  console.error(
    values.check
      ? `Cek gagal: ${problems.length} masalah.`
      : `Impor dibatalkan: ${problems.length} masalah, tidak ada yang ditulis.`,
  );
  for (const p of problems) console.error(`  ${p.file}.csv baris ${p.line}: ${p.message}`);
  process.exit(1);
}

const counts =
  `${data.providers.length} penyedia, ${data.branches.length} cabang, ` +
  `${data.licenses.length} legalitas, ${data.schedules.length} jadwal`;
if (values.check) {
  console.log(`Cek berhasil, tidak ada masalah: ${counts}. Tidak ada yang ditulis.`);
  if (data.providers.length === 0) console.warn('Peringatan: folder ini belum berisi penyedia.');
  process.exit(0);
}

const statements = [
  ...referenceStatements({ ...categories, cities }),
  ...directoryStatements(data, { isSample: values.sample }),
  // Last: announces the new data to the edge caches (ADR 0021).
  dataVersionStatement(),
];
const out = resolve(values.out as string);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, toSqlScript(statements));
console.log(
  `SQL impor ditulis ke ${out}: ${counts}` +
    `${values.sample ? ' (ditandai contoh)' : ''}, plus data referensi.`,
);
