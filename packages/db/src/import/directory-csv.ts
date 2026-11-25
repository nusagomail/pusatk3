import {
  branchInputSchema,
  licenseInputSchema,
  providerInputSchema,
  scheduleInputSchema,
  type BranchInput,
  type LicenseInput,
  type ProviderInput,
  type ScheduleInput,
} from '@pusatk3/shared';
import type { CategorySeed } from '../seed/categories-csv';
import { parseCsvRecords } from '../seed/csv';

// Curated directory data as four CSV files (format: docs/data/README.md). Parsing is
// all-or-nothing: the caller writes nothing when `problems` is not empty.

export interface DirectoryCsvFiles {
  penyedia: string;
  cabang: string;
  legalitas: string;
  jadwal: string;
}

export interface ImportProblem {
  file: keyof DirectoryCsvFiles;
  /** 1-based line in the CSV file (the header is line 1). */
  line: number;
  message: string;
}

export interface DirectoryImport {
  providers: ProviderInput[];
  branches: (BranchInput & { providerSlug: string })[];
  licenses: (LicenseInput & { providerSlug: string })[];
  schedules: (ScheduleInput & { providerSlug: string })[];
}

export interface DirectoryReference {
  categories: readonly Pick<CategorySeed, 'slug' | 'issuers'>[];
  citySlugs: ReadonlySet<string>;
}

export const DIRECTORY_CSV_HEADERS = {
  penyedia: ['slug', 'nama', 'jenis', 'deskripsi', 'whatsapp', 'email', 'telepon', 'website'],
  cabang: ['penyedia_slug', 'nama', 'kota_slug', 'alamat', 'lat', 'lng', 'kantor_pusat'],
  legalitas: ['penyedia_slug', 'jenis', 'nomor', 'penerbit', 'berlaku_sampai'],
  jadwal: [
    'penyedia_slug',
    'kategori_slug',
    'cabang',
    'judul',
    'penerbit',
    'metode',
    'mulai',
    'selesai',
    'harga',
    'kuota',
    'deskripsi',
    'syarat',
    'level',
    'sertifikat',
    'status',
  ],
} as const satisfies Record<keyof DirectoryCsvFiles, readonly string[]>;

type Row = Record<string, string>;

/** Rows of one file as header → value, with their line numbers. */
function readRows(
  file: keyof DirectoryCsvFiles,
  text: string,
  problems: ImportProblem[],
): { line: number; row: Row }[] {
  const [first, ...records] = parseCsvRecords(text);
  const header = first?.cells;
  const expected = DIRECTORY_CSV_HEADERS[file];
  if (!header || header.join(',') !== expected.join(',')) {
    problems.push({ file, line: 1, message: `header harus: ${expected.join(',')}` });
    return [];
  }
  return records
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ''))
    .flatMap(({ cells, line }) => {
      if (cells.length !== expected.length) {
        problems.push({
          file,
          line,
          message: `harus ${expected.length} kolom, ada ${cells.length}`,
        });
        return [];
      }
      return [{ line, row: Object.fromEntries(expected.map((name, i) => [name, cells[i] ?? ''])) }];
    });
}

/** Empty cell → undefined (optional field); otherwise the trimmed text. */
const opt = (value: string | undefined) => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
};
/**
 * Number cell. Prices (`thousands`) accept whole rupiah only: "4500000" or "4.500.000";
 * anything else ("4500000.00", "1.5") is invalid instead of silently misread.
 */
const num = (value: string | undefined, { thousands = false } = {}) => {
  const text = opt(value);
  if (text === undefined) return undefined;
  if (thousands) {
    return /^\d+$/.test(text) || /^\d{1,3}(\.\d{3})+$/.test(text)
      ? Number(text.replace(/\./g, ''))
      : Number.NaN;
  }
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
};

