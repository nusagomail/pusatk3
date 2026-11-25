/**
 * Base URL of the media bucket (R2/CDN) if it is a plain https URL without credentials,
 * query or fragment; returned without a trailing slash. Anything else → null (video off).
 */
export function safeMediaBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    return null;
  if (value.includes('?') || value.includes('#')) return null;
  return `${url.origin}${url.pathname}`.replace(/\/$/, '');
}

/** Origin for the CSP `media-src` directive, or null when no valid media URL is set. */
export function mediaOrigin(value: string | undefined): string | null {
  const base = safeMediaBaseUrl(value);
  return base ? new URL(base).origin : null;
}
