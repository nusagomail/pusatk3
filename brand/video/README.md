# Video intro PusatK3

Video perkenalan situs untuk beranda (`/`). Disetujui pemilik pada 25 November 2026.

| File | Isi |
| --- | --- |
| `pusatk3-intro.mp4` | 1920×1080, 30 fps, H.264 + AAC, 1 menit 21 detik, ±5,4 MB. Narasi (ElevenLabs) + musik latar orisinal (bebas hak cipta). |
| `pusatk3-intro-poster.jpg` | Gambar sampul (frame penutup: logo + "Gratis untuk peserta, selamanya"). |
| `pusatk3-intro.id.vtt` | Teks terjemahan/subtitle bahasa Indonesia (WebVTT). |
| `narasi.md` | Naskah narasi versi tampilan. |

## Penempatan di beranda

- Tempatkan sebagai bagian **"Kenali PusatK3"** setelah bagian "Cara kerja 3 langkah" (lihat `docs/ui-halaman.md`), bukan di hero, agar LCP tetap cepat.
- Tampilkan sebagai kartu video dengan **poster + tombol putar**. Video **tidak autoplay** karena berisi narasi; diputar dengan suara saat pengguna menekan tombol.
- `<video controls preload="none" playsinline poster="…">` + `<track kind="captions" srclang="id" label="Indonesia" default>`.
- Teks di bawah video: "Kenali PusatK3 dalam 1 menit" (EN: "Meet PusatK3 in one minute").
- Tombol putar di atas oranye `#E07400` memakai ikon/teks navy `#0F1B2D` (aturan kontras di `CLAUDE.md`).
- Rasio 16:9, sudut membulat sesuai `docs/design-tokens.md`; di ponsel lebar penuh.

## Hosting

- **Jangan** memasukkan MP4 ke bundel `apps/web`. Unggah ke R2 (bucket aset publik, mis. `pusatk3-media`) atau Cloudflare Stream, lalu rujuk lewat URL CDN dengan cache panjang (`Cache-Control: public, max-age=31536000, immutable`; ganti nama file bila videonya diperbarui).
- File di folder ini adalah sumber/master; perubahan video = file baru dengan nama berversi (mis. `pusatk3-intro-v2.mp4`).

## SEO & aksesibilitas

- Tambahkan JSON-LD `VideoObject` (name, description, thumbnailUrl, uploadDate 2026-11-25, duration `PT1M21S`, contentUrl) di beranda.
- Subtitle WebVTT wajib aktif sebagai pilihan; naskah lengkap bisa ditampilkan dalam `<details>` "Baca transkrip".
- Hormati `prefers-reduced-motion`: jangan memutar otomatis atau menganimasikan pratinjau.
