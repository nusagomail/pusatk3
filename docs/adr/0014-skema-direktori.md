# ADR 0014: Skema direktori (penyedia, cabang, legalitas, jadwal)

Status: diterima · 25 November 2026 · issue #21.

## Keputusan
- **Tabel baru:** `providers`, `branches`, `provider_licenses`, `schedules`, sesuai `docs/skema-db.md`. Migrasi `0001_directory.sql` hanya membuat tabel dan indeks, tidak ada yang dihapus atau diubah.
- **Enum dijaga dua lapis:** Zod di `packages/shared` dan `CHECK` di database. `CHECK` dibangun dari konstanta yang sama (`packages/shared/src/constants.ts`), jadi impor atau skrip yang salah tetap ditolak database.
- **Tanggal jadwal sebagai teks `YYYY-MM-DD`:** jadwal pelatihan adalah hari kalender (Asia/Jakarta), bukan titik waktu. Menyimpannya sebagai milidetik UTC akan menggeser hari (WIB = UTC+7). Format teks ini bisa diurutkan dan dibandingkan langsung. Database mengecek bentuknya dan memastikan `end_date ≥ start_date`; Zod mengecek tanggalnya benar-benar ada.
- **`provider_licenses.issuer` teks bebas:** penerbit izin bisa Kemnaker, BNSP, atau nama LSP (untuk TUK), sehingga tidak cocok dijadikan enum.
- **`plan` ada di `providers` dengan bawaan `free`** dan nilai `free/pro/business` (`PLAN_CODE_VALUES`). Skema input tidak menerima `plan`, `status`, `verification_status`, atau `verified_at`. Nilai-nilai itu hanya diubah admin/langganan, jadi badge tidak pernah bisa dibeli (aturan 5).
- **Hapus = tidak cascade:** foreign key memakai `NO ACTION`. Penyedia yang tutup ditandai `status = closed`, bukan dihapus, agar riwayat lead tetap utuh.

## Konsekuensi
- `provider_members` dan `provider_claims` dibuat bersama auth (Fase 2).
- Verifikasi ulang saat WhatsApp atau legalitas berubah (aturan 6) ditegakkan di API dashboard penyedia (Fase 2), bukan trigger database.
- Mengubah daftar enum butuh migrasi baru (tabel dibuat ulang di SQLite). Ini masuk kategori perubahan yang perlu dicek pemilik bila tabel sudah berisi data.
