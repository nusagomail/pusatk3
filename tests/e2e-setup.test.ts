import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Structure of the Playwright e2e setup (docs/adr/0013-e2e-playwright.md).
const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

/** The YAML block under `name:` at the given indent (same helper as tests/workflows.test.ts). */
function block(text: string, name: string, indent = 2): string {
  const pad = ' '.repeat(indent);
  const start = text.indexOf(`\n${pad}${name}:`);
  if (start < 0) return '';
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(new RegExp(`\\n${pad}[A-Za-z_-]+:`));
  return next < 0 ? rest : rest.slice(0, next + 1);
}

interface PackageJson {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
const pkg = JSON.parse(read('package.json')) as PackageJson;

describe('e2e setup', () => {
  it('exposes pnpm test:e2e, building the web app first', () => {
    expect(pkg.scripts?.['test:e2e']).toMatch(/build.*@pusatk3\/web.*&& playwright test$/);
  });

  it('pins @playwright/test exactly to the version of the preinstalled browser', () => {
    // A different version would look for a browser the cloud session does not have.
    expect(pkg.devDependencies?.['@playwright/test']).toBe('1.63.0');
  });

  it('serves the built web app and the local API on fixed ports', () => {
    const config = read('playwright.config.ts');
    expect(config).toContain("testDir: './e2e'");
    expect(config).toContain('dist/server/wrangler.json');
    expect(config).toContain('4322');
    expect(config).toContain('8787');
    // Never against remote resources.
    expect(config).not.toMatch(/--remote|CLOUDFLARE_ENV|workers\.dev|pusatk3\.id/);
  });

  it('has specs for the home page and the API health check', () => {
    expect(existsSync(resolve(root, 'e2e/beranda.spec.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'e2e/api.spec.ts'))).toBe(true);
  });
});

describe('ci.yml e2e job', () => {
  const ci = read('.github/workflows/ci.yml');
  const job = block(block(ci, 'jobs', 0), 'e2e');

  it('exists as its own job', () => {
    expect(job.startsWith('  e2e:\n')).toBe(true);
    expect(job).toMatch(/timeout-minutes: \d+/);
  });

  it('installs Chromium with system deps, then runs pnpm test:e2e', () => {
    const install = job.indexOf('run: pnpm install --frozen-lockfile');
    const browser = job.indexOf(
      'run: pnpm exec playwright install --with-deps --only-shell chromium',
    );
    const run = job.indexOf('run: pnpm test:e2e');
    expect(install).toBeGreaterThan(-1);
    expect(browser).toBeGreaterThan(install);
    expect(run).toBeGreaterThan(browser);
  });

  it('never reuses a server that happens to run on the test ports', () => {
    const config = read('playwright.config.ts');
    expect(config).toContain('reuseExistingServer: false');
    expect(config).not.toMatch(/reuseExistingServer: !/);
    expect(config).toContain("WRANGLER_SEND_METRICS: 'false'");
  });
});
