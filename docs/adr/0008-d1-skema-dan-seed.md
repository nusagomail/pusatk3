# ADR 0008: Konvensi skema D1 dan seed data referensi

Status: diterima · 25 November 2026 · issue #4. Desain: `docs/superpowers/specs/2026-11-25-db-design.md`. Melanjutkan ADR 0002.

## Keputusan
- **ID** ULID teks (`ulid`), dibuat di aplikasi. **Waktu** integer milidetik UTC (`timestamp_ms`). **Array** (penerbit, sinonim) sebagai teks JSON dengan tipe TypeScript eksplisit; nilai penerbit divalidasi `issuerSchema`.
- **Migrasi** hanya dari `drizzle-kit generate`, diperiksa manual, dan dijaga tes (`packages/db/test/migrations.test.ts`) yang menolak `DROP`/`DELETE`/`UPDATE … SET`/`ALTER … DROP|RENAME` kecuali file itu terdaftar sebagai disetujui pemilik.
- **Seed** data referensi lewat fungsi Drizzle `seedReferenceData` (upsert per slug, satu batch D1 per tahap), tanpa SQL tulisan tangan. Fungsi yang sama dipakai tes (workerd) dan skrip lokal (`pnpm db:seed:local`, `getPlatformProxy` dari wrangler, dijalankan `tsx`). Data yang hilang dari CSV tidak dihapus otomatis; seed melaporkannya (`orphans`) dan skrip lokal mencetak peringatan. Skrip lokal memakai `remoteBindings: false` dan path state absolut agar tidak pernah menyentuh D1 remote, walau binding kelak diberi `remote: true`.
- **Sumber kategori** adalah `docs/data/kategori-k3.csv` (bukan glosarium); dibaca `parseCategoriesCsv` yang gagal keras untuk penerbit/masa berlaku tak dikenal, slug ganda/tidak aman-URL (`slugSchema`), kolom wajib kosong, atau baris yang tidak lolos `categorySchema` (skema output API yang sama).
- **D1 lokal** memakai binding `DB` di `apps/api/wrangler.jsonc` dengan `database_id` nol (hanya lokal). Tes API menerapkan semua migrasi ke D1 baru (`readD1Migrations` + `applyD1Migrations`).

## Konsekuensi
- Seed per baris (bukan multi-row upsert dengan `excluded.*`) agar tidak ada potongan SQL mentah; cukup cepat untuk ratusan baris.
- Menghapus atau mengganti nama kategori perlu migrasi/skrip tersendiri dengan persetujuan pemilik.
- `/categories` mengurutkan kategori per bidang berdasarkan nama (tabel tidak menyimpan urutan CSV).
- `drizzle-kit` 0.31 menarik `esbuild` lama yang terkena advisory GHSA-67mh-4wv8-2f99 (hanya dev server esbuild; kita tidak memakainya). Pantau rilis drizzle-kit berikutnya.
- Mengubah tabel yang dirujuk FK (mis. `course_fields`) dengan pola recreate-table drizzle-kit perlu hati-hati di D1 (`PRAGMA foreign_keys=OFF` diabaikan); tinjau saat migrasi semacam itu muncul.
