# Model bisnis (ringkasan brainstorming)

Sumber: laporan brainstorming 24–25 November 2026. Dokumen ini konteks untuk keputusan produk; aturan yang mengikat ada di `docs/prd.md`.

## Posisi

PusatK3 adalah penghasil lead: tempat bertemu peserta dan penyedia pelatihan & sertifikasi K3. Tidak ikut negosiasi dan pembayaran pelatihan. Cakupan nasional sejak awal; kurasi data diprioritaskan ke kawasan industri.

## Pendapatan

Hanya dari langganan penyedia. User selalu gratis.

| Paket | Isi | Website |
| --- | --- | --- |
| Gratis | Klaim profil, badge legalitas, sampai 3 jadwal aktif | Halaman profil di direktori |
| Pro | Jadwal tanpa batas, slot sponsor di kota/kategori, statistik lead, inbox, coba gratis 14 hari | Mini-website di subdomain |
| Bisnis | Multi-cabang, multi-user, permintaan penawaran in-house, profil instruktur, slot e-course | Website dengan custom domain |

### Harga (sementara, 25 November 2026 — divalidasi lewat wawancara 10–20 PJK3 sebelum Fase 4)

| Paket | Bulanan | Tahunan | Balik modal bagi penyedia |
| --- | --- | --- | --- |
| Gratis | Rp0 | Rp0 | — |
| Pro | Rp349.000 | Rp3.490.000 (gratis 2 bulan) | ±1 peserta pelatihan operator per tahun |
| Bisnis | Rp999.000 | Rp9.990.000 (gratis 2 bulan) | ±2–3 peserta per tahun |

- Harga belum termasuk pajak; perlakuan PPN dikonfirmasi ke konsultan pajak.
- Custom domain hanya untuk Bisnis tahunan.
- Slot sponsor (kota × kategori, per bulan) dijual terpisah; harga ditetapkan setelah ada data trafik.
- Program **Mitra Pendiri**: 100 penyedia berbayar pertama mendapat diskon 50% tahun pertama, harga terkunci.
- Coba gratis Pro 14 hari.

Dasar: harga pelatihan berbayar per peserta umumnya jutaan rupiah (mis. operator alat berat ±Rp6 juta; crane/forklift ±Rp3,7–4 juta pada penawaran 2019). Pembanding: paket agen Rumah123 Rp2,6–5,6 juta/tahun; aplikasi bisnis UMKM (Majoo) Rp249 ribu–999 ribu/bulan.

Simulasi pendapatan bulanan: 100 Pro + 20 Bisnis ≈ Rp55 juta; 300 Pro + 50 Bisnis ≈ Rp155 juta.

### Model keuangan v2 (25 Nov 2026)

File: `docs/model/PusatK3-Model-Keuangan-2027-2031.xlsx` (semua asumsi di sheet Asumsi, 3 skenario berdampingan).

| Skenario dasar | 2027 | 2028 | 2029 | 2030 | 2031 |
| --- | --- | --- | --- | --- | --- |
| Penyedia berbayar (akhir th) | 38 | 192 | 384 | 553 | 685 |
| Pendapatan (Rp juta) | 20 | 569 | 2.188 | 3.950 | 5.606 |
| EBITDA (Rp juta) | −1.080 | −1.779 | −823 | −464 | +510 |

- EBITDA positif berkelanjutan Jan 2031 (optimis Jun 2029; konservatif belum, perlu rem biaya).
- Total kas terbakar sebelum impas ±Rp4,15 M. Usulan: pre-seed Rp3,5 M (Jan 2027), seed Rp5 M (Jan 2029).
- Model dasar **bergantung pada** ekspansi ke penyedia jasa K3 non-pelatihan (riksa uji, audit, konsultan) mulai 2029 dan slot sponsor; tanpa salah satunya 2031 masih rugi.
- Semesta penyedia ±2.990 (pelatihan ±1.790 + jasa K3 ±1.200), SAM ±2.090.

Di kode, harga disimpan di tabel `plans` (bukan hard-coded) agar bisa diubah tanpa deploy.

Website instan: hanya untuk penyedia terverifikasi; custom domain dipertimbangkan dengan langganan tahunan; saat berhenti berlangganan ada masa tenggang 14–30 hari, lalu domain diarahkan ke profil gratis.

## Mesin trafik

1. Halaman direktori kota × jenis pelatihan (pencarian berniat tinggi).
2. GEO: data terstruktur, halaman mudah dikutip, data orisinal (mis. kisaran biaya per kota).
3. E-course gratis dan video pendek sebagai pendukung (ditinjau Ahli K3, bukan sertifikasi resmi).

Alur nilai: konten & direktori → trafik user → lead ke penyedia → paket premium → website instan membuat penyedia bertahan dan data tetap segar.

## Konteks pasar (data publik)

- 875.641 perusahaan peserta BPJS Ketenagakerjaan (Des 2025); ±19 ribu menerapkan SMK3 (Kemnaker, Agu 2026).
- Hampir 1.000 PJK3 (pakta integritas 2025); 2.339 LSP terlisensi BNSP (Laporan BNSP 2025); 1,37 jt asesi tersertifikasi BNSP pada 2024.
- Biaya pembinaan Ahli K3 Umum di PJK3 Rp6–12 jt (Menaker, Feb 2026). Menaker (Sep 2025): sertifikasi Ahli K3 diarahkan ke LSP.
- Estimasi belanja pelatihan & sertifikasi K3 ±Rp1 T/tahun (bottom-up, lihat sheet Pasar).
- Daftar kategori: `docs/kategori-k3.md`.
- 319.224 klaim kecelakaan kerja (2025).
- Kemnaker menggratiskan pembinaan Ahli K3 Umum (2026); PJK3 butuh kanal akuisisi untuk program berbayar lain.
- Kanal pemerintah: Skillhub/Sertihub di SIAPkerja, fokus program vokasi.

## Risiko utama

| Risiko | Mitigasi |
| --- | --- |
| Kesan platform kosong | Kurasi kawasan industri dulu; halaman tipis tidak diterbitkan |
| Data basi | Insentif update, jadwal lewat disembunyikan, website instan sebagai satu sumber data |
| Kemnaker memperluas platformnya | Fokus penyedia swasta, pengalaman pencarian, alat kerja penyedia |
| Nama terdengar seperti lembaga resmi | Tagline "Direktori independen…", disclaimer "bukan situs pemerintah", gaya visual startup |
| Netralitas dipertanyakan | Badge tidak dijual, sponsor berlabel, halaman "Cara Kami Mengurutkan Hasil" |
| Ukuran pasar terbatas | Hitung target penyedia berbayar × harga sejak awal |

## Pertanyaan terbuka

- Segmen utama: individu atau HR perusahaan?
- Validasi harga paket Pro dan Bisnis lewat wawancara penyedia
- Wilayah prioritas kurasi
- Pendiri tunggal atau co-founder dari dunia K3
