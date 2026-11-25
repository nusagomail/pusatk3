# apps

Aplikasi yang bisa dijalankan. Lihat `docs/arsitektur.md`.

| Folder    | Isi                                                             | Issue |
| --------- | --------------------------------------------------------------- | ----- |
| `web/`    | Astro di Cloudflare: halaman publik + dashboard                 | #5    |
| `api/`    | Hono di Cloudflare Workers: REST `/api/v1`, semua logika bisnis | #3    |
| `mobile/` | Expo (Fase 5)                                                   | —     |

Setiap app wajib `"private": true`, punya skrip `typecheck` dan `test`, dan punya `vitest.config.ts` (dicek oleh `tests/workspace.test.ts`).

## Syarat saat app dibuat

- **Semua app:** tambahkan `vitest.config.ts` (tanpa itu `pnpm test` di root tidak menjalankan tes app ini).
- **`apps/web` (#6, kerangka sudah ada):** Astro statis + token di `src/styles/tokens.css` (nilai dikunci ke `docs/design-tokens.md` dan dites kontrasnya), komponen dasar di `src/components/`, katalog internal `/internal/komponen` (noindex). ESLint (`eslint-plugin-astro` + aturan aksesibilitas `jsx-a11y-x`) dan Prettier (`prettier-plugin-astro`) sudah mencakup `.astro`. #5 menambah adapter Cloudflare, SSR + header cache, dan beranda. Lokal: `pnpm dev` → http://localhost:4321/internal/komponen.
- **`apps/api` (#3, sudah ada):** tipe dari `@cloudflare/workers-types`; ESLint melarang global Node (`process`, `Buffer`, …) di `apps/api/src`; tes berjalan di runtime Workers lewat `@cloudflare/vitest-plugin` (pengganti `@cloudflare/vitest-pool-workers`). `nodejs_compat` dimatikan di `wrangler.jsonc`; ESLint juga melarang `node:*` dan `cloudflare:test` di `src`. Typecheck memakai `tsconfig.json` (src, tipe Workers saja) dan `tsconfig.test.json` (tes). Lokal: `pnpm dev` → http://127.0.0.1:8787/api/v1/health.
- **pnpm 10** tidak menjalankan script install dependensi secara default: bila wrangler/workerd, esbuild, atau sharp butuh, daftarkan di `onlyBuiltDependencies` pada `pnpm-workspace.yaml`.
