# Spesifikasi halaman (dari mockup)

Mockup dibuat di kanvas desain Claude (private milik pemilik). Sumber markup tiap artboard disalin ke `docs/mockup/` sebagai **referensi tata letak dan gaya** — file itu memakai runtime kanvas, jadi tidak bisa dijalankan apa adanya. Bangun ulang dengan Astro + komponen sesuai `docs/design-tokens.md`. Data di mockup (`[Nama PJK3]`, `[Harga]`, `[N]`) adalah placeholder.

## Prinsip

- Pencarian di depan; kepercayaan terlihat (badge, penerbit sertifikat, tanggal jelas, label Sponsor).
- Mobile-first; tombol kontak menempel di bawah layar HP.
- Oranye hanya untuk aksi utama; teks di atasnya navy.
- Footer selalu memuat: "Direktori independen, bukan situs pemerintah".

## Halaman publik

| Halaman | Rute | Isi | Referensi |
| --- | --- | --- | --- |
| Beranda | `/` | Header (logo, nav, mode gelap, ID·EN, Masuk); hero navy + form cari (pelatihan, kota, tombol Cari); 3 poin kepercayaan; 8 bidang K3 (dari 14, lihat `docs/kategori-k3.md`); jadwal terdekat (4 kartu); chip kota; cara kerja 3 langkah; video intro "Kenali PusatK3" (poster + tombol putar, tanpa autoplay, lihat `brand/video/README.md`); ajakan penyedia; footer 4 kolom | `Main.dc.html`, `BerandaGelap.dc.html`, `BerandaHP.dc.html` |
| Hasil pencarian | `/cari`, `/pelatihan/[kategori]/[kota]` | Breadcrumb; H1 "Pelatihan X di Kota"; filter samping (penerbit, metode, bulan, harga, hanya terverifikasi); urutkan; kartu jadwal (blok tanggal, pill penerbit/metode, penyedia + badge, lokasi, harga, Lihat detail); slot Sponsor berlabel; catatan cara pengurutan; FAQ | `Hasil.dc.html` |
| Detail jadwal | `/jadwal/[id]` | Pill, judul, penyedia + badge; kotak info (tanggal, lokasi, penerbit, kuota); tentang, syarat, yang didapat; legalitas penyedia; kartu kontak (harga, WhatsApp, Kirim pertanyaan, Simpan, catatan "PusatK3 tidak memproses transaksi"); jadwal lain penyedia. HP: bar bawah Tanya + Chat WhatsApp | `Pelatihan.dc.html`, `PelatihanHP.dc.html` |
| Profil penyedia | `/penyedia/[slug]` | Kepala profil (logo, nama, badge, jenis, kota/cabang, deskripsi, WhatsApp, Minta penawaran in-house); tab Jadwal/Legalitas/Cabang/Ulasan; ulasan peserta terverifikasi + balasan penyedia; tautan "Klaim atau koreksi profil" | `Profil.dc.html` |
| Untuk Penyedia | `/untuk-penyedia` | Hero, 3 manfaat, 3 langkah klaim, 3 paket (Pro disorot, "Coba gratis 14 hari"), FAQ penyedia | `Penyedia.dc.html` |
| E-course | `/belajar`, `/belajar/[kursus]/[pelajaran]` | Filter topik, grid kursus, banner "bukan sertifikasi resmi"; halaman pelajaran: video, ringkasan, "ditinjau oleh", daftar isi + progres, ajakan sertifikasi | `Ecourse.dc.html`, `Pelajaran.dc.html` |
| Masuk | `/masuk` | Langkah 1: Google atau email → kirim kode; langkah 2: 6 kotak OTP, kirim ulang, catatan 2FA penyedia. Tanpa password | `Masuk.dc.html` |

## Dashboard

| Halaman | Rute | Isi | Referensi |
| --- | --- | --- | --- |
| Penyedia — Ringkasan | `/dasbor/penyedia` | Menu samping; peringatan jadwal lewat; 4 kartu angka; tabel lead terbaru + status; ajakan upgrade saat kuota penuh; kelengkapan profil | `Dashboard.dc.html` |
| Penyedia — Profil & cabang | `/dasbor/penyedia/profil` | Tab profil umum/kontak/legalitas/cabang/foto; peringatan verifikasi ulang; bar simpan menempel | `EditProfil.dc.html` |
| Penyedia — Pengaturan akun | `/dasbor/penyedia/pengaturan` | Cara masuk, 2FA, perangkat, tim & kepemilikan, notifikasi lead, tutup profil | `Keamanan.dc.html` |
| User — Ringkasan | `/akun` | Pengingat sertifikat (dicatat sendiri), jadwal tersimpan, lanjutkan belajar, ajakan mode perusahaan | `Akun.dc.html` |

## Belum ada mockup

Jadwal & lead penyedia (halaman penuh), langganan & tagihan, admin, pusat bantuan, halaman legal. Ikuti pola dashboard yang sudah ada.
