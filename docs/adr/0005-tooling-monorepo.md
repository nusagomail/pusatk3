# ADR 0005: Tooling monorepo (TypeScript, ESLint, Prettier, Vitest, Turborepo)

Status: diterima · 24 November 2026 · issue #1. Desain lengkap: `docs/superpowers/specs/2026-11-24-monorepo-design.md`.

## Konteks
Semua app dan paket harus memakai standar kode dan perintah yang sama. Saat ini baru ada 3–4 app/paket yang direncanakan.

## Keputusan
- **Konfigurasi bersama di root** (`tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`), bukan paket `packages/config`. Cukup untuk ukuran repo sekarang.
- **ESLint + Prettier**, bukan Biome (diminta issue #1; ekosistem plugin Astro lebih matang).
- **`pnpm lint` dan `pnpm test` dijalankan sekali dari root** dan mencakup semua paket. Vitest menemukan paket lewat `apps/*/vitest.config.ts` dan `packages/*/vitest.config.ts`; tes penjaga `tests/workspace.test.ts` mewajibkan file itu agar tes paket tidak terlewat diam-diam. `build`, `dev`, `typecheck` lewat Turborepo.
- **TypeScript dikunci ke 6.0.x.** TypeScript 7 belum didukung `typescript-eslint` (<6.1) dan `@astrojs/check` (^5 || ^6).
- **Vitest dikunci ke 4.1.x.** `@cloudflare/vitest-pool-workers` (cara standar menguji Hono + D1/KV/Queues di runtime Workers) baru mendukung Vitest ^4.1. *Pembaruan 25 Nov 2026 (#3):* paket itu berganti nama menjadi `@cloudflare/vitest-plugin`, yang sudah mendukung Vitest ^4.1 || ^5; naik ke Vitest 5 bisa dilakukan di issue tersendiri.
- **Node `>=22.23.4 <23` dengan `engine-strict`.** Batas bawah mengikuti syarat Astro 7.

## Konsekuensi
- Naik ke TypeScript 7 / Vitest 5 menunggu dukungan alat di atas; tinjau ulang ADR ini saat itu.
- Syarat saat app dibuat tercatat di `apps/README.md` (plugin Astro untuk ESLint/Prettier, globals per lingkungan, tipe Workers, `onlyBuiltDependencies`).
- Mengubah `tsconfig.base.json` atau `.nvmrc` membatalkan cache Turbo (`globalDependencies`).
