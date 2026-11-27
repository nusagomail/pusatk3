# ADR 0024: Login tanpa password, sesi, dan 2FA (rincian ADR 0003)

Status: diterima · 27 November 2026 · issue #47. Rencana disetujui pemilik ("Lanjutkan", 27 November 2026). Melanjutkan ADR 0003.

## Keputusan

### Library dan kontrak API
- **Better Auth** (ADR 0003) dipakai **di belakang endpoint kita sendiri**: rute Hono di `/api/v1/auth/*` memvalidasi input dengan Zod dari `packages/shared` (objek ketat, 415 untuk non-JSON), memanggil fungsi server Better Auth, dan menjawab dengan format error kontrak (`{ error: { code, message } }`). Hanya callback OAuth (`/api/v1/auth/callback/google`) yang diteruskan langsung ke handler Better Auth. Daftar endpoint: `docs/api-contract.md` bagian Auth.
- Versi Better Auth dipin, dan dipasang setelah lolos aturan umur rilis pnpm (`minimumReleaseAge`).
- **Syarat yang harus dipenuhi PR 2** (diverifikasi pada versi yang dipin; bila library tidak mendukung, kode tambahan kita yang memenuhinya, atau penyimpangannya dicatat di sini dan disetujui pemilik sebelum merge):
  - token sesi di database disimpan sebagai **hash**;
  - kode cadangan 2FA disimpan sebagai **hash**;
  - secret TOTP **terenkripsi** (AES-GCM) dengan kunci terpisah `TWO_FACTOR_KEY`, bukan dengan `AUTH_SECRET`.

### Cara masuk
- Google (OAuth authorization code dengan `state` + PKCE), atau email + kode 6 angka. Tidak ada password.
- `callbackURL` setelah login hanya boleh berupa path relatif di origin sendiri, untuk mencegah open redirect.
- **Penautan akun:** login Google ditautkan otomatis ke akun email yang sama **hanya** bila Google menyatakan `email_verified = true`. Bila email Google tidak terverifikasi, login ditolak dengan pesan untuk masuk lewat kode email.

### Kode email (OTP) dan anti-penyalahgunaan
- Kode berlaku 10 menit dan sekali pakai; maksimal 5 kali salah, lalu kode harus diminta ulang. Kode disimpan sebagai hash.
- **Batas berlapis:**
  - per IP: binding Workers Rate Limiting (ADR 0022, periode 60 detik);
  - per alamat email: maksimal 3 permintaan kode per 15 menit, dan **maksimal 20 verifikasi gagal per hari**, lalu email itu dikunci 24 jam. Penghitungnya di D1, karena binding rate limit hanya menerima periode 10/60 detik.
  - IP pengunjung mengikuti aturan ADR 0022: `CF-Connecting-IP`, atau `X-PusatK3-Visitor-IP` hanya bila header pertama tidak ada. `x-forwarded-for` dari klien tidak pernah dipakai, termasuk oleh rate limiter bawaan Better Auth.
- **Turnstile wajib** di form minta kode (`docs/keamanan.md`), supaya endpoint ini tidak dipakai membanjiri inbox orang lain. Aturannya sama dengan form pertanyaan (ADR 0022): tanpa secret di lingkungan deploy → 503; lokal memakai kunci uji.
- Jawaban "kode terkirim" selalu sama, entah email terdaftar atau tidak, supaya daftar akun tidak bocor.

### Sesi dan cookie
- **Satu origin untuk browser, path sama di semua lingkungan:** auth selalu di `/api/v1/auth/*` pada origin web.
  - Production: `pusatk3.id/api/*` langsung ke Worker API (origin sama).
  - Staging dan lokal: Worker web memproksikan `/api/v1/auth/*` ke API lewat service binding (atau `API_ORIGIN` lokal). Proksi meneruskan cookie, mengembalikan setiap `Set-Cookie` (`getSetCookie()`), dan membuang `X-PusatK3-Visitor-IP` kiriman klien sebelum mengisinya sendiri.
