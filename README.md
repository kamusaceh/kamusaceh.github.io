# Kamus Aceh

Kamus Aceh adalah situs kamus daring berbahasa Aceh–Indonesia yang dibuat untuk membantu pencarian makna kata, kelas kata, contoh kalimat, dan informasi tambahan tentang istilah dalam bahasa Aceh.

Proyek ini dipublikasikan melalui GitHub Pages dan dirancang sebagai situs statis yang dapat dikembangkan bersama komunitas.

## Fitur utama

- Pencarian kata dengan saran otomatis saat mengetik
- Tampilan daftar kata berdasarkan huruf awal
- Halaman entri kata yang menampilkan arti, contoh kalimat, dan rincian
- Tampilan kontributor dan riwayat suntingan
- Tema terang/gelap
- Dukungan untuk kontribusi kata melalui form lokal dan integrasi API bila tersedia

## Struktur proyek

- `index.html` — halaman beranda kamus
- `entri/index.html` — halaman detail satu kata
- `kontributor/index.html` — halaman komunitas kontributor
- `huruf/index.html` — halaman daftar kata per huruf (`/huruf/a` sampai `/huruf/z`, dan `/huruf/` untuk semua); alamat per huruf dilayani lewat `404.html`
- `config.js` — konfigurasi aplikasi, termasuk URL data dan endpoint API
- `favicon.svg` — ikon situs
- `og.png` — gambar pratinjau sosial
- `robots.txt` dan `sitemap.xml` — metadata SEO
- `docs/` — dokumen pendukung
- `db/` dan `backup/` — data pendukung dan cadangan
- `alat/`, `pdf/`, `profil/`, `riwayat/` — modul pendukung proyek

## Teknologi

- HTML
- CSS
- JavaScript
- GitHub Pages untuk hosting

## Menjalankan secara lokal

Karena proyek ini adalah situs statis, Anda dapat membukanya langsung di browser dari folder proyek, atau menjalankannya dengan server statis sederhana seperti:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000
```

## Konfigurasi data

File `config.js` digunakan untuk mengatur sumber data aplikasi. Jika Anda ingin menghubungkan ke API atau spreadsheet, sesuaikan URL di file tersebut sesuai kebutuhan proyek.

## Kontribusi

Kontribusi sangat terbuka untuk pengembangan situs, data kamus, perbaikan UI, serta dokumentasi. Jika Anda ingin menambahkan kata atau memperbaiki konten, gunakan mekanisme yang tersedia di halaman web atau hubungi pengelola proyek.

## Lisensi

Hak cipta proyek dilindungi sesuai ketentuan yang berlaku. Silakan cek detail lisensi yang ditetapkan oleh pemilik proyek sebelum menggunakan konten secara luas.

## Tautan

- Website: https://kamusaceh.github.io/
- Repository: https://github.com/kamusaceh/kamusaceh.github.io

