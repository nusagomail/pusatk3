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
- **`apps/web` (#5/#6):** Astro + `@astrojs/cloudflare`; halaman di-prerender kecuali `prerender = false` (ADR 0010). Token di `src/styles/tokens.css` (dikunci ke `docs/design-tokens.md`, dites kontrasnya), komponen di `src/components/`, beranda di `src/pages/index.astro` (data statis di `src/data/home.ts`, jadwal contoh selalu berlabel). Header keamanan/cache di `public/_headers`, CSP lewat `security.csp`; halaman publik baru wajib ditambahkan ke `public/_headers` dan `src/data/site.ts`. Video intro: set `PUBLIC_MEDIA_BASE_URL` (https) agar tombol putar muncul. Katalog komponen `/internal/komponen` hanya di `pnpm dev`. ESLint (`eslint-plugin-astro` + `jsx-a11y-x`) dan Prettier mencakup `.astro`. Lokal: `pnpm dev` → http://localhost:4321.
- **`apps/api` (#3, sudah ada):** tipe dari `@cloudflare/workers-types`; ESLint melarang global Node (`process`, `Buffer`, …) di `apps/api/src`; tes berjalan di runtime Workers lewat `@cloudflare/vitest-plugin` (pengganti `@cloudflare/vitest-pool-workers`). `nodejs_compat` dimatikan di `wrangler.jsonc`; ESLint juga melarang `node:*` dan `cloudflare:test` di `src`. Typecheck memakai `tsconfig.json` (src, tipe Workers saja) dan `tsconfig.test.json` (tes). Lokal: `pnpm dev` → http://127.0.0.1:8787/api/v1/health.
- **pnpm 10** tidak menjalankan script install dependensi secara default: bila wrangler/workerd, esbuild, atau sharp butuh, daftarkan di `onlyBuiltDependencies` pada `pnpm-workspace.yaml`.
