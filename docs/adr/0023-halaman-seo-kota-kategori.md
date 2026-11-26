# ADR 0023: Halaman SEO kota × kategori, aturan halaman tipis, sitemap dinamis

Status: diterima · 26 November 2026 · issue #27. Ambang: keputusan pemilik ("minimal 3 jadwal dari 2 penyedia").

## Konteks
Orang mencari "pelatihan operator forklift Bekasi". Halaman `/pelatihan/[kategori]/[kota]` menjawab pencarian itu langsung. Halaman yang isinya hanya satu-dua jadwal dinilai "konten tipis" oleh mesin pencari, dan bisa menurunkan kualitas situs secara keseluruhan. Sebelumnya sitemap statis dan hanya berisi beranda.

## Keputusan
- **Aturan halaman tipis:** halaman kategori × kota terbit hanya bila ada **≥ 3 jadwal offline yang tampil** (published, belum mulai, penyedia tidak `closed`) dari **≥ 2 penyedia** di kota itu. Konstanta `LANDING_MIN_SCHEDULES` / `LANDING_MIN_PROVIDERS` ada di `packages/shared`. Selain itu halaman menjawab 404 (`noindex`) dengan ajakan ke `/cari`. Jadwal online tidak dihitung, karena tidak terikat kota.
- **API publik (tanpa login, cache edge + rate limit baca):**
  - `GET /landing-pages`: hanya kombinasi yang lolos ambang, dengan jumlah jadwal/penyedia dan `isSample`;
  - `GET /sitemap`: kunci URL yang boleh diindeks (halaman SEO, profil penyedia tidak `closed`, jadwal yang tampil), **tanpa data contoh**, masing-masing maksimal 10 000.
- **Isi halaman, mengikuti skill `halaman-seo`:**
  - kalimat jawaban di atas (jumlah jadwal, jumlah penyedia, mulai kapan, harga mulai, penerbit);
  - tabel HTML jadwal (tanggal, pelatihan, penyedia, penerbit, harga);
  - daftar penyedia (badge hanya dari verifikasi);
  - tautan ke halaman terkait (kota lain untuk kategori yang sama, kategori lain di kota yang sama);
  - catatan bahwa urutan tidak memakai paket.
- **schema.org:** `BreadcrumbList`, ditambah `ItemList` berisi `Course` (masing-masing dengan `CourseInstance`, `Organization` penyedia, dan `Offer` bila harga ada). Data contoh hanya mendapat breadcrumb dan `noindex`, sama seperti halaman detail.
- **Sitemap dinamis:** `/sitemap.xml` di-SSR dari halaman statis (`PUBLIC_PAGES`) dan jawaban `GET /sitemap`. Bila API gagal, hanya halaman statis yang tampil, dengan `no-store`. Staging hanya berisi data contoh, jadi sitemap-nya hanya beranda; staging memang `noindex`.
- **Tanpa FAQ dulu:** teks FAQ K3 wajib ditinjau Ahli K3 sebelum terbit (CLAUDE.md). Draf FAQ disiapkan di issue terpisah, dan halaman tetap lengkap tanpa FAQ.
- **Data contoh** ditambah dua jadwal fiktif Operator Forklift di Bekasi, sehingga satu halaman (`/pelatihan/operator-forklift/bekasi`) lolos ambang di staging dan e2e.

## Konsekuensi
- Daftar halaman ikut cache edge (ADR 0021): halaman baru muncul atau hilang setelah impor (versi data baru) atau pergantian hari.
- Jumlah halaman tumbuh mengikuti data asli; ambang bisa diubah di satu konstanta (dengan tes).
- Sitemap > 50 000 URL perlu dipecah menjadi indeks sitemap (belum perlu di Fase 1).
- Halaman per kategori saja (tanpa kota) dan halaman online belum ada; bisa ditambah dengan aturan tipis yang sama.
