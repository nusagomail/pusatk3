# Desain: monorepo pnpm + Turborepo dan tooling dasar (issue #1)

Status: disetujui pemilik, 24 November 2026.

## Maksud

Membuat kerangka repo agar semua issue berikutnya punya struktur folder, standar kode, dan perintah yang sama. Belum ada aplikasi; `apps/web`, `apps/api`, `packages/shared` dibuat di issue masing-masing.

## Tujuan

- Workspace pnpm + Turborepo dengan folder `apps/` dan `packages/`.
- TypeScript strict, ESLint, Prettier dengan konfigurasi bersama.
- Vitest terpasang dan satu tes lulus.
- Skrip root: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm dev`.
- Node 22 (`.nvmrc` + `engines`) dan `packageManager` pnpm terkunci.
- README dan bagian "Perintah" di `CLAUDE.md` diperbarui.

## Bukan tujuan

- Membuat app/paket apa pun (issue #2–#6), CI (#8), Playwright (#9), wrangler (#7).
- Memformat ulang dokumen Markdown pemilik di `docs/`.

## Pendekatan

| Pilihan | Untung/rugi | Keputusan |
| --- | --- | --- |
| A. Konfigurasi bersama di root (`tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`) | Sederhana, satu tempat; cukup untuk 3–4 app | **Dipilih** |
| B. Paket `packages/config` | Rapi untuk banyak app, tapi menambah lapisan sekarang | Ditolak (YAGNI) |
| C. Biome menggantikan ESLint + Prettier | Bertentangan dengan kriteria issue | Ditolak |

## Rincian

- `pnpm lint` = ESLint untuk seluruh repo + `prettier --check`. Lint dijalankan dari root (bukan per paket lewat Turbo) agar satu konfigurasi berlaku di mana pun.
- `pnpm typecheck` = `tsc` untuk file root + `turbo run typecheck` untuk tiap paket.
- `pnpm test` = Vitest root dengan `projects` yang mencakup `apps/*` dan `packages/*`; setiap paket wajib punya `vitest.config.ts` (dijaga tes).
- Vitest dikunci 4.1.x (kompatibel `@cloudflare/vitest-pool-workers`); Node `>=22.23.4` (syarat Astro 7). Lihat ADR 0005.
- `pnpm build` / `pnpm dev` = `turbo run build` / `turbo run dev`.
- Tes penjaga `tests/workspace.test.ts`: Node 22 dan pnpm terkunci; setiap paket workspace `private`, punya skrip `typecheck` dan `test`, dan punya `vitest.config.ts`.
- TypeScript dikunci ke 6.0.x karena `typescript-eslint` (<6.1) dan `@astrojs/check` (^5 || ^6) belum mendukung TypeScript 7.

## Keputusan builder (bisa dikoreksi pemilik)

- `.prettierignore` mengecualikan `docs/**/*.md`, `docs/mockup`, `docs/model`, `docs/data`, `brand/`.
- `.npmrc` `engine-strict=true` agar versi Node yang salah langsung ditolak.
