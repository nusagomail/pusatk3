import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const css = readFileSync(resolve(import.meta.dirname, '../src/styles/base.css'), 'utf8');

it('keeps a real (transparent) outline on focus so forced-colors mode still shows it', () => {
  const focus = /:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  expect(focus).not.toMatch(/outline:\s*none/);
  expect(focus).toMatch(/outline:\s*2px solid transparent/);
  expect(focus).toMatch(/box-shadow:\s*var\(--focus-ring\)/);
});
