# Daftar akses dan pemilik akun

Daftar akun dan layanan PusatK3, siapa pemiliknya, dan cara memberi atau mencabut akses. **Tidak ada rahasia di sini**: password, token, dan kode 2FA tidak pernah ditulis di repo. Perbarui file ini setiap kali ada akun baru atau orang masuk/keluar.

## Akun dan layanan

| Layanan | Untuk apa | Pemilik | Status | Catatan |
| --- | --- | --- | --- | --- |
| GitHub `nusagomail/pusatk3` | Kode, issue, PR, CI | Pemilik (akun `nusagomail`) | Aktif | `main` dilindungi ruleset: PR + cek CI wajib, tanpa force push |
| Cloudflare (akun "Default account") | Worker web/API, D1, R2, Workers Builds | Pemilik | Aktif | **Dipakai bersama proyek selfgrow** (ADR 0016, lihat di bawah) |
| Cloudflare Workers Builds | Deploy staging otomatis dari `main` | Pemilik | Aktif | Token build `pusatk3 build token`; pengaturan di Worker → Settings → Build (ADR 0015) |
| Domain `pusatk3.id` | Alamat production | Pemilik | Belum dibeli | Setelah dibeli, pindahkan DNS ke Cloudflare (`docs/setup-cloudflare.md`) |
| Email (Resend) | OTP masuk, notifikasi | pemilik | Belum (Fase 2); langkah: `docs/setup-cloudflare.md` 5b | Secret `RESEND_API_KEY` di Worker API |
| Google Cloud (OAuth) | "Masuk dengan Google" | pemilik | Belum (Fase 2); langkah: `docs/setup-cloudflare.md` 5c | Secret `GOOGLE_CLIENT_SECRET` di Worker API |
| Pencarian (Meilisearch/Typesense) | Pencarian jadwal | — | Belum diputuskan (#26) | |
| Pembayaran (Midtrans/Xendit) | Langganan penyedia | — | Belum (Fase 4) | Perubahan pembayaran butuh persetujuan pemilik |
| Claude Code | Asisten pengembangan | Pemilik | Aktif | Konfigurasi proyek di `.claude/` |

Resource Cloudflare PusatK3 selalu bernama `pusatk3-*`; yang bernama lain (mis. `selfgrow-*`) bukan milik proyek ini dan tidak boleh disentuh.

## Akses yang dibutuhkan per peran

Repo `nusagomail/pusatk3` ada di **akun GitHub pribadi**. Di repo pribadi, setiap kolaborator mendapat izin yang sama (setara *Write*: bisa push branch dan membuat PR), dan pemilik tidak bisa mewajibkan 2FA bagi mereka. **Sebelum merekrut developer, pindahkan repo ke GitHub Organization** (gratis): peran bisa dibedakan (*Read*, *Write*, *Maintain*, *Admin*) dan 2FA bisa diwajibkan.

| Peran | GitHub | Cloudflare | Catatan |
| --- | --- | --- | --- |
| Developer | *Write* (branch + PR; merge oleh pemilik) | Tidak diberi akses | Log build staging diminta ke pemilik |
| Developer senior / lead | *Maintain* (di Organization) | Bila perlu log: peran baca saja (mis. *Workers Platform (Read-only)*, cek ketersediaannya di dashboard) | Anggota akun Cloudflare juga melihat resource selfgrow |
| Pemilik | *Admin* | *Super Administrator - All Privileges* | Satu-satunya yang me-merge ke `main`, menjalankan deploy production, dan mengubah secret |

**Penting: akses merge ke `main` sama dengan kuasa atas seluruh akun Cloudflare.** Setiap commit di `main` di-build Workers Builds dengan token yang berlaku untuk seluruh akun (termasuk resource production PusatK3 dan selfgrow), dan kode dalam PR (skrip build, dependensi) ikut berjalan dengan token itu. Karena itu:
- Saat developer pertama bergabung, ubah ruleset `main`: **Require approvals = 1** (developer tidak bisa me-merge PR-nya sendiri; pemilik yang menyetujui). Selama yang membuat PR hanya pemilik (bersama Claude Code), approval tetap 0 karena GitHub tidak mengizinkan menyetujui PR sendiri.
- Hanya pemilik yang boleh di-*bypass* ruleset; daftar bypass tetap kosong.

Prinsipnya: beri akses **paling kecil** yang cukup untuk pekerjaannya, dan tambah bila memang perlu.

## Memberi akses (orang masuk)

1. **GitHub:** repo → **Settings → Collaborators** (atau di Organization: **People → Invite**) → peran sesuai tabel. Minta mereka mengaktifkan 2FA (di Organization: wajibkan).
2. Ubah ruleset `main`: **Require approvals = 1** (lihat di atas), bila belum.
3. **Cloudflare** (hanya bila benar-benar perlu): dashboard → **Manage Account → Members → Invite** → peran sekecil mungkin. Aktifkan wajib 2FA untuk anggota akun.
4. Catat di tabel "Riwayat akses" di bawah: nama, peran, tanggal.
5. Arahkan ke `docs/onboarding.md`.

## Mencabut akses (orang keluar)

Lakukan di hari yang sama:
1. **GitHub:** hapus kolaborator/anggota.
2. **Cloudflare:** Members → hapus. Bila orang itu pernah membuat atau melihat token API, **cabut dan buat ulang** token tersebut (My Profile → API Tokens), lalu perbarui secret yang memakainya.
3. **Token build Workers Builds:** bila orang itu pernah bisa me-merge ke `main` atau mengubah pengaturan build, buat token build baru di Worker → **Settings → Build**, ganti di kedua Worker staging, lalu hapus token lama.
4. Layanan lain yang sudah aktif (email, pencarian, pembayaran): hapus anggota dan putar ulang kunci API yang pernah mereka lihat.
5. Catat di "Riwayat akses".

## Akun Cloudflare bersama selfgrow (ADR 0016)

Pemilik memutuskan PusatK3 tetap di akun Cloudflare yang sama dengan selfgrow (25 November 2026). Data keduanya terpisah (database dan worker sendiri-sendiri), tetapi **kunci akses berlaku untuk seluruh akun**: token deploy dan anggota akun bisa menyentuh kedua proyek. **Risiko yang diterima:** build staging dari `main` secara teknis juga bisa mengubah atau menghapus resource production PusatK3 (D1 `pusatk3-production`, worker production); token production terpisah hanya membatasi di mana token itu disimpan, bukan jangkauannya. Jaring pengaman yang dipakai (ADR 0016):

| Jaring pengaman | Status |
| --- | --- |
| Paket npm baru minimal 3 hari sebelum dipakai (`minimumReleaseAge` di `pnpm-workspace.yaml`) | Aktif |
| Hanya cabang `main` yang di-build; `main` dilindungi ruleset + CI | Aktif |
| Ruleset `main`: Require approvals = 1 (developer tidak me-merge sendiri) | Saat developer pertama bergabung |
| Repo dipindah ke GitHub Organization (peran + 2FA wajib) | Sebelum merekrut |
| Token production terpisah, hanya di environment GitHub `production` dengan persetujuan pemilik | Saat production disiapkan |
| Cadangan database production (D1 Time Travel + ekspor berkala ke tempat lain) | Menjelang rilis production |
| Notifikasi email untuk setiap deploy/perubahan Worker | Menjelang rilis production |
| 2FA di akun Cloudflare dan GitHub pemilik | Dicek pemilik |

## Riwayat akses

| Tanggal | Orang | Layanan | Perubahan |
| --- | --- | --- | --- |
| — | — | — | — |
