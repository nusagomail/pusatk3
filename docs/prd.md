# PRD: PusatK3

Status: draf v0.1 (25 November 2026). Sumber: laporan brainstorming dan mockup website.

## Masalah

Penyedia pelatihan & sertifikasi K3 (PJK3, LSP, TUK) banyak, tetapi informasinya tersebar di proposal PDF, website sendiri, dan WhatsApp. Peserta (individu dan HR perusahaan) sulit menemukan lokasi, jadwal, harga, dan legalitas penyedia di kota mereka.

## Posisi produk

PusatK3 adalah **direktori independen** dan tempat bertemu. Bukan situs pemerintah, bukan penyelenggara pelatihan, bukan penerbit sertifikat, dan tidak memproses transaksi pelatihan.

## Pengguna & peran

| Peran | Kebutuhan utama |
| --- | --- |
| Pengunjung (tanpa login) | Cari pelatihan, lihat jadwal, legalitas, kontak penyedia |
| User terdaftar | Simpan jadwal, riwayat pertanyaan, e-course, pengingat sertifikat, mode perusahaan (HR) |
| Penyedia (owner, admin, staf) | Klaim profil, verifikasi, kelola profil/cabang/jadwal, terima lead, statistik, langganan, website instan |
| Admin PusatK3 (super admin, kurator, moderator, support) | Kurasi data, verifikasi, moderasi ulasan, "lihat sebagai" dengan log audit |

## Prinsip yang tidak boleh dilanggar

1. User selalu gratis; pendapatan hanya dari langganan penyedia.
2. Klaim profil dan badge verifikasi gratis; badge tidak dijual.
3. Hasil organik terpisah dari slot sponsor; sponsor selalu berlabel.
4. Informasi publik (pencarian, jadwal, kontak) tidak memerlukan login.
5. Platform tidak ikut negosiasi atau pembayaran pelatihan.

## Fitur per area

### Publik
- Pencarian: jenis pelatihan, kota, online/offline, penerbit (Kemnaker, BNSP/LSP, PUPR/LPJK, ESDM, internasional; lihat `docs/kategori-k3.md`), tanggal, harga. Tahan salah ketik dan paham sinonim (lihat glosarium).
- Halaman: beranda, hasil pencarian, detail jadwal, profil penyedia, halaman SEO kota × jenis pelatihan, e-course, Untuk Penyedia, pusat bantuan, halaman legal.
- Kontak penyedia: tombol WhatsApp dan form pertanyaan; setiap klik/kiriman dicatat sebagai lead.

### Penyedia
- Klaim profil + verifikasi legalitas (izin PJK3, lisensi LSP/TUK, verifikasi nomor kantor).
- Edit profil, cabang, foto, kontak; kelola jadwal; inbox lead; statistik.
- Tim multi-user (owner/admin/staf), alih kepemilikan.
- Paket Gratis (≤3 jadwal aktif), Pro, Bisnis. Website instan: subdomain (Pro), custom domain (Bisnis).
- Jadwal yang lewat tanggal otomatis disembunyikan; penyedia yang rajin update mendapat posisi lebih baik.

### User
- Jadwal tersimpan, riwayat pertanyaan, progres e-course.
- Pengingat sertifikat: user mencatat sendiri nama dan masa berlaku; tanpa unggah scan. Bukan prioritas MVP.
- Mode perusahaan (HR) untuk banyak karyawan (fase lanjut).
- Edit profil, notifikasi, hapus akun.

### Admin
- Antrean verifikasi klaim, moderasi ulasan, kurasi data, statistik platform, log audit.

## Di luar cakupan
- Pembayaran pelatihan, penerbitan sertifikat, penyimpanan dokumen sertifikat user, marketplace komisi.

## Metrik keberhasilan awal
- Jumlah profil diklaim dan terverifikasi
- Lead per bulan per penyedia
- Persentase jadwal yang masih berlaku (data segar)
- Konversi Gratis → Pro

## Pertanyaan terbuka
- Segmen utama: individu atau HR perusahaan?
- Validasi harga paket Pro dan Bisnis (draf ada di docs/bisnis.md).
- Wilayah prioritas kurasi data.
