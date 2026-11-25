# Design tokens

Sumber: panduan merek konsep Simpul dan mockup website PusatK3.

## Warna

| Token | Terang | Gelap | Pakai untuk |
| --- | --- | --- | --- |
| `--color-accent` | `#E07400` | `#F28C1B` | Tombol utama, titik pusat logo, aksen (latar, **bukan teks**: kontras teks < 4.5:1) |
| `--color-accent-text` | `#A85600` | `#F5A04A` | Teks/tautan oranye di atas latar terang/gelap |
| `--color-accent-soft` | `#FDF0E3` | `#33220F` | Latar pill dan sorotan oranye |
| `--color-on-accent` | `#0F1B2D` | `#0B1422` | Teks di atas oranye (jangan putih) |
| `--color-ink` | `#0F1B2D` | `#E8EDF4` | Teks utama |
| `--color-ink-muted` | `#3D4757` | `#C9D1DC` | Teks pendukung |
| `--color-ink-subtle` | `#5B6577` | `#A9B4C4` | Label kecil |
| `--color-bg` | `#FFFFFF` | `#0B1422` | Latar halaman |
| `--color-surface` | `#F5F6F8` | `#121E31` | Panel, kartu |
| `--color-border` | `#E3E6EB` | `#24324A` | Garis |
| `--color-hero` | `#0F1B2D` | `#13213A` | Hero, footer |
| `--color-on-hero` | `#FFFFFF` | `#FFFFFF` | Teks utama di atas hero/footer |
| `--color-on-hero-muted` | `#C9D1DC` | `#C9D1DC` | Teks pendukung di atas hero/footer |
| `--color-success` | `#0B6B3A` | `#2FB36B` | Badge terverifikasi |
| `--color-warning-bg` | `#FFF7E8` | `#2B2212` | Peringatan |
| `--color-danger` | `#B42318` | `#F97066` | Aksi berbahaya |
| `--color-whatsapp` | `#25D366` | `#25D366` | Tombol WhatsApp (teks navy) |

Kontras setiap pasangan teks/latar di atas dihitung otomatis oleh tes (`apps/web/test/tokens.test.ts`) dan wajib ≥ 4.5:1. Token `accent-text`, `accent-soft`, `on-hero`, `on-hero-muted`, serta nilai gelap `warning-bg`/`danger` ditambahkan 25 Nov 2026 (#6) dari mockup; `#B85F00` di mockup diganti `#A85600` karena kontrasnya 4.49:1.

## Huruf

Plus Jakarta Sans (disimpan sendiri lewat `@fontsource-variable/plus-jakarta-sans`, tanpa permintaan ke Google): 800 logo/judul, 700 subjudul/tombol, 600 navigasi, 500 isi.

| Peran | Ukuran |
| --- | --- |
| H1 halaman | 32–48 px |
| H2 bagian | 24–28 px |
| Isi | 15–16 px |
| Label | 12–13 px |

## Bentuk

- Radius: tombol 10–12 px, kartu 14–16 px, pill 999 px
- Target sentuh minimum 44 px
- Kontras teks minimum 4.5:1

## Logo

- Di logo: `pusatk3` (huruf kecil). Di teks: `PusatK3`.
- Titik pusat selalu oranye; simpul navy di latar terang, putih di latar gelap.
- Ikon di bawah 32 px memakai versi garis lebih tebal.
