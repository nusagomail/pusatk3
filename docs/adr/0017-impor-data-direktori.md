# ADR 0017: Impor data direktori dari CSV

Status: diterima · 25 November 2026 · issue #22 (pilihan pemilik A: data contoh satu wilayah dulu).

## Keputusan
- **Format:** empat CSV (`penyedia`, `cabang`, `legalitas`, `jadwal`) dengan header bahasa Indonesia, didokumentasikan di `docs/data/README.md`. Setiap baris divalidasi dengan skema input `packages/shared` yang sama dengan API (#21).
- **Semua atau tidak sama sekali:** pembaca CSV (`packages/db/src/import/directory-csv.ts`) mengumpulkan semua masalah (file, nomor baris asli, pesan). Bila ada satu saja, tidak ada yang ditulis.
- **Deduplikasi:** slug dan nama penyedia unik; nama cabang unik per penyedia; nomor izin unik per jenis di seluruh data; jadwal unik per (penyedia, kategori, tanggal mulai, judul). Kunci yang sama dijaga indeks unik di database (migrasi `0002`).
- **SQL, bukan koneksi langsung:** impor menghasilkan file SQL (`directory-sql.ts`, query dibangun Drizzle lalu nilai di-*inline* sebagai literal SQLite yang di-escape). File yang sama dijalankan `wrangler d1 execute --file` di lokal (`pnpm db:import:local`) dan di pipeline staging (ADR 0015). Jadi sesi Claude Code tidak pernah menulis ke database remote.
- **Upsert idempoten tanpa hapus:** baris yang ada diperbarui (ID tetap), baris yang hilang dari CSV dibiarkan. Impor tidak pernah mengubah `status`, `verification_status`, `verified_at`, atau `plan`.
- **Aturan 6 di impor:** sebelum upsert, penyedia `verified` yang nomor WhatsApp-nya berubah, atau legalitasnya baru/berubah, dikembalikan ke `pending`.
- **Data contoh:** `docs/data/contoh/` berisi penyedia fiktif Jabodetabek. Semua nama berakhiran "(Contoh)", alamat ditandai fiktif, dan tanpa nomor WhatsApp, telepon, email, atau situs supaya tidak ada orang sungguhan yang dihubungi. Penyedia contoh disimpan dengan `providers.is_sample = 1` (opsi `--sample`) dan wajib berlabel "Contoh" di UI.
- **Staging:** perintah deploy Worker `pusatk3-api-staging` menjalankan migrasi → impor data referensi + contoh → deploy. Staging kini berisi 14 bidang, 59 kategori, kota contoh, dan data contoh.

## Konsekuensi
- Kota yang dikenal impor saat ini hanya kota contoh (`SAMPLE_CITIES`). Daftar kota asli ditambahkan bersama data asli.
- Data penyedia asli memakai folder lain, tanpa `--sample`, setelah ditinjau pemilik. Production tidak pernah memuat data contoh: preflight rilis perlu diperluas untuk menolak `is_sample` saat production disiapkan.
- Menghapus data (penyedia tutup, jadwal batal) bukan tugas impor: penyedia ditandai `closed`, jadwal menjadi `expired` lewat Cron.
- Satu file SQL dijalankan D1 sebagai satu impor. Bila datanya membesar (ribuan baris), file dipecah per tabel.
