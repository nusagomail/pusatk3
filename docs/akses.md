# Daftar akses dan pemilik akun

Daftar akun dan layanan PusatK3, siapa pemiliknya, dan cara memberi atau mencabut akses. **Tidak ada rahasia di sini**: password, token, dan kode 2FA tidak pernah ditulis di repo. Perbarui file ini setiap kali ada akun baru atau orang masuk/keluar.

## Akun dan layanan

| Layanan | Untuk apa | Pemilik | Status | Catatan |
| --- | --- | --- | --- | --- |
| GitHub `nusagomail/pusatk3` | Kode, issue, PR, CI | Pemilik (akun `nusagomail`) | Aktif | `main` dilindungi ruleset: PR + cek CI wajib, tanpa force push |
| Cloudflare (akun "Default account") | Worker web/API, D1, R2, Workers Builds | Pemilik | Aktif | **Dipakai bersama proyek selfgrow** (keputusan B, lihat di bawah) |
| Cloudflare Workers Builds | Deploy staging otomatis dari `main` | Pemilik | Aktif | Token build `pusatk3 build token`; pengaturan di Worker → Settings → Build (ADR 0015) |
| Domain `pusatk3.id` | Alamat production | Pemilik | Belum dibeli | Setelah dibeli, pindahkan DNS ke Cloudflare (`docs/setup-cloudflare.md`) |
| Email (Resend) | OTP masuk, notifikasi | — | Belum (Fase 2) | |
| Pencarian (Meilisearch/Typesense) | Pencarian jadwal | — | Belum diputuskan (#26) | |
| Pembayaran (Midtrans/Xendit) | Langganan penyedia | — | Belum (Fase 4) | Perubahan pembayaran butuh persetujuan pemilik |
| Claude Code | Asisten pengembangan | Pemilik | Aktif | Konfigurasi proyek di `.claude/` |

Resource Cloudflare PusatK3 selalu bernama `pusatk3-*`; yang bernama lain (mis. `selfgrow-*`) bukan milik proyek ini dan tidak boleh disentuh.

## Akses yang dibutuhkan per peran

| Peran | GitHub | Cloudflare | Catatan |
| --- | --- | --- | --- |
| Developer | **Write** (buat branch dan PR; tidak bisa merge tanpa CI hijau) | Tidak perlu untuk kerja harian | Staging di-deploy otomatis; log build bisa diminta ke pemilik |
| Developer senior / lead | **Maintain** | Peran terbatas bila perlu melihat log (mis. *Workers Platform (Read-only)*) | Ingat: akun Cloudflare dipakai bersama selfgrow |
| Pemilik | **Admin** | **Super Administrator** | Satu-satunya yang menjalankan deploy production dan mengubah secret |

Prinsipnya: beri akses **paling kecil** yang cukup untuk pekerjaannya, dan tambah bila memang perlu.

## Memberi akses (orang masuk)

1. **GitHub:** repo → **Settings → Collaborators → Add people** → pilih peran (Write untuk developer). Wajibkan 2FA di akun GitHub mereka.
2. **Cloudflare** (hanya bila benar-benar perlu): dashboard → **Manage Account → Members → Invite** → pilih peran sekecil mungkin. Karena akun dipakai bersama selfgrow, anggota juga bisa melihat resource selfgrow.
3. Catat di tabel "Riwayat akses" di bawah: nama, peran, tanggal.
4. Arahkan ke `docs/onboarding.md`.

## Mencabut akses (orang keluar)

Lakukan di hari yang sama:
1. **GitHub:** Settings → Collaborators → hapus.
2. **Cloudflare:** Members → hapus. Bila orang itu pernah membuat atau melihat token API, **cabut dan buat ulang** token tersebut (My Profile → API Tokens), lalu perbarui secret yang memakainya.
3. Layanan lain yang sudah aktif (email, pencarian, pembayaran): hapus anggota dan putar ulang kunci API yang pernah mereka lihat.
4. Catat di "Riwayat akses".

## Akun Cloudflare bersama selfgrow (keputusan pemilik B)

Pemilik memutuskan PusatK3 tetap di akun Cloudflare yang sama dengan selfgrow (25 November 2026). Data keduanya terpisah (database dan worker sendiri-sendiri), tetapi **kunci akses berlaku untuk seluruh akun**: token deploy dan anggota akun bisa menyentuh kedua proyek. Jaring pengaman yang dipakai (ADR 0011, ADR 0015):

| Jaring pengaman | Status |
| --- | --- |
| Paket npm baru minimal 3 hari sebelum dipakai (`minimumReleaseAge` di `pnpm-workspace.yaml`) | Aktif |
| Hanya cabang `main` yang di-build; `main` dilindungi ruleset + CI | Aktif |
| Token production terpisah, hanya di environment GitHub `production` dengan persetujuan pemilik | Saat production disiapkan |
| Cadangan database production (D1 Time Travel + ekspor berkala ke tempat lain) | Menjelang rilis production |
| Notifikasi email untuk setiap deploy/perubahan Worker | Menjelang rilis production |
| 2FA di akun Cloudflare dan GitHub pemilik | Dicek pemilik |

## Riwayat akses

| Tanggal | Orang | Layanan | Perubahan |
| --- | --- | --- | --- |
| — | — | — | — |
