// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/.wrangler/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'docs/**',
      'brand/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Node globals only for root tooling and tests. Workers (apps/api) and browser
    // code (apps/web) get their own globals when those apps are added.
    files: ['*.{js,ts}', 'tests/**/*.ts', '{apps,packages}/*/*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Project rule (ADR 0007): no Node.js APIs in the API, nodejs_compat is switched off in
    // wrangler.jsonc. Configuration and secrets come only from bindings (`c.env`).
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*'], message: 'Node.js APIs are disabled in apps/api (ADR 0007).' },
            { group: ['cloudflare:test'], message: 'Test-only module; use it under test/.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['process', 'Buffer', 'require', '__dirname', '__filename', 'global'].map((name) => ({
          name,
          message: 'Node.js APIs are disabled in apps/api (ADR 0007); use bindings from c.env.',
        })),
      ],
    },
  },
  prettier,
);
