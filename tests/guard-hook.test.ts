import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// .claude/hooks/guard.sh decides whether Claude Code may run a command (exit 2 = blocked).
const hook = resolve(import.meta.dirname, '../.claude/hooks/guard.sh');

function run(input: unknown): number | null {
  const result = spawnSync('bash', [hook], { input: JSON.stringify(input), encoding: 'utf8' });
  return result.status;
}
const bash = (command: string) => run({ tool_name: 'Bash', tool_input: { command } });
const write = (file_path: string) => run({ tool_name: 'Write', tool_input: { file_path } });

describe('guard hook: remote database access is blocked', () => {
  it.each([
    'wrangler d1 migrations apply DB --remote',
    'pnpm exec wrangler d1 migrations apply DB --no-local --remote',
    'wrangler d1 execute DB --remote --command "select 1"',
    'npx wrangler d1 export pusatk3-production --remote --output dump.sql',
    'wrangler d1 time-travel restore pusatk3-production --remote',
    'pnpm db:migrate:local --remote',
    'pnpm --filter @pusatk3/api db:migrate:local -- --remote',
    'pnpm db:seed:local --remote',
    'cd apps/api && pnpm db:migrate:local -- --no-local --remote',
  ])('blocks %j', (command) => {
    expect(bash(command)).toBe(2);
  });
});

describe('guard hook: production and secrets stay with the owner', () => {
  it.each([
    'wrangler deploy --env production',
    'pnpm exec wrangler deploy -e production',
    'wrangler secret put RESEND_API_KEY',
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
    'pnpm test',
    'git push -u origin feat/7-env',
    'git log --oneline -5',
  ])('allows %j', (command) => {
    expect(bash(command)).toBe(0);
  });
});
