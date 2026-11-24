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

Di kode, harga disimpan di tabel `plans` (bukan hard-coded) agar bisa diubah tanpa deploy.

Website instan: hanya untuk penyedia terverifikasi; custom domain dipertimbangkan dengan langganan tahunan; saat berhenti berlangganan ada masa tenggang 14–30 hari, lalu domain diarahkan ke profil gratis.

## Mesin trafik

1. Halaman direktori kota × jenis pelatihan (pencarian berniat tinggi).
2. GEO: data terstruktur, halaman mudah dikutip, data orisinal (mis. kisaran biaya per kota).
3. E-course gratis dan video pendek sebagai pendukung (ditinjau Ahli K3, bukan sertifikasi resmi).

Alur nilai: konten & direktori → trafik user → lead ke penyedia → paket premium → website instan membuat penyedia bertahan dan data tetap segar.

## Konteks pasar (data publik)

- 875.641 perusahaan peserta BPJS Ketenagakerjaan (Des 2025).
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
