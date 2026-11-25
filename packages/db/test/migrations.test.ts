import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = resolve(import.meta.dirname, '../migrations');
const sqlFiles = readdirSync(dir).filter((f) => f.endsWith('.sql'));

// Migrations that drop or rewrite data need owner approval (CLAUDE.md). List an approved
// file here only in the PR that carries that approval.
const APPROVED_DESTRUCTIVE: string[] = [];

const DESTRUCTIVE =
  /\b(DROP\s+(TABLE|COLUMN|INDEX)|DELETE\s+FROM|UPDATE\s+(OR\s+\w+\s+)?\S+\s+SET|REPLACE\s+INTO|ALTER\s+TABLE\s+\S+\s+(DROP|RENAME))\b/i;

describe('migrations', () => {
  it('exist', () => {
    expect(sqlFiles.length).toBeGreaterThan(0);
  });

  it.each(sqlFiles)('%s does not drop or rewrite data without approval', (file) => {
    const sql = readFileSync(join(dir, file), 'utf8');
    if (APPROVED_DESTRUCTIVE.includes(file)) return;
    expect(sql).not.toMatch(DESTRUCTIVE);
  });
});

describe('destructive pattern', () => {
  it.each([
    'DROP TABLE `cities`;',
    'ALTER TABLE `cities` DROP COLUMN `province`;',
    'ALTER TABLE `__new_cities` RENAME TO `cities`;',
    'DELETE FROM cities;',
    'UPDATE cities SET name = 1;',
    'UPDATE OR REPLACE cities SET name = 1;',
    'REPLACE INTO cities VALUES (1);',
    'INSERT OR REPLACE INTO cities VALUES (1);',
  ])('flags %j', (sql) => {
    expect(sql).toMatch(DESTRUCTIVE);
  });

  it.each(['CREATE TABLE `cities` (`id` text);', 'CREATE UNIQUE INDEX `x` ON `cities` (`slug`);'])(
    'allows %j',
    (sql) => {
      expect(sql).not.toMatch(DESTRUCTIVE);
    },
  );
});