function zodMessage(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join('.') || 'baris'}: ${issue.message}`)
    .join('; ');
}

const nameKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

export function parseDirectoryCsv(
  files: DirectoryCsvFiles,
  reference: DirectoryReference,
): { data: DirectoryImport; problems: ImportProblem[] } {
  const problems: ImportProblem[] = [];
  const data: DirectoryImport = { providers: [], branches: [], licenses: [], schedules: [] };
  const issuersByCategory = new Map(reference.categories.map((c) => [c.slug, c.issuers]));

  // Providers: unique slug and unique name (dedupe of curated data).
  const providerBySlug = new Map<string, number>();
  const providerByName = new Map<string, string>();
  for (const { line, row } of readRows('penyedia', files.penyedia, problems)) {
    const parsed = providerInputSchema.safeParse({
      slug: row.slug?.trim(),
      name: row.nama,
      type: row.jenis?.trim(),
      description: opt(row.deskripsi),
      whatsapp: opt(row.whatsapp),
      email: opt(row.email),
      phone: opt(row.telepon),
      website: opt(row.website),
    });
    if (!parsed.success) {
      problems.push({ file: 'penyedia', line, message: zodMessage(parsed.error) });
      continue;
    }
    const provider = parsed.data;
    if (providerBySlug.has(provider.slug)) {
      problems.push({
        file: 'penyedia',
        line,
        message: `slug "${provider.slug}" duplikat (baris ${providerBySlug.get(provider.slug)})`,
      });
      continue;
    }
    const sameName = providerByName.get(nameKey(provider.name));
    if (sameName) {
      problems.push({
        file: 'penyedia',
        line,
        message: `nama "${provider.name}" sama dengan penyedia "${sameName}"`,
      });
      continue;
    }
    providerBySlug.set(provider.slug, line);
    providerByName.set(nameKey(provider.name), provider.slug);
    data.providers.push(provider);
  }
  const knownProvider = (slug: string | undefined, file: keyof DirectoryCsvFiles, line: number) => {
    const known = slug !== undefined && providerBySlug.has(slug);
    if (!known) {
      problems.push({
        file,
        line,
        message: `penyedia_slug "${slug ?? ''}" tidak ada di penyedia.csv`,
      });
    }
    return known;
  };

  // Branches: unique name per provider, known city.
  const branchKeys = new Map<string, { line: number; name: string }>();
  const mainOffice = new Map<string, number>();
  for (const { line, row } of readRows('cabang', files.cabang, problems)) {
    const providerSlug = opt(row.penyedia_slug);
    if (!knownProvider(providerSlug, 'cabang', line)) continue;
    const isMain = opt(row.kantor_pusat)?.toLowerCase();
    if (isMain !== undefined && isMain !== 'ya' && isMain !== 'tidak') {
      problems.push({ file: 'cabang', line, message: 'kantor_pusat harus "ya" atau "tidak"' });
      continue;
    }
    const parsed = branchInputSchema.safeParse({
      name: row.nama,
      citySlug: row.kota_slug?.trim(),
      address: row.alamat,
      lat: num(row.lat),
      lng: num(row.lng),
      isMain: isMain === 'ya',
    });
    if (!parsed.success) {
      problems.push({ file: 'cabang', line, message: zodMessage(parsed.error) });
      continue;
    }
    const branch = parsed.data;
    if (!reference.citySlugs.has(branch.citySlug)) {
      problems.push({
        file: 'cabang',
        line,
        message: `kota_slug "${branch.citySlug}" tidak dikenal`,
      });
      continue;
    }
    const key = `${providerSlug}\u0000${nameKey(branch.name)}`;
    if (branchKeys.has(key)) {
      problems.push({
        file: 'cabang',
        line,
        message: `cabang "${branch.name}" duplikat untuk "${providerSlug}" (baris ${branchKeys.get(key)?.line})`,
      });
      continue;
    }
    if (branch.isMain && mainOffice.has(providerSlug as string)) {
      problems.push({
        file: 'cabang',
        line,
        message: `"${providerSlug}" sudah punya kantor pusat (baris ${mainOffice.get(providerSlug as string)})`,
      });
      continue;
    }
    if (branch.isMain) mainOffice.set(providerSlug as string, line);
    branchKeys.set(key, { line, name: branch.name });
    data.branches.push({ ...branch, providerSlug: providerSlug as string });
  }

  // Licenses: a license number of a kind belongs to one provider only.
  const licenseKeys = new Map<string, string>();
  for (const { line, row } of readRows('legalitas', files.legalitas, problems)) {
    const providerSlug = opt(row.penyedia_slug);
    if (!knownProvider(providerSlug, 'legalitas', line)) continue;
    const parsed = licenseInputSchema.safeParse({
      kind: row.jenis?.trim(),
      number: row.nomor,
      issuer: row.penerbit,
      validUntil: opt(row.berlaku_sampai),
    });
    if (!parsed.success) {
      problems.push({ file: 'legalitas', line, message: zodMessage(parsed.error) });
      continue;
    }
    const license = parsed.data;
    const key = `${license.kind}\u0000${license.number.toLowerCase()}`;
    const owner = licenseKeys.get(key);
    if (owner) {
      problems.push({
        file: 'legalitas',
        line,
        message: `nomor ${license.kind} "${license.number}" sudah dipakai penyedia "${owner}"`,
      });
      continue;
    }
    licenseKeys.set(key, providerSlug as string);
    data.licenses.push({ ...license, providerSlug: providerSlug as string });
  }

  // Schedules: known category and branch, issuer allowed for the category, unique natural key.
  const scheduleKeys = new Map<string, number>();
  for (const { line, row } of readRows('jadwal', files.jadwal, problems)) {
    const providerSlug = opt(row.penyedia_slug);
    if (!knownProvider(providerSlug, 'jadwal', line)) continue;
    const parsed = scheduleInputSchema.safeParse({
      categorySlug: row.kategori_slug?.trim(),
      branchName: opt(row.cabang),
      title: row.judul,
      issuer: row.penerbit?.trim().toLowerCase(),
      mode: row.metode?.trim().toLowerCase(),
      startDate: row.mulai?.trim(),
      endDate: row.selesai?.trim(),
      priceIdr: num(row.harga, { thousands: true }),
      quota: num(row.kuota),
      description: opt(row.deskripsi),
      requirements: opt(row.syarat),
      level: opt(row.level),
      certificateKind: row.sertifikat?.trim(),
      status: opt(row.status),
    });
    if (!parsed.success) {
      problems.push({ file: 'jadwal', line, message: zodMessage(parsed.error) });
      continue;
    }
    const schedule = parsed.data;
    const issuers = issuersByCategory.get(schedule.categorySlug);
    if (!issuers) {
      problems.push({
        file: 'jadwal',
        line,
        message: `kategori_slug "${schedule.categorySlug}" tidak dikenal`,
      });
      continue;
    }
    if (!issuers.includes(schedule.issuer)) {
      problems.push({
        file: 'jadwal',
        line,
        message: `penerbit "${schedule.issuer}" tidak berlaku untuk ${schedule.categorySlug} (${issuers.join('/')})`,
      });
      continue;
    }
    const branch =
      schedule.branchName === undefined
        ? undefined
        : branchKeys.get(`${providerSlug}\u0000${nameKey(schedule.branchName)}`);
    if (schedule.branchName !== undefined && !branch) {
      problems.push({
        file: 'jadwal',
        line,
        message: `cabang "${schedule.branchName}" tidak ada untuk "${providerSlug}" di cabang.csv`,
      });
      continue;
    }
    // Use the branch name as spelled in cabang.csv (the database match is exact).
    if (branch) schedule.branchName = branch.name;
    const key = [
      providerSlug,
      schedule.categorySlug,
      schedule.startDate,
      nameKey(schedule.title),
    ].join('\u0000');
    if (scheduleKeys.has(key)) {
      problems.push({
        file: 'jadwal',
        line,
        message: `jadwal duplikat (penyedia, kategori, mulai, judul sama dengan baris ${scheduleKeys.get(key)})`,
      });
      continue;
    }
    scheduleKeys.set(key, line);
    data.schedules.push({ ...schedule, providerSlug: providerSlug as string });
  }

  return { data, problems };
}
