/**
 * Static homepage content. Since #25 the homepage reads schedules, cities and category counts from
 * the API; the lists below are the editorial field selection and the fallbacks used when the API
 * is unavailable. Field counts mirror docs/data/kategori-k3.csv (checked by tests).
 */

export interface FeaturedField {
  slug: string;
  /** Short display name (mockup), full name lives in the CSV/API. */
  name: string;
  count: number;
  note: string;
}

export const FEATURED_FIELDS: readonly FeaturedField[] = [
  { slug: 'k3-umum', name: 'K3 Umum & SMK3', count: 5, note: 'Kemnaker · BNSP' },
  {
    slug: 'pesawat-angkat-angkut',
    name: 'Pesawat Angkat & Angkut',
    count: 8,
    note: 'crane, forklift, alat berat',
  },
  { slug: 'ketinggian', name: 'Bekerja di Ketinggian', count: 4, note: 'TKBT, TKPK, perancah' },
  { slug: 'ruang-terbatas', name: 'Ruang Terbatas', count: 3, note: 'Permenaker 11/2023' },
  { slug: 'listrik', name: 'Listrik', count: 3, note: 'Kemnaker · ESDM' },
  { slug: 'kebakaran', name: 'Penanggulangan Kebakaran', count: 4, note: 'Kelas A–D' },
  { slug: 'konstruksi', name: 'Konstruksi', count: 3, note: 'Kemnaker · SKK PUPR' },
  {
    slug: 'lingkungan-kerja-kesehatan',
    name: 'Lingkungan Kerja & P3K',
    count: 5,
    note: 'Hiperkes, P3K',
  },
];

/** Fallback city chips when GET /cities is unavailable. */
export const CITY_CHIPS: readonly { label: string; query: string }[] = [
  { label: 'Jakarta', query: 'city=jakarta' },
  { label: 'Bekasi', query: 'city=bekasi' },
  { label: 'Karawang', query: 'city=karawang' },
  { label: 'Surabaya', query: 'city=surabaya' },
  { label: 'Batam', query: 'city=batam' },
  { label: 'Balikpapan', query: 'city=balikpapan' },
  { label: 'Medan', query: 'city=medan' },
  { label: 'Makassar', query: 'city=makassar' },
  { label: 'Semarang', query: 'city=semarang' },
  { label: 'Bandung', query: 'city=bandung' },
  { label: 'Online', query: 'mode=online' },
];

/** Fallback city options when GET /cities is unavailable (same as the local seed). */
export const SEARCH_CITIES = [
  { value: '', label: 'Semua kota & online' },
  { value: 'jakarta', label: 'Jakarta' },
  { value: 'surabaya', label: 'Surabaya' },
  { value: 'bekasi', label: 'Bekasi' },
  { value: 'batam', label: 'Batam' },
  { value: 'tangerang', label: 'Tangerang' },
  { value: 'karawang', label: 'Karawang' },
  { value: 'semarang', label: 'Semarang' },
  { value: 'balikpapan', label: 'Balikpapan' },
] as const;
