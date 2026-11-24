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
- **`apps/web` (#5):** tambahkan `eslint-plugin-astro` dan `prettier-plugin-astro` (tanpa itu file `.astro` tidak di-lint/di-format); `lib` perlu `["ES2023", "DOM", "DOM.Iterable"]`; blok ESLint dengan `globals.browser` untuk `apps/web/src/**`.
- **`apps/api` (#3):** tipe Workers eksplisit (`wrangler types` atau `@cloudflare/workers-types`) karena `types` default TS 6 kosong; blok ESLint dengan globals worker, bukan Node; tes memakai `@cloudflare/vitest-pool-workers`.
- **pnpm 10** tidak menjalankan script install dependensi secara default: bila wrangler/workerd, esbuild, atau sharp butuh, daftarkan di `onlyBuiltDependencies` pada `pnpm-workspace.yaml`.
