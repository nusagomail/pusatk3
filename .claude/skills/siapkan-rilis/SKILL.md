---
name: siapkan-rilis
description: Checklist sebelum deploy PusatK3 ke production. Hanya dijalankan atas perintah pemilik.
disable-model-invocation: true
---

Siapkan rilis production. Jangan men-deploy sendiri.

1. Pastikan `main` hijau di CI dan staging sudah diuji.
2. Daftar perubahan sejak rilis terakhir: `git log <tag-terakhir>..main --oneline`.
3. Tandai yang menyentuh gerbang persetujuan: migrasi, auth, pembayaran, secret/binding.
4. Untuk migrasi: tampilkan SQL yang akan dijalankan dan rencana rollback.
5. Jalankan subagent `reviewer` pada diff rilis.
6. Susun catatan rilis singkat (bahasa Indonesia) dan usulan tag versi.
7. Pastikan rate limit dan Cache API untuk endpoint publik direktori (`/search`, `/schedules/:id`, `/providers/:slug`) sudah aktif (ADR 0018); bila belum, rilis ditunda.
8. Pastikan web production punya service binding `API` ke `pusatk3-api-production` (ADR 0019; perubahan binding production butuh persetujuan pemilik).
9. Pastikan rate limit halaman direktori tidak bergantung pada IP yang terlihat API lewat service binding (ADR 0019).
10. Tampilkan ringkasan ke pemilik dan tunggu perintah eksplisit "deploy production".
