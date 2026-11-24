import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

interface PackageJson {
  name?: string;
  private?: boolean;
  packageManager?: string;
  engines?: { node?: string };
  scripts?: Record<string, string>;
}

function readJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

function workspacePackageFiles(): string[] {
  return ['apps', 'packages'].flatMap((dir) => {
    const base = join(root, dir);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(base, entry.name, 'package.json'))
      .filter((file) => existsSync(file));
  });
}

describe('workspace', () => {
  it('root package pins pnpm and Node 22', () => {
    const pkg = readJson(join(root, 'package.json'));
    expect(pkg.private).toBe(true);
    expect(pkg.packageManager).toMatch(/^pnpm@10\.\d+\.\d+$/);
    expect(pkg.engines?.node).toBe('>=22.12.0 <23');
    expect(readFileSync(join(root, '.nvmrc'), 'utf8').trim()).toBe('22');
  });

  it('root package exposes the standard scripts', () => {
    const scripts = readJson(join(root, 'package.json')).scripts ?? {};
    for (const name of ['dev', 'build', 'lint', 'typecheck', 'test']) {
      expect(scripts, `missing root script "${name}"`).toHaveProperty(name);
    }
  });

  it('every workspace package is private and has typecheck and test scripts', () => {
    for (const file of workspacePackageFiles()) {
      const pkg = readJson(file);
      expect(pkg.private, `${file} must be private`).toBe(true);
      expect(pkg.scripts?.typecheck, `${file} needs a "typecheck" script`).toBeTruthy();
      expect(pkg.scripts?.test, `${file} needs a "test" script`).toBeTruthy();
    }
  });
});
