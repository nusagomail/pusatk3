import { describe, expect, it } from 'vitest';
import {
  nextTheme,
  readStoredTheme,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from '../src/lib/theme';

const storage = (value: string | null, throws = false) => ({
  getItem: () => {
    if (throws) throw new Error('SecurityError');
    return value;
  },
});

describe('theme', () => {
  it('reads only valid stored choices and survives blocked storage', () => {
    expect(readStoredTheme(storage('dark'))).toBe('dark');
    expect(readStoredTheme(storage('light'))).toBe('light');
    expect(readStoredTheme(storage('purple'))).toBeNull();
    expect(readStoredTheme(storage(null))).toBeNull();
    expect(readStoredTheme(storage(null, true))).toBeNull();
    expect(readStoredTheme(undefined)).toBeNull();
  });

  it('explicit choice wins over the OS preference, both ways', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('toggles', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });
});

describe('THEME_INIT_SCRIPT (inline, runs before paint)', () => {
  const run = (stored: string | null, throws = false) => {
    const dataset: Record<string, string> = {};
    const document = { documentElement: { dataset } };
    const localStorage = storage(stored, throws);
    new Function('document', 'localStorage', THEME_INIT_SCRIPT)(document, localStorage);
    return dataset.theme;
  };

  it('applies a stored choice', () => {
    expect(run('dark')).toBe('dark');
    expect(run('light')).toBe('light');
  });

  it('leaves the OS preference in charge otherwise, without throwing', () => {
    expect(run(null)).toBeUndefined();
    expect(run('evil"><script>')).toBeUndefined();
    expect(run(null, true)).toBeUndefined();
  });

  it('uses the shared storage key', () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });
});
