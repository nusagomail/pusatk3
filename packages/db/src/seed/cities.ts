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
