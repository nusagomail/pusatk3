/**
 * Static homepage content (#5). Fields and counts mirror docs/data/kategori-k3.csv (checked by
 * tests); Fase 1 loads them from GET /api/v1/categories. Schedules are SAMPLES and are always
 * labelled "Contoh" on the page (owner decision for #5).
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

export interface SampleSchedule {
  title: string;
  issuer: string;
  mode: 'Offline' | 'Online';
  month: string;
  days: string;
  place: string;
}

export const SAMPLE_SCHEDULES: readonly SampleSchedule[] = [
  {
    title: 'Ahli K3 Umum',
    issuer: 'Kemnaker',
    mode: 'Offline',
    month: 'DES',
    days: '8–19',
    place: 'Surabaya',
  },
  {
    title: 'Operator Forklift',
    issuer: 'SIO Kemnaker',
    mode: 'Offline',
    month: 'DES',
    days: '10–12',
    place: 'Bekasi',
  },
  {
    title: 'K3 Listrik',
    issuer: 'BNSP',
    mode: 'Online',
    month: 'DES',
    days: '15–18',
    place: 'Online (Zoom)',
  },
  {
    title: 'Petugas P3K',
    issuer: 'Kemnaker',
    mode: 'Offline',
    month: 'DES',
    days: '16–17',
    place: 'Batam',
  },
];

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

export const SEARCH_CITIES = [
  { value: '', label: 'Semua kota & online' },
  { value: 'jakarta', label: 'Jakarta' },
  { value: 'surabaya', label: 'Surabaya' },
  { value: 'bekasi', label: 'Bekasi' },
  { value: 'batam', label: 'Batam' },
] as const;
