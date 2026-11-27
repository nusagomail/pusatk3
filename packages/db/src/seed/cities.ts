import { parseCsv } from './csv';

/** Sample cities for local development and tests (not the curated production list). */
export interface CitySeed {
  slug: string;
  name: string;
  province: string;
}

export const SAMPLE_CITIES: readonly CitySeed[] = [
  { slug: 'jakarta', name: 'Jakarta', province: 'DKI Jakarta' },
  { slug: 'surabaya', name: 'Surabaya', province: 'Jawa Timur' },
  { slug: 'bekasi', name: 'Bekasi', province: 'Jawa Barat' },
  { slug: 'batam', name: 'Batam', province: 'Kepulauan Riau' },
  { slug: 'tangerang', name: 'Tangerang', province: 'Banten' },
  { slug: 'karawang', name: 'Karawang', province: 'Jawa Barat' },
  { slug: 'semarang', name: 'Semarang', province: 'Jawa Tengah' },
  { slug: 'balikpapan', name: 'Balikpapan', province: 'Kalimantan Timur' },
];

const CITY_HEADER = 'slug,nama,provinsi';
const CITY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * docs/data/kota.csv: reference cities for imports of real data (#54). Throws on a wrong header,
 * an invalid or duplicate slug, a duplicate name or an empty value.
 */
export function parseCitiesCsv(text: string): CitySeed[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== CITY_HEADER) throw new Error(`kota.csv: header must be ${CITY_HEADER}`);
  const slugs = new Set<string>();
  const names = new Set<string>();
  return rows.map((cells, index) => {
    const line = index + 2;
    const [slug = '', name = '', province = ''] = cells.map((c) => c.trim());
    if (cells.length !== 3 || !slug || !name || !province) {
      throw new Error(`kota.csv line ${line}: expected slug, nama, provinsi`);
    }
    if (!CITY_SLUG.test(slug)) throw new Error(`kota.csv line ${line}: invalid slug "${slug}"`);
    if (slugs.has(slug)) throw new Error(`kota.csv line ${line}: duplicate slug "${slug}"`);
    if (names.has(name.toLowerCase()))
      throw new Error(`kota.csv line ${line}: duplicate name "${name}"`);
    slugs.add(slug);
    names.add(name.toLowerCase());
    return { slug, name, province };
  });
}
