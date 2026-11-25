# Desain: `packages/shared` — tipe dan skema Zod bersama (issue #2)

Status: disetujui pemilik, 25 November 2026.

## Maksud

Satu sumber untuk konstanta (peran, status, penerbit, dll.) dan skema Zod yang dipakai `apps/api`, `apps/web`, dan nanti mobile, agar aturan dan nilai tidak ditulis ulang di tiap app.

## Tujuan

- Paket `@pusatk3/shared` dengan Zod.
- Konstanta sesuai `docs/skema-db.md` (sumber kebenaran), masing-masing dengan skema `z.enum` dan tipe TypeScript.
- Skema error API dan paginasi cursor sesuai `docs/api-contract.md`.
- Tes unit; terbukti bisa diimpor dari paket lain di workspace.

## Bukan tujuan

- Label tampilan ID/EN (dibuat bersama UI, #5/#6), skema entitas (penyedia, jadwal: Fase 1), kategori K3 (seed DB, #4).
- Enum `auth_accounts.provider` (google/email) dan `plans.code` (free/pro/business): menyentuh auth dan pembayaran (gerbang persetujuan), ditambahkan di Fase 2 dan Fase 4.

## Pendekatan

| Pilihan | Untung/rugi | Keputusan |
| --- | --- | --- |
| A. Ekspor sumber TypeScript langsung (`exports` → `src/index.ts`) | Tanpa langkah build; Vite/Astro/wrangler (esbuild) membaca TS | **Dipilih** |
| B. Build ke `dist` (tsc/tsup) | Langkah dan dependensi tambahan, tanpa manfaat sekarang | Ditolak |

## Rincian

- Penerbit: 5 nilai dari `docs/skema-db.md` (`kemnaker`, `bnsp`, `pupr`, `esdm`, `intl`). Issue #2 menyebut hanya 2; dokumen yang diikuti. Kode huruf besar di `docs/kategori-k3.md` dipetakan saat impor seed (#4).
- Kode error: `BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `VALIDATION_ERROR` 422, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500.
- Error: `{ error: { code, message, fields? } }`; `fields` = `[{ path, message }]`, hanya untuk `VALIDATION_ERROR`. `message` 1–500 karakter. Amplop respons membuang field tak dikenal (bukan menolak); lihat ADR 0006.
- Paginasi: query `cursor` (opsional, 1–512 karakter) dan `limit` (desimal kanonik 1–100, bawaan 20), ketat (parameter asing ditolak); respons `{ items, nextCursor: string | null }`.
- Daftar peran hanya menyalin dokumen; tidak mengubah auth/hak akses. Mengubah daftar ini nanti termasuk gerbang persetujuan.
