# Panduan kurasi data penyedia asli

Untuk tim yang mengumpulkan data penyedia pelatihan K3 sungguhan. Data ini menggantikan data contoh. Format lengkap tiap kolom ada di [`README.md`](README.md).

## 1. Siapkan file

1. Salin folder [`template/`](template) (empat file CSV berisi baris judul saja) ke folder kerja, mis. `data-asli/jabodetabek/`.
2. Isi dengan spreadsheet (Google Sheets atau Excel), lalu **unduh sebagai CSV (UTF-8)**. Jangan ubah baris judul.
3. Satu wilayah per folder supaya mudah ditinjau.

## 2. Dari mana datanya

Gunakan hanya **data publik usaha**:
- **PJK3:** daftar PJK3 resmi Kemnaker (situs Kemnaker / SIAP K3) dan situs resmi penyedia.
- **LSP:** daftar LSP berlisensi di situs BNSP.
- **TUK:** situs LSP yang menaunginya.
- **Jadwal:** situs resmi atau brosur publik penyedia. Catat sumbernya di kolom deskripsi bila perlu.

Jangan menebak. Kolom yang tidak diketahui dikosongkan (kecuali kolom wajib).

## 3. Aturan isi

- **Data pribadi minimal (UU PDP):** hanya kontak usaha (nomor WhatsApp atau telepon kantor, email kantor). Jangan memasukkan nomor HP pribadi karyawan atau nama orang.
- **Kota:** `kota_slug` harus ada di [`kota.csv`](kota.csv). Kota yang belum ada, minta ditambahkan lewat developer (satu baris: slug, nama, provinsi).
- **Kategori:** `kategori_slug` dari [`kategori-k3.csv`](kategori-k3.csv) (59 kategori resmi).
- **Legalitas:** nomor izin/lisensi persis seperti di dokumen publik. Badge "Terverifikasi" **tidak** diberikan lewat impor; itu hanya lewat verifikasi kurator setelah penyedia klaim profil (aturan 5).
- **Jadwal:** hanya yang tanggalnya belum lewat, status `published`. Harga dalam rupiah tanpa "Rp" (boleh pakai titik ribuan).
- Jangan menulis "Contoh" di nama atau judul data asli.

## 4. Cek sebelum diserahkan

Dari folder proyek, jalankan:

```
pnpm data:check data-asli/jabodetabek
```

- **Berhasil:** muncul jumlah penyedia, cabang, legalitas, dan jadwal; tidak ada yang ditulis ke database.
- **Gagal:** muncul daftar masalah per file dan nomor baris (mis. `cabang.csv baris 3: kota_slug "xyz" tidak dikenal`). Perbaiki lalu cek lagi.

## 5. Serahkan

Kirim folder yang sudah lolos cek ke pemilik untuk ditinjau. Data asli baru diimpor ke production lewat pipeline rilis, setelah disetujui pemilik (ADR 0017).
