export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pusatk3-theme';

interface ReadableStorage {
  getItem(key: string): string | null;
}

/** Stored explicit choice, or null (no choice, invalid value, or storage blocked). */
export function readStoredTheme(storage: ReadableStorage | undefined): Theme | null {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** An explicit choice always wins; otherwise follow the OS preference. */
export function resolveTheme(stored: Theme | null, prefersDark: boolean): Theme {
  return stored ?? (prefersDark ? 'dark' : 'light');
}

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

/**
 * Inlined in <head> before styles so a stored choice applies without a flash.
 * Only "light"/"dark" are ever written to the DOM. Needs a CSP hash once a CSP is set (#5).
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`;
