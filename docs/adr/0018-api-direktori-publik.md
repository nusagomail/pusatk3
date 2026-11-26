# ADR 0018: API direktori publik (pencarian, detail, profil, kota)

Status: diterima · 26 November 2026 · issue #23. Urutan hasil: keputusan pemilik **A**.

## Keputusan
- **Endpoint publik tanpa login:** `GET /search`, `/schedules/:id`, `/providers/:slug`, `/cities` (`apps/api/src/routes/directory.ts`, kontrak di `docs/api-contract.md`). Input divalidasi skema ketat `packages/shared` (parameter tak dikenal → 422); output skema eksplisit.
- **Yang tampil:** jadwal `published` yang belum selesai menurut tanggal Asia/Jakarta (`end_date ≥ hari ini`, UTC+7), dari penyedia yang tidak `closed`. Draf, `expired`, dan penyedia tutup → tidak muncul / 404 (bukan 403, agar tidak membocorkan keberadaan).
- **Urutan organik (pilihan A):** tanggal mulai terdekat; opsi `sort=price` (termurah, harga kosong di akhir). Tie-break `id`. Paket langganan **tidak pernah** dipakai untuk urutan atau badge; `verified` hanya dari `verification_status = verified` (aturan 5). Respons pencarian punya daftar `sponsored` terpisah (kosong sampai Fase 4), agar sponsor tidak pernah tercampur dengan hasil organik.
- **Data yang tidak pernah keluar:** `plan`, status verifikasi mentah, `verified_at`, `document_key`, `logo_key`, id internal penyedia/cabang. Data contoh membawa `isSample: true` agar UI memasang label "Contoh".
- **Pencarian teks sederhana di D1:** `LIKE` tanpa membedakan huruf besar-kecil (ASCII) pada judul, nama kategori, sinonim kategori, dan nama penyedia; `%`, `_`, dan garis miring terbalik di-escape. Mesin pencari dengan sinonim K3 menyusul (#26).
- **Paginasi offset** untuk pencarian (`cursor` = offset berikutnya, maks 1000). Hasil pencarian berubah cepat dan diurutkan beberapa cara; offset sederhana dan cukup untuk volume Fase 1. Batas 1000 juga membatasi scraping lewat paginasi.
- **Cache:** pencarian, detail, dan profil `public, max-age=60, s-maxage=300, stale-while-revalidate=600`; kota seperti kategori (lebih lama). Purge per URL saat data berubah dikerjakan di #29.

## Konsekuensi
- **Rate limit pencarian belum dipasang** (`docs/api-contract.md` mewajibkannya). Cache edge menahan sebagian besar beban; rate limit (Cloudflare Rate Limiting binding atau aturan WAF) dipasang bersama lead (#28) atau cache (#29).
- Paginasi offset bisa melompati/mengulang item bila data berubah di antara halaman; dapat diterima untuk direktori, diganti keyset bila perlu.
- Detail jadwal yang sudah lewat tetapi belum ditandai `expired` oleh Cron masih bisa dibuka lewat tautan langsung; pencarian dan profil sudah menyembunyikannya.
- CORS belum dibuka: web memanggil API dari server (SSR), bukan dari browser.
