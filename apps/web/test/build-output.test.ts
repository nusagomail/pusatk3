import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT } from '../src/lib/theme';

// Runs a real production build (as deployed) into a temp dir and inspects the output.
const root = resolve(import.meta.dirname, '..');
let out = '';
const client = (...parts: string[]) => join(out, 'client', ...parts);

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'pusatk3-web-build-'));
  const env = { ...process.env };
  delete env.PUBLIC_MEDIA_BASE_URL;
  execFileSync('pnpm', ['exec', 'astro', 'build', '--outDir', out], {
    cwd: root,
    env,
    stdio: 'pipe',
  });
}, 180_000);

afterAll(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

describe('production build', () => {
  it('prerenders the homepage', () => {
    expect(existsSync(client('index.html'))).toBe(true);
  });

  it('does not ship the internal component showcase', () => {
    expect(existsSync(client('internal'))).toBe(false);
  });

  it('does not bundle the intro video', () => {
    const files = execFileSync('find', [out, '-name', '*.mp4']).toString().trim();
    expect(files).toBe('');
  });
});

describe('_headers', () => {
  const rules = () => readFileSync(client('_headers'), 'utf8');

  it('sends security headers on every path', () => {
    const all = /^\/\*\n((?:\s+.+\n?)+)/m.exec(rules())?.[1] ?? '';
    expect(all).toMatch(/X-Content-Type-Options: nosniff/);
    expect(all).toMatch(/Strict-Transport-Security: max-age=31536000; includeSubDomains/);
    expect(all).toMatch(/X-Frame-Options: DENY/);
    expect(all).toMatch(/Content-Security-Policy: frame-ancestors 'none'/);
    expect(all).toMatch(/Referrer-Policy: strict-origin-when-cross-origin/);
    expect(all).toMatch(/Permissions-Policy: /);
    // Cache-Control here would be joined with the /_astro/* rule.
    expect(all).not.toMatch(/Cache-Control/);
  });

  it('lets the CDN cache the homepage and revalidate in the background', () => {
    const home = /^\/\n((?:\s+.+\n?)+)/m.exec(rules())?.[1] ?? '';
    expect(home).toMatch(
      /Cache-Control: public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400/,
    );
  });

  it('keeps immutable caching for hashed assets', () => {
    expect(rules()).toMatch(/\/_astro\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  });
});

describe('Content-Security-Policy <meta>', () => {
  const html = () => readFileSync(client('index.html'), 'utf8');
  const csp = () =>
    /<meta http-equiv="content-security-policy" content="([^"]+)"/i.exec(html())?.[1] ?? '';

  it('allows the inline theme script by hash (no unsafe-inline)', () => {
    const hash = createHash('sha256').update(THEME_INIT_SCRIPT).digest('base64');
    expect(csp()).toContain(`'sha256-${hash}'`);
    expect(csp()).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  it('locks down everything else', () => {
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp()).toContain(directive);
    }
  });
});
