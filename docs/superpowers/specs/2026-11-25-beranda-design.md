# Desain: beranda + Astro di Cloudflare (issue #5)

Status: disetujui pemilik, 25 November 2026 (opsi A: jadwal contoh dengan label "Contoh tampilan").

## Maksud

Beranda publik sesuai `docs/ui-halaman.md` dan mockup `Main.dc.html`/`BerandaHP.dc.html`, berjalan dengan adapter Cloudflare, cepat (Lighthouse ≥ 90) dan bisa di-cache CDN.

## Tujuan

- Adapter `@astrojs/cloudflare`; beranda di-prerender (statis) dan disajikan dari CDN.
- Bagian beranda berurutan: hero + form cari, 3 poin kepercayaan, 8 bidang K3, jadwal terdekat (4 kartu, label "Contoh tampilan"), chip kota, cara kerja 3 langkah, "Kenali PusatK3" (video), ajakan penyedia, footer.
- Header keamanan (CSP dengan hash dari Astro, nosniff, HSTS, frame-ancestors/X-Frame-Options, Referrer-Policy) dan header cache untuk halaman publik.
- SEO: title, description, canonical, Open Graph, JSON-LD `Organization` + `WebSite` (+ `VideoObject` bila URL video ada).
- `/internal/komponen` hanya di mode dev.

## Bukan tujuan

SSR + Cache API untuk data dinamis (Fase 1, dicatat di ADR), halaman `/cari` dan lainnya, i18n, React (ditunda ke Fase 2 saat dashboard dibuat; issue menyebut React — dilaporkan di PR), deploy (#7/#8).

## Keputusan

- Jadwal contoh (opsi A pemilik): tampil dengan label "Contoh tampilan"; beranda tidak dirilis ke production sebelum data asli (gerbang rilis pemilik).
- Video tidak di-bundle (`brand/video/README.md`): URL dari `PUBLIC_MEDIA_BASE_URL`; tanpa URL → poster + transkrip saja, tanpa tombol putar dan tanpa `VideoObject`. Poster (60 KB) boleh di `public/`.
- 8 bidang + jumlah sertifikasi: data statis di web dari `docs/kategori-k3.md` (Fase 1 → API `/categories`).
