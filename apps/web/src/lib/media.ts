/** Returns the media base URL without trailing slash if it is a plain https URL, else null. */
export function safeMediaBaseUrl(value: string | undefined): string | null {
  return value && /^https:\/\/[^\s"'<>]+$/.test(value) ? value.replace(/\/$/, '') : null;
}
