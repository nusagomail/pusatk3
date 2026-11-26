import { searchQuerySchema, type SearchQuery } from '@pusatk3/shared';

// The page URL may carry anything (utm_*, fbclid, typos). Only known search parameters are
// forwarded to the API (docs/api-contract.md: whitelist), in a fixed order so equal searches map
// to equal API URLs (cache-friendly).

export const SEARCH_PARAM_KEYS = [
  'q',
  'field',
  'category',
  'city',
  'mode',
  'issuer',
  'month',
  'priceMin',
  'priceMax',
  'verified',
  'sort',
  'cursor',
] as const;
type SearchParamKey = (typeof SEARCH_PARAM_KEYS)[number];

export interface ParsedSearch {
  /** Valid query, or null when the page URL holds an invalid value. */
  query: SearchQuery | null;
  /** Whitelisted, non-empty parameters as typed in the page URL (to refill the form). */
  values: Partial<Record<SearchParamKey, string>>;
}

export function parseSearchParams(params: URLSearchParams): ParsedSearch {
  const values: ParsedSearch['values'] = {};
  for (const key of SEARCH_PARAM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) values[key] = value;
  }
  const result = searchQuerySchema.safeParse(values);
  return { query: result.success ? result.data : null, values };
}

/** Query string for the API (or for a page link) from whitelisted values; default sort omitted. */
export function toQueryString(values: Partial<Record<SearchParamKey, string>>): string {
  const out = new URLSearchParams();
  for (const key of SEARCH_PARAM_KEYS) {
    const value = values[key];
    if (value === undefined || value === '') continue;
    if (key === 'sort' && value === 'date') continue;
    out.set(key, value);
  }
  const text = out.toString();
  return text ? `?${text}` : '';
}
