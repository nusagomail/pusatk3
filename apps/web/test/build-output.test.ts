import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT } from '../src/lib/theme';

// Runs a real production build (as deployed) into a temp dir and inspects the output.
const root = resolve(import.meta.dirname, '..');
let out = '';
const client = (...parts: string[]) => join(out, 'client', ...parts);
const files = (dir: string) =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' }).map((file) => join(dir, file));

/** Parses Cloudflare `_headers` into path → header lines (comments and blank lines ignored). */
function headerRules(text: string): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = rules.get(line.trim()) ?? [];
      rules.set(line.trim(), current);
    } else {
      current?.push(line.trim());
    }
  }
  return rules;
}

let localOut = '';

function build(outDir: string, cloudflareEnv: string | undefined): void {
  // Media URL empty (not just unset) so the environment cannot enable the video in this build.
  const env: NodeJS.ProcessEnv = { ...process.env, PUBLIC_MEDIA_BASE_URL: '' };
  delete env.CLOUDFLARE_ENV;
  if (cloudflareEnv) env.CLOUDFLARE_ENV = cloudflareEnv;
  try {
    execFileSync('pnpm', ['exec', 'astro', 'build', '--outDir', outDir], {
      cwd: root,
      env,
      stdio: 'pipe',
    });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `astro build failed:\n${stdout?.toString().slice(-3000)}\n${stderr?.toString().slice(-3000)}`,
      { cause: error },
    );
  }
}

beforeAll(() => {
  // Sequential builds: parallel workerd prerenders would race for the inspector port.
  out = mkdtempSync(join(tmpdir(), 'pusatk3-web-build-'));
  build(out, 'production');
  localOut = mkdtempSync(join(tmpdir(), 'pusatk3-web-build-local-'));
  build(localOut, undefined);
}, 300_000);

afterAll(() => {
  for (const dir of [out, localOut]) if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('non-production build (no CLOUDFLARE_ENV)', () => {
  const local = (...parts: string[]) => join(localOut, 'client', ...parts);

  it('is noindex on every path and blocks crawlers', () => {
    const rules = headerRules(readFileSync(local('_headers'), 'utf8'));
    expect(rules.get('/*')).toContain('X-Robots-Tag: noindex, nofollow');
    expect(rules.get('/_astro/*')).toContain('Cache-Control: public, max-age=31536000, immutable');
    expect(readFileSync(local('robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /\n');
  });

  it('builds the private top-level worker', () => {
    const config = JSON.parse(readFileSync(local('wrangler.json'), 'utf8')) as {
      name?: string;
      workers_dev?: boolean;
    };
    expect(config.name).toBe('pusatk3-web');
    expect(config.workers_dev).toBe(false);
  });
});

describe('production build', () => {
  it('prerenders the homepage', () => {
    expect(existsSync(client('index.html'))).toBe(true);
  });

  it('does not ship the internal component showcase', () => {
    expect(existsSync(client('internal'))).toBe(false);
  });

  it('inlines no fonts as data: URIs (CSP font-src allows only same-origin files)', () => {
    const css = files(client('_astro')).filter((file) => file.endsWith('.css'));
    expect(css.length).toBeGreaterThan(0);
    for (const file of css) expect(readFileSync(file, 'utf8')).not.toMatch(/url\(\s*["']?data:/);
  });

  it('has a static 404 page that links home and is not indexed', () => {
    const html = readFileSync(client('404.html'), 'utf8');
    expect(html).toMatch(/href="\/"/);
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  });

  it('serves 404.html for unknown paths and keeps the Worker private', () => {
    const config = JSON.parse(readFileSync(client('wrangler.json'), 'utf8')) as {
      assets?: { not_found_handling?: string };
      workers_dev?: boolean;
      preview_urls?: boolean;
      observability?: { enabled?: boolean };
      kv_namespaces?: unknown[];
      name?: string;
      routes?: { pattern: string }[];
    };
    expect(config.name).toBe('pusatk3-web-production');
    expect(config.routes?.map((route) => route.pattern)).toEqual(['pusatk3.id/*']);
    expect(config.assets?.not_found_handling).toBe('404-page');
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
    expect(config.observability?.enabled).toBe(false);
    expect(config.kv_namespaces ?? []).toEqual([]);
  });

  it('does not bundle the intro video', () => {
    expect(files(out).filter((file) => file.endsWith('.mp4'))).toEqual([]);
  });
});

describe('_headers', () => {
  const rules = () => headerRules(readFileSync(client('_headers'), 'utf8'));

  it('sends security headers on every path', () => {
    const all = (rules().get('/*') ?? []).join('\n');
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
    const home = (rules().get('/') ?? []).join('\n');
    expect(home).toMatch(
      /Cache-Control: public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400/,
    );
  });

  it('production builds are indexable (no X-Robots-Tag)', () => {
    expect(readFileSync(client('_headers'), 'utf8')).not.toContain('X-Robots-Tag');
    expect(readFileSync(client('robots.txt'), 'utf8')).toContain('Allow: /');
  });

  it('keeps immutable caching for hashed assets', () => {
    expect(rules().get('/_astro/*')).toContain(
      'Cache-Control: public, max-age=31536000, immutable',
    );
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

  it('allows media only from this site when no media URL is configured, and no data: images', () => {
    expect(csp()).toContain("media-src 'self';");
    expect(csp()).not.toMatch(/media-src[^;]*https:/);
    expect(csp()).not.toMatch(/img-src[^;]*data:/);
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
