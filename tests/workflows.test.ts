import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Structure and safety rules for .github/workflows (docs/adr/0012-ci-deploy.md).
// The real gate for deploys is the GitHub environment protection set by the owner
// (docs/setup-cloudflare.md); these tests keep the workflow files honest.
const read = (name: string) =>
  readFileSync(resolve(import.meta.dirname, '../.github/workflows', name), 'utf8');

const WORKFLOWS = ['ci.yml', 'deploy-staging.yml', 'deploy-production.yml'] as const;
const PINNED = {
  'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1', // v7.0.1
  'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1', // v7.1.0
  'pnpm/action-setup': '73e46992e05b19abd31f2f3c20e0e7370d762115', // v6.1.1
};

/** Text of the YAML block whose first line is `<indent><name>:` up to the next sibling key. */
function block(text: string, name: string, indent = 2): string {
  const pad = ' '.repeat(indent);
  const start = text.indexOf(`\n${pad}${name}:`);
  if (start < 0) return '';
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(new RegExp(`\\n${pad}[A-Za-z_-]+:`));
  return next < 0 ? rest : rest.slice(0, next + 1);
}

const indexOf = (text: string, needle: string) => {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`missing: ${needle}`);
  return index;
};

describe.each(WORKFLOWS)('%s', (name) => {
  const text = read(name);

  it('grants read-only repository access by default', () => {
    expect(text).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(text).not.toMatch(/: write/);
  });

  it('runs every step with bash -eo pipefail', () => {
    expect(text).toMatch(/^defaults:\n {2}run:\n {4}shell: bash\n/m);
  });

  it('never uses pull_request_target', () => {
    expect(text).not.toContain('pull_request_target');
  });

  it('pins every action to a reviewed commit SHA', () => {
    const uses = [...text.matchAll(/uses: ([^@\s]+)@(\S+)/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const [, action = '', ref] of uses) {
      expect(Object.keys(PINNED), `unexpected action ${action}`).toContain(action);
      expect(ref).toBe(PINNED[action as keyof typeof PINNED]);
    }
  });

  it('does not leave the git token in the checkout', () => {
    const checkouts = text.split('uses: actions/checkout@').length - 1;
    const disabled = text.split('persist-credentials: false').length - 1;
    expect(disabled).toBe(checkouts);
  });

  it('exposes secrets only as step-level env, never in commands', () => {
    expect(text).not.toMatch(/toJSON\(\s*secrets\s*\)/);
    expect(text).not.toMatch(/secrets\[/);
    expect(text).not.toMatch(/\$\{\{\s*env\.CLOUDFLARE_/);
    for (const line of text.split('\n')) {
      if (/(?<![.\w])secrets\./.test(line)) {
        // Steps are list items at 6 spaces; their `env:` keys sit at 10 spaces.
        expect(line).toMatch(/^ {10}[A-Z_]+: \$\{\{ secrets\.[A-Z_]+ \}\}$/);
      }
    }
  });

  it('installs from the lockfile with the pinned pnpm and Node from .nvmrc', () => {
    expect(text).toContain('pnpm install --frozen-lockfile');
    expect(text).toContain('node-version-file: .nvmrc');
    expect(text).toContain('cache: pnpm');
  });
});

describe('ci.yml', () => {
  const text = read('ci.yml');

  it('runs on pull requests and pushes to main', () => {
    expect(block(text, 'on', 0)).toMatch(/pull_request:/);
    expect(block(text, 'on', 0)).toMatch(/push:\n\s+branches: \[main\]/);
  });

  it('runs every quality gate', () => {
    for (const command of ['pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm build']) {
      expect(text).toContain(`run: ${command}`);
    }
  });

  it('has no access to secrets and cancels superseded PR runs', () => {
    expect(text).not.toMatch(/secrets\./);
    expect(text).not.toMatch(/environment:/);
    expect(text).toMatch(/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  });
});

describe('deploy-staging.yml', () => {
  const text = read('deploy-staging.yml');

  it('runs only after CI succeeded for a push to main of this repository, on the tested commit', () => {
    expect(block(text, 'on', 0)).toMatch(
      /workflow_run:\n\s+workflows: \[CI\]\n\s+types: \[completed\]/,
    );
    expect(text).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(text).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(text).toContain("github.event.workflow_run.event == 'push'");
    expect(text).toContain(
      'github.event.workflow_run.head_repository.full_name == github.repository',
    );
    expect(text).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
  });

  it('uses the staging environment and never the production one', () => {
    expect(text).toMatch(/environment: staging/);
    expect(text).not.toMatch(/production/);
  });

  it('skips with a notice (not a failure) until the token exists (owner decision A)', () => {
    expect(text).toMatch(/::notice::Deploy staging dilewati/);
    expect(text).toMatch(/if: steps\.token\.outputs\.ready == 'true'/);
  });

  it('migrates, deploys API, checks the built worker, deploys web, then smoke-tests', () => {
    const order = [
      'd1 migrations apply DB --env staging --remote',
      'wrangler deploy --env staging --var APP_VERSION:',
      'CLOUDFLARE_ENV: staging',
      '"pusatk3-web-staging"',
      'pnpm --filter @pusatk3/web exec wrangler deploy',
      '/api/v1/health',
      'robots.txt',
    ].map((needle) => indexOf(text, needle));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('waits for the new version instead of failing on a stale edge', () => {
    expect(text).toMatch(/for attempt in/);
    expect(text).toContain('--retry-max-time');
  });

  it('serializes deploys instead of cancelling one midway', () => {
    expect(text).toMatch(/group: deploy-staging\n\s+cancel-in-progress: false/);
  });
});

describe('deploy-production.yml', () => {
  const text = read('deploy-production.yml');

  it('can only be started by hand', () => {
    expect(text).toMatch(/^on:\n {2}workflow_dispatch:\n\n/m);
  });

  it('uses the protected production environment and fails hard outside main', () => {
    expect(text).toMatch(/environment: production/);
    expect(text).toMatch(/"\$GITHUB_REF" = refs\/heads\/main/);
  });

  it('refuses before installing anything, then runs every gate before touching Cloudflare', () => {
    const preflight = indexOf(text, 'node scripts/production-preflight.mjs');
    const install = indexOf(text, 'pnpm install --frozen-lockfile');
    const secretCheck = indexOf(text, '::error::CLOUDFLARE_API_TOKEN');
    const firstCloudflare = indexOf(text, 'd1 migrations apply');
    expect(preflight).toBeLessThan(install);
    expect(secretCheck).toBeLessThan(firstCloudflare);
    for (const gate of ['pnpm lint', 'pnpm typecheck', 'pnpm test']) {
      expect(indexOf(text, gate), gate).toBeGreaterThan(install);
      expect(indexOf(text, gate), gate).toBeLessThan(firstCloudflare);
    }
  });

  it('targets production consistently and smoke-tests pusatk3.id as indexable', () => {
    expect(text).toContain('d1 migrations apply DB --env production --remote');
    expect(text).toContain('wrangler deploy --env production --var APP_VERSION:');
    expect(text).toContain('CLOUDFLARE_ENV: production');
    expect(text).toContain('"pusatk3-web-production"');
    expect(text).toContain('https://pusatk3.id/api/v1/health');
    expect(text).toContain('https://pusatk3.id/robots.txt');
    expect(text).not.toMatch(/staging/);
  });
});
