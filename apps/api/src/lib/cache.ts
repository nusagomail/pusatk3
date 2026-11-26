/** Public, edge-cacheable reference data (docs/arsitektur.md: alur cache halaman publik). */
/** Public directory data (search, schedule detail, provider profile): short edge cache. */
export const PUBLIC_DIRECTORY_CACHE =
  'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export const PUBLIC_REFERENCE_CACHE =
  'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
