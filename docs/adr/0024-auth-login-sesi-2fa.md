# ADR 0024: Login tanpa password, sesi, dan 2FA (rincian ADR 0003)

Status: diterima · 27 November 2026 · issue #47. Rencana disetujui pemilik ("Lanjutkan", 27 November 2026). Melanjutkan ADR 0003.

## Keputusan
- **Library: Better Auth** (ADR 0003), dengan adapter Drizzle di D1 dan plugin `emailOTP` serta `twoFactor`. Alasannya: alur OTP, OAuth, sesi, dan TOTP sudah teruji luas, jadi tidak ditulis sendiri. Tabel mengikuti `docs/skema-db.md` lewat pemetaan nama tabel/kolom adapter. Dipasang setelah lolos aturan umur rilis pnpm (`minimumReleaseAge`), dengan versi dipin.
- **Cara masuk:** Google (OAuth, alur authorization code) atau email + kode 6 angka. Tidak ada password.
- **Kode email (OTP):**
  - berlaku 10 menit dan sekali pakai;
  - maksimal 5 kali salah, lalu kode harus diminta ulang;
  - maksimal 3 permintaan per 15 menit per alamat email, dan dibatasi per IP (rate limit, ADR 0022);
  - disimpan sebagai hash.
  - Jawaban "kode terkirim" selalu sama, entah email terdaftar atau tidak, agar daftar akun tidak bocor.
- **Sesi:**
  - cookie `HttpOnly; Secure; SameSite=Lax` di origin web;
  - berlaku 30 hari dan diperpanjang saat dipakai;
  - diganti baru setelah login dan setelah lolos 2FA;
  - token sesi di database disimpan sebagai hash.
  - Halaman "perangkat yang sedang masuk" menampilkan perangkat (user agent ringkas), waktu terakhir dipakai, dan kota perkiraan; IP mentah tidak ditampilkan. Setiap sesi bisa diakhiri.
- **2FA:**
  - TOTP (aplikasi authenticator) + 10 kode cadangan sekali pakai (disimpan hash);
  - secret TOTP dienkripsi AES-GCM dengan kunci `TWO_FACTOR_KEY` (Workers secret);
  - wajib untuk anggota penyedia dan admin: aksi penyedia/admin ditolak (403) sampai 2FA aktif dan lolos di sesi itu.
- **Satu origin untuk browser:** browser hanya berbicara dengan web (`pusatk3.id`); halaman dan endpoint `/akun/*` di web meneruskan permintaan auth ke API lewat service binding (aturan 1, logika tetap di API), membawa cookie dan mengembalikan `Set-Cookie`. Di production API juga berada di origin yang sama (`pusatk3.id/api/*`). Mutasi dicek origin-nya (CSRF).
- **Email:** dikirim lewat Resend REST API (tanpa SDK) dari `PusatK3 <noreply@pusatk3.id>`, dengan secret `RESEND_API_KEY`.
  - Lokal (`ENVIRONMENT=local`): email tidak dikirim, tetapi ditulis ke log lokal, supaya bisa login tanpa akun Resend.
  - Lingkungan deploy tanpa `RESEND_API_KEY`: login email menjawab 503. Login Google tetap jalan.
- **Secret yang diisi pemilik** (Workers secret per lingkungan, tidak pernah di repo):
  - `RESEND_API_KEY`;
  - `GOOGLE_CLIENT_ID` (boleh berupa variabel biasa karena publik) dan `GOOGLE_CLIENT_SECRET`;
  - `AUTH_SECRET` (kunci tanda tangan sesi);
  - `TWO_FACTOR_KEY`.
- **Bertahap dalam PR:**
  1. desain ini + modul pengirim email (tanpa dependensi baru);
  2. Better Auth + tabel + endpoint API + penjaga peran + tes hak akses;
  3. halaman web (masuk, kode, 2FA, perangkat).

## Konsekuensi
- Domain `pusatk3.id` harus aktif di Cloudflare dan diverifikasi di Resend (DNS SPF/DKIM) sebelum email terkirim dari `@pusatk3.id`. Login Google bisa diuji lebih dulu di staging.
- Peran (`provider_members`, `admin_roles`) baru diberikan di #48 dan #53; penjaga `requireProviderRole`/`requireAdmin` dibuat di sini dan menolak siapa pun yang belum punya peran.
- Mengubah email akun memerlukan OTP ke alamat baru (ADR 0003); dikerjakan bersama pengaturan akun (#52).
