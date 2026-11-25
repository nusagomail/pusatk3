import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations only. Applying them: `pnpm db:migrate:local` (local D1);
// staging/production only through CI.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/index.ts',
  out: './migrations',
});
