# Panduan kurasi data penyedia asli

Untuk tim yang mengumpulkan data penyedia pelatihan K3 sungguhan. Data ini menggantikan data contoh. Format lengkap tiap kolom ada di [`README.md`](README.md).

## 1. Siapkan file

1. Salin folder [`template/`](template) (empat file CSV berisi baris judul saja) ke folder kerja, mis. `data-asli/jabodetabek/`. Folder `data-asli/` diabaikan git (tidak ikut ter-commit); **jangan** memindahkannya ke folder lain di dalam proyek sebelum disetujui pemilik.
2. Isi dengan spreadsheet (Google Sheets atau Excel), lalu **unduh sebagai CSV (UTF-8)**. Jangan ubah baris judul.
3. Satu wilayah per folder supaya mudah ditinjau.

## 2. Dari mana datanya

Gunakan hanya **data publik usaha**:
- **PJK3:** daftar PJK3 resmi Kemnaker (situs Kemnaker / SIAP K3) dan situs resmi penyedia.
- **LSP:** daftar LSP berlisensi di situs BNSP.
- **TUK:** situs LSP yang menaunginya.
- **Jadwal:** situs resmi atau brosur publik penyedia.

Catat **sumber setiap penyedia** (alamat situs/dokumen dan tanggal diambil) di file terpisah `sumber.md` di folder yang sama. File ini tidak diimpor dan tidak tampil di situs; gunanya untuk pertanggungjawaban asal data. **Jangan** menulis sumber di kolom `deskripsi`, karena kolom itu tampil di halaman publik.

Jangan menebak. Kolom yang tidak diketahui dikosongkan (kecuali kolom wajib).

## 3. Aturan isi

- **Data pribadi minimal (UU PDP):**
  - Hanya kontak usaha yang **dicantumkan resmi oleh badan usaha** di situs atau brosurnya (WhatsApp/telepon kantor, email kantor). Nomor "marketing" yang jelas milik perorangan tetap data pribadi: jangan dipakai.
  - Jangan menyalin nama orang (direktur, Ahli K3, asesor) walaupun tercantum di daftar Kemnaker/BNSP.
  - Penyedia bisa meminta koreksi atau penghapusan datanya lewat kontak PusatK3; permintaan itu diteruskan ke pemilik dan diproses sebelum impor berikutnya.
- **Kota:** `kota_slug` harus ada di [`kota.csv`](kota.csv). Satu slug mewakili satu wilayah kota/kabupaten, termasuk kota dan kabupaten bernama sama (mis. Cikarang → `bekasi`, Cibinong → `bogor`, Timika → `timika`). Kota yang belum ada, minta ditambahkan lewat developer (satu baris: slug, nama, provinsi).
- **Kategori:** `kategori_slug` dari [`kategori-k3.csv`](kategori-k3.csv) (59 kategori resmi).
- **Legalitas:** nomor izin/lisensi persis seperti di dokumen publik. Badge "Terverifikasi" **tidak** diberikan lewat impor; itu hanya lewat verifikasi kurator setelah penyedia klaim profil, dan tidak pernah terkait pembayaran (aturan 5 CLAUDE.md, prinsip PRD).
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

Kirim folder yang sudah lolos cek (beserta `sumber.md`) ke pemilik untuk ditinjau. Data asli **akan** diimpor ke production lewat pipeline rilis setelah disetujui pemilik; langkah impor production itu belum dibuat dan disiapkan bersama rilis production (ADR 0017).
