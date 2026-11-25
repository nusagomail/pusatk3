import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Structure and safety rules for .github/workflows (docs/adr/0012-ci-deploy.md).
const read = (name: string) =>
  readFileSync(resolve(import.meta.dirname, '../.github/workflows', name), 'utf8');

const WORKFLOWS = ['ci.yml', 'deploy-staging.yml', 'deploy-production.yml'] as const;
const PINNED = {
  'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1', // v7.0.1
  'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1', // v7.1.0
  'pnpm/action-setup': '73e46992e05b19abd31f2f3c20e0e7370d762115', // v6.1.1
};

/** Text of the YAML block whose first line is `  <name>:` up to the next sibling key. */
function block(text: string, name: string, indent = 2): string {
  const pad = ' '.repeat(indent);
  const start = text.indexOf(`\n${pad}${name}:`);
  if (start < 0) return '';
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(new RegExp(`\\n${pad}[A-Za-z_-]+:`));
  return next < 0 ? rest : rest.slice(0, next + 1);
}

describe.each(WORKFLOWS)('%s', (name) => {
  const text = read(name);

  it('grants read-only repository access by default', () => {
    expect(text).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(text).not.toMatch(/: write/);
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

  it('never interpolates secrets into shell commands', () => {
    for (const line of text.split('\n')) {
      if (/\$\{\{\s*secrets\./.test(line))
        expect(line).toMatch(/^\s+[A-Z_]+: \$\{\{ secrets\.[A-Z_]+ \}\}$/);
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
    expect(text).toMatch(/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  });
});

describe('deploy-staging.yml', () => {
  const text = read('deploy-staging.yml');

  it('runs only after CI succeeded for a push to main, on the commit CI tested', () => {
    expect(block(text, 'on', 0)).toMatch(
      /workflow_run:\n\s+workflows: \[CI\]\n\s+types: \[completed\]/,
    );
    expect(text).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(text).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(text).toContain("github.event.workflow_run.event == 'push'");
    expect(text).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
  });

  it('uses the staging environment and never the production one', () => {
    expect(text).toMatch(/environment: staging/);
    expect(text).not.toMatch(/production/);
  });

  it('skips with a notice (not a failure) until the token exists (owner decision A)', () => {
    expect(text).toMatch(/::notice::/);
    expect(text).toMatch(/if: steps\.secrets\.outputs\.ready == 'true'/);
  });

  it('migrates, deploys API and web, then smoke-tests', () => {
    const order = [
      'd1 migrations apply DB --env staging --remote',
      'wrangler deploy --env staging --var APP_VERSION:',
      'CLOUDFLARE_ENV: staging',
      'pnpm --filter @pusatk3/web exec wrangler deploy',
      '/api/v1/health',
    ].map((needle) => text.indexOf(needle));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('serializes deploys instead of cancelling one midway', () => {
    expect(text).toMatch(/group: deploy-staging\n\s+cancel-in-progress: false/);
  });
});

describe('deploy-production.yml', () => {
  const text = read('deploy-production.yml');
  const triggers = block(text, 'on', 0);

  it('can only be started by hand', () => {
    expect(triggers).toMatch(/workflow_dispatch:/);
    for (const other of [
      'push',
      'pull_request',
      'workflow_run',
      'schedule',
      'repository_dispatch',
    ]) {
      expect(triggers).not.toMatch(new RegExp(`\\b${other}:`));
    }
  });

  it('deploys only main, through the protected production environment', () => {
    expect(text).toContain("if: github.ref == 'refs/heads/main'");
    expect(text).toMatch(/environment: production/);
  });

  it('runs the preflight and all quality gates before touching Cloudflare', () => {
    const first = (needle: string) => text.indexOf(needle);
    const deploy = first('d1 migrations apply');
    for (const gate of ['production-preflight.mjs', 'pnpm lint', 'pnpm typecheck', 'pnpm test']) {
      expect(first(gate), gate).toBeGreaterThan(0);
      expect(first(gate), gate).toBeLessThan(deploy);
    }
  });

  it('fails hard when the token is missing', () => {
    expect(text).toMatch(/::error::/);
    expect(text).not.toMatch(/::notice::.*CLOUDFLARE_API_TOKEN/);
  });

  it('targets production consistently and smoke-tests pusatk3.id', () => {
    expect(text).toContain('d1 migrations apply DB --env production --remote');
    expect(text).toContain('wrangler deploy --env production --var APP_VERSION:');
    expect(text).toContain('CLOUDFLARE_ENV: production');
    expect(text).toContain('https://pusatk3.id/api/v1/health');
    expect(text).not.toMatch(/staging/);
  });
});
