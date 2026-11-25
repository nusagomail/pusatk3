import { issuerSchema } from '@pusatk3/shared';
import type { Issuer } from '@pusatk3/shared';
import { parseCsv } from './csv';

export interface FieldSeed {
  slug: string;
  name: string;
  sortOrder: number;
}

export interface CategorySeed {
  fieldSlug: string;
  slug: string;
  name: string;
  issuers: Issuer[];
  documentType: string;
  typicalValidityYears: number | null;
  regulationRef: string;
}

export interface CategoriesSeed {
  fields: FieldSeed[];
  categories: CategorySeed[];
}

const HEADER = [
  'bidang_slug',
  'bidang',
  'slug',
  'nama',
  'penerbit',
  'dokumen',
  'masa_berlaku',
  'catatan',
  'regulasi',
] as const;
type Column = (typeof HEADER)[number];
const REQUIRED: Column[] = [
  'bidang_slug',
  'bidang',
  'slug',
  'nama',
  'penerbit',
  'dokumen',
  'masa_berlaku',
  'regulasi',
];

/** "5 th", "3 th*", "3 th (SKP)" → years; "—" / "Skema" (depends on scheme) → null. */
function parseValidity(value: string, line: number): number | null {
  if (value === '—' || value === 'Skema') return null;
  const match = /^(\d+)\s*th\b/.exec(value);
  if (!match?.[1]) throw new Error(`CSV line ${line}: unknown masa_berlaku "${value}"`);
  return Number(match[1]);
}

/** "KEMNAKER" → "kemnaker"; several issuers may be separated by ";". */
function parseIssuers(value: string, line: number): Issuer[] {
  return value.split(';').map((code) => {
    const result = issuerSchema.safeParse(code.trim().toLowerCase());
    if (!result.success) throw new Error(`CSV line ${line}: unknown issuer "${code.trim()}"`);
    return result.data;
  });
}

/** Parses docs/data/kategori-k3.csv into fields (in CSV order) and categories. Throws on bad data. */
export function parseCategoriesCsv(text: string): CategoriesSeed {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== HEADER.join(',')) {
    throw new Error(`CSV header must be: ${HEADER.join(',')}`);
  }

  const fields = new Map<string, FieldSeed>();
  const categories: CategorySeed[] = [];
  const seen = new Set<string>();

  rows.forEach((cells, index) => {
    const line = index + 2;
    if (cells.length !== HEADER.length)
      throw new Error(`CSV line ${line}: expected ${HEADER.length} columns`);
    const get = (column: Column) => (cells[HEADER.indexOf(column)] ?? '').trim();
    for (const column of REQUIRED) {
      if (get(column) === '') throw new Error(`CSV line ${line}: ${column} is empty`);
    }

    const fieldSlug = get('bidang_slug');
    const existing = fields.get(fieldSlug);
    if (existing && existing.name !== get('bidang')) {
      throw new Error(`CSV line ${line}: bidang "${fieldSlug}" has two names`);
    }
    if (!existing)
      fields.set(fieldSlug, { slug: fieldSlug, name: get('bidang'), sortOrder: fields.size + 1 });

    const slug = get('slug');
    if (seen.has(slug)) throw new Error(`CSV line ${line}: duplicate category slug "${slug}"`);
    seen.add(slug);

    categories.push({
      fieldSlug,
      slug,
      name: get('nama'),
      issuers: parseIssuers(get('penerbit'), line),
      documentType: get('dokumen'),
      typicalValidityYears: parseValidity(get('masa_berlaku'), line),
      regulationRef: get('regulasi'),
    });
  });

  return { fields: [...fields.values()], categories };
}
