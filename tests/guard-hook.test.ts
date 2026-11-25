import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// .claude/hooks/guard.sh decides whether Claude Code may run a command (exit 2 = blocked).
const hook = resolve(import.meta.dirname, '../.claude/hooks/guard.sh');
// Project dir without build output, so the "built for production" rule does not apply.
const cleanProject = mkdtempSync(join(tmpdir(), 'guard-clean-'));

function run(input: unknown, projectDir = cleanProject): number | null {
  const result = spawnSync('bash', [hook], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
  return result.status;
}
const bash = (command: string, projectDir?: string) =>
  run({ tool_name: 'Bash', tool_input: { command } }, projectDir);
const write = (file_path: string) => run({ tool_name: 'Write', tool_input: { file_path } });

describe('guard hook: remote database access is blocked', () => {
  it.each([
    'wrangler d1 migrations apply DB --remote',
    'pnpm exec wrangler d1 migrations apply DB --no-local --remote',
    'wrangler d1 migrations apply DB --remote=true',
    'wrangler d1 execute DB --remote --command "select 1"',
    'npx wrangler d1 export pusatk3-production --remote --output dump.sql',
    'pnpm db:migrate:local --remote',
    'pnpm --filter @pusatk3/api db:migrate:local -- --remote',
    'pnpm db:seed:local --remote',
    'cd apps/api && pnpm db:migrate:local -- --no-local --remote',
  ])('blocks %j', (command) => {
    expect(bash(command)).toBe(2);
  });

  // These D1 subcommands always act on the remote database, with or without a flag.
  it.each([
    'wrangler d1 delete pusatk3-production -y',
    'wrangler d1 create pusatk3-production',
    'wrangler d1 list',
    'wrangler d1 info pusatk3-staging',
    'wrangler d1 insights pusatk3-staging',
    'wrangler d1 time-travel restore pusatk3-staging --timestamp=2026-11-25T00:00:00Z',
    'wrangler d1 time-travel info pusatk3-staging',
    'pnpm --filter @pusatk3/api exec wrangler d1 delete pusatk3-staging',
  ])('blocks always-remote %j', (command) => {
    expect(bash(command)).toBe(2);
  });

  it.each([
    'pnpm --filter @pusatk3/api exec wrangler dev --env staging --remote',
    'wrangler dev --remote',
  ])('blocks remote dev sessions %j', (command) => {
    expect(bash(command)).toBe(2);
  });
});

describe('guard hook: production deploys stay with the owner', () => {
  it.each([
    'wrangler deploy --env production',
    'wrangler deploy --env  production',
    'wrangler deploy --env="production"',
    "wrangler deploy --env='production'",
    'wrangler deploy --env=production',
    'pnpm exec wrangler deploy -e production',
    'wrangler deploy -eproduction',
    'wrangler versions upload --env production',
    'wrangler versions deploy --env production',
    'wrangler rollback --env production',
    'wrangler delete --env production',
    'wrangler triggers deploy --env production',
    'CLOUDFLARE_ENV=production pnpm --filter @pusatk3/web exec wrangler deploy',
    'CLOUDFLARE_ENV="production" pnpm --filter @pusatk3/web build',
    'export CLOUDFLARE_ENV=production && cd apps/web && npx wrangler deploy',
  ])('blocks %j', (command) => {
    expect(bash(command)).toBe(2);
  });

  it('blocks a plain deploy when the web build output targets production', () => {
    const project = mkdtempSync(join(tmpdir(), 'guard-prod-build-'));
    mkdirSync(join(project, 'apps/web/dist/client'), { recursive: true });
    writeFileSync(
      join(project, 'apps/web/dist/client/wrangler.json'),
      JSON.stringify({ name: 'pusatk3-web-production', targetEnvironment: 'production' }),
    );
    expect(bash('cd apps/web && npx wrangler deploy', project)).toBe(2);
    expect(bash('wrangler versions upload', project)).toBe(2);
    expect(bash('pnpm test', project)).toBe(0);
  });
});

describe('guard hook: secrets stay with the owner', () => {
  it.each([
    'wrangler secret put RESEND_API_KEY',
    'wrangler secret delete X',
    'git push --force origin main',
  ])('blocks %j', (command) => {
    expect(bash(command)).toBe(2);
  });

  it.each(['/repo/.env', '/repo/apps/api/.dev.vars', '/repo/.env.production'])(
    'blocks writing %j',
    (path) => {
      expect(write(path)).toBe(2);
    },
  );

  it('allows writing example files', () => {
    expect(write('/repo/apps/api/.dev.vars.example')).toBe(0);
  });
});

describe('guard hook: everyday commands are allowed', () => {
  it.each([
    'pnpm db:migrate:local',
    'pnpm db:seed:local',
    'pnpm exec wrangler d1 migrations apply DB --local',
    'pnpm exec wrangler d1 execute DB --local --command "select 1"',
    'pnpm exec wrangler deploy --dry-run --env staging --outdir /tmp/out',
    'CLOUDFLARE_ENV=staging pnpm --filter @pusatk3/web build',
    'pnpm test',
    'pnpm build',
    'git push -u origin feat/7-env',
    'git log --oneline -5',
    'git fetch --remotes',
  ])('allows %j', (command) => {
    expect(bash(command)).toBe(0);
  });
});
