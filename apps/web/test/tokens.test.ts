import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

const here = import.meta.dirname;
const css = readFileSync(resolve(here, '../src/styles/tokens.css'), 'utf8');
const doc = readFileSync(resolve(here, '../../../docs/design-tokens.md'), 'utf8');

/** Rows of the "Warna" table in docs/design-tokens.md: token → { light, dark }. */
function documentedTokens() {
  const tokens = new Map<string, { light: string; dark: string }>();
  for (const match of doc.matchAll(
    /^\| `(--color-[\w-]+)` \| `(#[0-9A-F]{6})` \| `(#[0-9A-F]{6})` \|/gim,
  )) {
    tokens.set(match[1]!, { light: match[2]!.toUpperCase(), dark: match[3]!.toUpperCase() });
  }
  return tokens;
}

/** Custom properties declared in the first CSS block whose selector matches. */
function block(selector: RegExp): Map<string, string> {
  const start = css.search(selector);
  if (start < 0) throw new Error(`no block ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return new Map(
    [...body.matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
      m[1]!,
      m[2]!.toUpperCase(),
    ]),
  );
}

const docs = documentedTokens();
const light = block(/:root\s*\{/);
const dark = block(/:root\[data-theme='dark'\]\s*\{/);
const darkAuto = block(/:root:not\(\[data-theme='light'\]\)\s*\{/);

describe('tokens.css matches docs/design-tokens.md', () => {
  it('documents at least the core tokens', () => {
    expect(docs.size).toBeGreaterThanOrEqual(17);
  });

  it.each([...docs.keys()])('%s', (token) => {
    expect(light.get(token)).toBe(docs.get(token)?.light);
    expect(dark.get(token)).toBe(docs.get(token)?.dark);
    expect(darkAuto.get(token)).toBe(docs.get(token)?.dark);
  });

  it('declares no undocumented color tokens', () => {
    for (const token of [...light.keys(), ...dark.keys()]) expect(docs.has(token)).toBe(true);
  });
});

// Every text/background pair the components use. Keep in sync with src/components.
const PAIRS: [text: string, background: string][] = [
  ['--color-ink', '--color-bg'],
  ['--color-ink', '--color-surface'],
  ['--color-ink-muted', '--color-bg'],
  ['--color-ink-muted', '--color-surface'],
  ['--color-ink-subtle', '--color-bg'],
  ['--color-ink-subtle', '--color-surface'],
  ['--color-on-accent', '--color-accent'],
  ['--color-accent-text', '--color-bg'],
  ['--color-accent-text', '--color-surface'],
  ['--color-accent-text', '--color-accent-soft'],
  ['--color-success', '--color-bg'],
  ['--color-success', '--color-surface'],
  ['--color-danger', '--color-bg'],
  ['--color-ink', '--color-warning-bg'],
  // WhatsApp button text is navy in both themes (docs: "teks navy"), not --color-ink.
  ['--color-on-accent', '--color-whatsapp'],
  ['--color-on-hero', '--color-hero'],
  ['--color-on-hero-muted', '--color-hero'],
];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('contrast (%s theme)', (_theme, values) => {
  it.each(PAIRS)('%s on %s ≥ 4.5:1', (text, background) => {
    expect(contrastRatio(values.get(text)!, values.get(background)!)).toBeGreaterThanOrEqual(4.5);
  });
});

it('contrastRatio matches known WCAG values', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  expect(contrastRatio('#E07400', '#FFFFFF')).toBeLessThan(4.5);
});
