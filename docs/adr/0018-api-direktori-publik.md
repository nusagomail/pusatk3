# ADR 0018: API direktori publik (pencarian, detail, profil, kota)

Status: diterima · 26 November 2026 · issue #23. Urutan hasil: keputusan pemilik **A**. Pencarian teks sebagian diganti ADR 0020 (#26).

## Keputusan
- **Endpoint publik tanpa login:** `GET /search`, `/schedules/:id`, `/providers/:slug`, `/cities` (`apps/api/src/routes/directory.ts`, kontrak di `docs/api-contract.md`). Input divalidasi skema ketat `packages/shared` (parameter tak dikenal → 422); output skema eksplisit.
- **Yang tampil:** pencarian dan profil hanya menampilkan jadwal `published` yang **belum dimulai** menurut tanggal Asia/Jakarta (`start_date ≥ hari ini`, UTC+7), dari penyedia yang tidak `closed`; peserta tidak bisa lagi mendaftar ke jadwal yang sudah berjalan. Detail jadwal tetap bisa dibuka selama `published` (tautan lama tidak putus). Draf, `expired`, dan penyedia tutup → tidak muncul / 404 (bukan 403, agar tidak membocorkan keberadaan). Penyedia `suspended` masih tampil tanpa badge; kebijakan suspend diputuskan bersama alur verifikasi (Fase 2).
- **Urutan organik (pilihan A):** tanggal mulai terdekat; opsi `sort=price` (termurah, harga kosong di akhir). Tie-break `id`. Paket langganan **tidak pernah** dipakai untuk urutan atau badge; `verified` hanya dari `verification_status = verified` (aturan 5). Respons pencarian punya daftar `sponsored` terpisah (kosong sampai Fase 4), agar sponsor tidak pernah tercampur dengan hasil organik.
- **Data yang tidak pernah keluar:** `plan`, status verifikasi mentah, `verified_at`, `document_key`, `logo_key`, id internal penyedia/cabang. Data contoh membawa `isSample: true` agar UI memasang label "Contoh".
- **Pencarian teks sederhana di D1:** `LIKE` tanpa membedakan huruf besar-kecil (ASCII) pada judul, nama kategori, sinonim kategori, dan nama penyedia; `%`, `_`, dan garis miring terbalik di-escape. **Diganti ADR 0020 (#26):** pencocokan per kata dengan sinonim K3.
- **Paginasi offset** untuk pencarian (`cursor` = offset berikutnya, maks 1000). Hasil pencarian berubah cepat dan diurutkan beberapa cara; offset sederhana dan cukup untuk volume Fase 1. Batas 1000 juga membatasi scraping lewat paginasi.
- **Cache:** pencarian, detail, dan profil `public, max-age=60, s-maxage=300, stale-while-revalidate=600`; kota seperti kategori (lebih lama). Purge per URL saat data berubah dikerjakan di #29.

## Konsekuensi
- **Rate limit belum dipasang** (`docs/api-contract.md` dan `docs/keamanan.md` mewajibkannya). Header `s-maxage` saja **tidak** membuat respons Worker masuk cache (ADR 0010), jadi saat ini setiap request `/search` sampai ke D1 (pencarian `LIKE` memindai tabel). Dapat diterima di staging dengan data contoh; **wajib sebelum production:** rate limit untuk `/search`, `/schedules/:id`, `/providers/:slug` dan Cache API di API (#28/#29), dicatat di checklist `/siapkan-rilis`.
- Paginasi offset bisa melompati/mengulang item bila data berubah di antara halaman; dapat diterima untuk direktori, diganti keyset bila perlu.
- Detail jadwal yang sudah lewat tetapi belum ditandai `expired` oleh Cron masih bisa dibuka lewat tautan langsung; pencarian dan profil sudah menyembunyikannya.
- CORS belum dibuka: web memanggil API dari server (SSR), bukan dari browser. Parameter kosong (`?q=`) dianggap tidak diisi; parameter tak dikenal (mis. `utm_*`) tetap 422, jadi web hanya meneruskan parameter yang dikenal.
- Legalitas ditampilkan apa adanya (termasuk yang `validUntil`-nya lewat); UI wajib memberi label "kedaluwarsa" dan "belum diverifikasi" agar tidak terbaca sebagai jaminan. Deskripsi dan syarat adalah teks bebas penyedia: web merendernya sebagai teks, tidak pernah sebagai HTML.
- Waktu "hari ini" diambil dari `c.var.now` (bawaan `Date.now`), sehingga tes bisa mengunci tanggal (`createApp({ now })`).
