# ADR 0006: `@pusatk3/shared` dipakai langsung dari sumber TypeScript

Status: diterima · 25 November 2026 · issue #2. Desain: `docs/superpowers/specs/2026-11-25-shared-design.md`.

## Konteks
`packages/shared` dipakai `apps/api` (wrangler/esbuild), `apps/web` (Astro/Vite), dan nanti Expo (Metro). Semua alat itu bisa membaca TypeScript langsung.

## Keputusan
- `package.json` mengekspor `./src/index.ts`; tidak ada langkah build atau folder `dist`.
- Nilai konstanta (peran, status, penerbit) mengikuti `docs/skema-db.md` dan dikunci oleh tes; mengubahnya berarti mengubah dokumen di PR yang sama.
- Skema **input** memakai objek ketat (`z.strictObject`): isian tak dikenal ditolak (`docs/keamanan.md`).
- Skema **respons** (amplop error, paginasi) memakai `z.object`: field tak dikenal dibuang saat di-parse. Di server ini menjamin hanya field eksplisit yang keluar; di klien (web, mobile versi lama) menambah field baru tidak membuat parse gagal. Menghapus atau mengubah field tetap perubahan yang memecah `/api/v1`.

## Alternatif
Build ke `dist` dengan tsc/tsup: menambah langkah dan dependensi, berguna hanya bila paket diterbitkan ke npm.

## Konsekuensi
- Paket tidak bisa diterbitkan ke npm apa adanya (memang tidak direncanakan).
- Import di dalam paket memakai path tanpa ekstensi, jadi setiap konsumen wajib `moduleResolution: Bundler` (dengan `NodeNext`, `tsc` gagal TS2835).
- Skrip Node polos tidak bisa mengimpor paket ini dengan `node`; skrip (mis. impor seed #4) dijalankan lewat `tsx` atau bundler.
- Alat yang didukung: wrangler/esbuild, Astro/Vite (diuji lewat bundling Vite SSR), Vitest. Pool Workers Vitest diverifikasi di #3 dengan tes asap yang mengimpor paket ini. Expo/Metro butuh package exports aktif (bawaan sejak SDK 53).
