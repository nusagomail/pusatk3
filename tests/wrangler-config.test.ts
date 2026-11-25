import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Deploy configuration per environment (docs/adr/0011-lingkungan-cloudflare.md).
// Wrangler does not inherit `vars`, `d1_databases` or `routes` into environments, so each
// environment is checked on its own.

interface D1 {
  binding: string;
  database_name: string;
  database_id: string;
  migrations_dir?: string;
}
interface Env {
  name?: string;
  workers_dev?: boolean;
  preview_urls?: boolean;
  observability?: { enabled?: boolean };
  vars?: Record<string, string>;
  d1_databases?: D1[];
  routes?: { pattern: string; zone_name?: string; custom_domain?: boolean }[];
}
interface Config extends Env {
  env?: { staging?: Env; production?: Env };
}

/** Reads wrangler.jsonc: strips // comments and trailing commas (our files are simple). */
function readConfig(app: 'api' | 'web'): Config {
  const text = readFileSync(resolve(import.meta.dirname, `../apps/${app}/wrangler.jsonc`), 'utf8');
  const json = text.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(json) as Config;
}

const STAGING_D1_ID = 'b8fcd041-9853-4ed2-81db-0901dba670b8';
const PRODUCTION_D1_PLACEHOLDER = 'ISI-ID-D1-PRODUCTION-OLEH-PEMILIK';

describe.each(['api', 'web'] as const)('apps/%s/wrangler.jsonc', (app) => {
  const config = readConfig(app);
  const staging = config.env?.staging ?? {};
  const production = config.env?.production ?? {};

  it('names workers pusatk3-<app>-<env>', () => {
    expect(config.name).toBe(`pusatk3-${app}`);
    expect(staging.name).toBe(`pusatk3-${app}-staging`);
    expect(production.name).toBe(`pusatk3-${app}-production`);
  });

  it('staging is reachable on workers.dev (owner decision 1A) with logs on', () => {
    expect(staging.workers_dev).toBe(true);
    expect(staging.preview_urls).toBe(false);
    expect(staging.observability?.enabled).toBe(true);
  });

  it('production has no workers.dev/preview URL and no logs (until Fase 3)', () => {
    expect(production.workers_dev).toBe(false);
    expect(production.preview_urls).toBe(false);
    expect(production.observability?.enabled).toBe(false);
  });

  it('production is served on pusatk3.id', () => {
    const pattern = app === 'api' ? 'pusatk3.id/api/*' : 'pusatk3.id/*';
    expect(production.routes).toEqual([{ pattern, zone_name: 'pusatk3.id' }]);
  });

  it('local development stays private', () => {
    expect(config.workers_dev).toBe(false);
  });

  it('contains no secret-looking values and never proxies to remote resources', () => {
    const text = JSON.stringify(config);
    expect(text).not.toMatch(/"remote"\s*:\s*true/);
    for (const env of [config, staging, production]) {
      for (const key of Object.keys(env.vars ?? {})) {
        expect(key).not.toMatch(/key|token|secret|password/i);
      }
    }
  });
});

describe('apps/api/wrangler.jsonc databases', () => {
  const config = readConfig('api');
  const migrations = '../../packages/db/migrations';

  it('staging uses pusatk3-staging', () => {
    expect(config.env?.staging?.d1_databases).toEqual([
      {
        binding: 'DB',
        database_name: 'pusatk3-staging',
        database_id: STAGING_D1_ID,
        migrations_dir: migrations,
      },
    ]);
  });

  it('production uses pusatk3-production, with an ID the owner fills in', () => {
    expect(config.env?.production?.d1_databases).toEqual([
      {
        binding: 'DB',
        database_name: 'pusatk3-production',
        database_id: PRODUCTION_D1_PLACEHOLDER,
        migrations_dir: migrations,
      },
    ]);
  });

  it('every environment sets APP_VERSION (vars are not inherited)', () => {
    expect(config.vars?.APP_VERSION).toBe('dev');
    expect(config.env?.staging?.vars?.APP_VERSION).toBe('staging');
    expect(config.env?.production?.vars?.APP_VERSION).toBe('production');
  });
});
