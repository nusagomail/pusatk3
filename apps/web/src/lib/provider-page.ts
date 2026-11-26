import type { ProviderProfile } from '@pusatk3/shared';
import { absoluteUrl } from '../data/site';
import { PROVIDER_TYPE_LABELS } from './format';

// Pure logic of the provider profile page (/penyedia/[slug]), unit-tested.

/** Page status: API 404/422 (or a malformed slug) → 404; any other failure → 503; found → 200. */
export function profilePageStatus(found: boolean, failure: number | null): 200 | 404 | 503 {
  if (found) return 200;
  return failure !== null && failure !== 404 && failure !== 422 ? 503 : 404;
}

/** schema.org Organization for a real provider; sample (fictional) providers get none. */
export function organizationJsonLd(provider: ProviderProfile): Record<string, unknown> | null {
  if (provider.isSample) return null;
  const main = provider.branches.find((b) => b.isMain) ?? provider.branches[0];
  return {
    '@type': 'Organization',
    name: provider.name,
    url: absoluteUrl(`/penyedia/${provider.slug}`),
    description:
      provider.description ?? `${PROVIDER_TYPE_LABELS[provider.type]} pelatihan dan sertifikasi K3`,
    ...(provider.contact.website && { sameAs: [provider.contact.website] }),
    ...(main && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: main.address,
        addressLocality: main.city.name,
        addressCountry: 'ID',
      },
    }),
  };
}