- **Cookie `__Host-pusatk3_session`:** `HttpOnly; Secure; SameSite=Lax; Path=/`, tanpa `Domain`. Awalan `__Host-` penting karena `*.workers.dev` (termasuk Worker proyek lain di akun bersama, ADR 0016) dan subdomain `pusatk3.id` dihitung "situs yang sama", sehingga `SameSite` saja tidak cukup dan cookie bisa "dilempar" dari situs saudara (session fixation).
- **CSRF:** setiap mutasi auth dicek `Origin`-nya terhadap daftar persis per lingkungan (`trustedOrigins` = origin web lingkungan itu saja).
- Sesi berlaku 30 hari dan diperpanjang saat dipakai, dengan **batas umur absolut 90 hari**. Sesi diganti baru setelah login dan setelah lolos 2FA.
- Halaman "perangkat yang sedang masuk" menampilkan perangkat (user agent ringkas), waktu terakhir dipakai, dan kota perkiraan (tanpa IP mentah); setiap sesi bisa diakhiri.

### 2FA (wajib untuk penyedia dan admin)
- TOTP (aplikasi authenticator) + 10 kode cadangan sekali pakai.
- **Penanda per sesi** `two_factor_verified_at`. `requireProviderRole` / `requireAdmin` menolak (403) bila 2FA belum aktif, atau bila sesi ini belum lolos 2FA. Aksi admin meminta 2FA ulang setiap 12 jam.
- Penegakan **tidak bergantung pada cara masuk**: login Google dan email OTP sama-sama berakhir di sesi tanpa penanda 2FA, sampai TOTP atau kode cadangan diverifikasi. PR 2 mengetesnya per metode login.
- **Mengubah 2FA** (aktifkan, matikan, buat ulang kode cadangan) memerlukan autentikasi ulang: kode email baru, atau TOTP yang masih berlaku. Dengan begitu sesi yang dicuri tidak bisa mematikan 2FA.

### Email dan secret
- Email dikirim lewat Resend REST API (tanpa SDK) dari `PusatK3 <noreply@pusatk3.id>` (`apps/api/src/lib/email.ts`).
  - Lokal (`ENVIRONMENT=local`, dijaga `tests/wrangler-config.test.ts`): tidak dikirim, hanya ditulis ke log lokal.
  - Lingkungan deploy tanpa `RESEND_API_KEY`: login email menjawab 503. Login Google tetap jalan.
  - Resend adalah pemroses data (alamat email dan isi), jadi dicatat di kebijakan privasi (#48).
- **Secret per lingkungan** (Workers secret, diisi pemilik; nilai production berbeda dari staging):
  - `RESEND_API_KEY`;
  - `GOOGLE_CLIENT_SECRET` (`GOOGLE_CLIENT_ID` bersifat publik dan disimpan di `wrangler.jsonc`);
  - `AUTH_SECRET`: mengganti nilainya membuat semua orang keluar;
  - `TWO_FACTOR_KEY`: tidak boleh diganti tanpa prosedur rotasi, karena 2FA yang sudah aktif tidak bisa dibuka lagi.
- **Bertahap dalam PR:**
  1. desain ini + modul pengirim email;
  2. Better Auth + tabel (`verification`, kolom penanda 2FA, dll. di `docs/skema-db.md`) + endpoint API + penjaga peran + tes hak akses;
  3. proksi dan halaman web (masuk, kode, 2FA, perangkat).

## Konsekuensi
- Domain `pusatk3.id` harus aktif di Cloudflare dan diverifikasi di Resend (DNS SPF/DKIM/DMARC) sebelum email terkirim. Login Google bisa diuji lebih dulu di staging.
- Peran (`provider_members`, `admin_roles`) baru diberikan di #48 dan #53. Penjaga peran dibuat di sini dan menolak siapa pun yang belum punya peran.
- Mengubah email akun memerlukan OTP ke alamat baru (ADR 0003); dikerjakan bersama pengaturan akun (#52).
- Kuota gratis Resend (100 email/hari) dipakai bersama staging dan production; kirim dari subdomain terpisah bila perlu.
