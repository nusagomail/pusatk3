import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Deploy configuration per environment (docs/adr/0011-lingkungan-cloudflare.md), read with
// wrangler itself so inheritance (main, compatibility flags, assets) is checked as deployed.
// Wrangler does not inherit vars, d1_databases or routes: each environment declares its own.

interface D1 {
  binding: string;
  database_name: string;
  database_id?: string;
  migrations_dir?: string;
}
interface Effective {
  name?: string;
  main?: string;
  compatibility_flags: string[];
  workers_dev?: boolean;
  preview_urls?: boolean;
  observability?: { enabled?: boolean };
  vars: Record<string, unknown>;
  d1_databases: D1[];
  routes?: { pattern: string; zone_name?: string }[];
  assets?: { not_found_handling?: string; run_worker_first?: string[] | boolean };
  services?: { binding: string; service: string }[];
}

type App = 'api' | 'web';
const appDir = (app: App) => resolve(import.meta.dirname, '../apps', app);
const requireFrom = (app: App) => createRequire(resolve(appDir(app), 'package.json'));

function read(app: App, env?: 'staging' | 'production'): Effective {
  const { unstable_readConfig } = requireFrom(app)('wrangler') as {
    unstable_readConfig: (args: { config: string; env?: string }) => Effective;
  };
  return unstable_readConfig({ config: resolve(appDir(app), 'wrangler.jsonc'), env });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STAGING_D1_ID = 'b8fcd041-9853-4ed2-81db-0901dba670b8';
// The owner replaces this with the real ID (docs/setup-cloudflare.md); CI (#8) refuses to deploy it.
const PRODUCTION_D1_PLACEHOLDER = 'ISI-ID-D1-PRODUCTION-OLEH-PEMILIK';

describe.each(['api', 'web'] as const)('apps/%s/wrangler.jsonc', (app) => {
  const local = read(app);
  const staging = read(app, 'staging');
  const production = read(app, 'production');

  it('names workers pusatk3-<app>-<env>', () => {
    expect(local.name).toBe(`pusatk3-${app}`);
    expect(staging.name).toBe(`pusatk3-${app}-staging`);
    expect(production.name).toBe(`pusatk3-${app}-production`);
  });

  it('local development stays private', () => {
    expect(local.workers_dev).toBe(false);
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

  it('never binds to remote resources during local dev', () => {
    for (const env of [local, staging, production]) {
      for (const db of env.d1_databases) expect((db as { remote?: boolean }).remote).not.toBe(true);
    }
  });

  it('has no secret-looking vars in any environment', () => {
    for (const env of [local, staging, production]) {
      for (const key of Object.keys(env.vars))
        expect(key).not.toMatch(/key|token|secret|password/i);
    }
  });
});

describe('apps/api effective config', () => {
  const staging = read('api', 'staging');
  const production = read('api', 'production');
  const migrations = /packages\/db\/migrations$/;

  it('environments inherit the entry point and the no-Node.js flags', () => {
    for (const env of [staging, production]) {
      expect(env.main).toMatch(/apps\/api\/src\/index\.ts$/);
      expect(env.compatibility_flags).toEqual(['no_nodejs_compat', 'no_nodejs_compat_v2']);
    }
  });

  it('staging uses pusatk3-staging', () => {
    const [db] = staging.d1_databases;
    expect(staging.d1_databases).toHaveLength(1);
    expect(db).toMatchObject({
      binding: 'DB',
      database_name: 'pusatk3-staging',
      database_id: STAGING_D1_ID,
    });
    expect(db?.migrations_dir).toMatch(migrations);
  });

  it('production uses pusatk3-production with the placeholder or a real ID', () => {
    const [db] = production.d1_databases;
    expect(production.d1_databases).toHaveLength(1);
    expect(db).toMatchObject({ binding: 'DB', database_name: 'pusatk3-production' });
    expect(db?.database_id === PRODUCTION_D1_PLACEHOLDER || UUID.test(db?.database_id ?? '')).toBe(
      true,
    );
    expect(db?.database_id).not.toBe(STAGING_D1_ID);
    expect(db?.migrations_dir).toMatch(migrations);
  });

  it('every environment sets APP_VERSION (vars are not inherited)', () => {
    expect(read('api').vars.APP_VERSION).toBe('dev');
    expect(staging.vars.APP_VERSION).toBe('staging');
    expect(production.vars.APP_VERSION).toBe('production');
  });
});

describe('apps/web effective config', () => {
  it('every environment serves the static 404 page', () => {
    for (const env of [read('web'), read('web', 'staging'), read('web', 'production')]) {
      expect(env.assets?.not_found_handling).toBe('404-page');
      // SSR pages must run the Worker; otherwise browser navigations get 404.html (#24).
      expect(env.assets?.run_worker_first).toEqual(['/cari', '/jadwal/*', '/penyedia/*']);
    }
  });

  it('reads the API locally over HTTP and in staging through the staging service binding', () => {
    const local = read('web');
    const staging = read('web', 'staging');
    expect(local.vars.API_ORIGIN).toBe('http://127.0.0.1:8787');
    expect(local.services ?? []).toEqual([]);
    expect(staging.services).toEqual([{ binding: 'API', service: 'pusatk3-api-staging' }]);
    expect(staging.vars.API_ORIGIN).toBeUndefined();
  });

  it('production never points at a local API; its binding waits for the owner (ADR 0019)', () => {
    const production = read('web', 'production');
    expect(production.vars.API_ORIGIN).toBeUndefined();
    expect((production.services ?? []).map((s) => s.service)).not.toContain('pusatk3-api-staging');
  });
});
