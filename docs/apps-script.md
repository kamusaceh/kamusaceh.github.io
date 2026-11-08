# Server Google Apps Script (`Code.gs`)

Catatan referensi untuk server Kamus Aceh. Dokumen ini hanya pengetahuan; kode lengkapnya ada di [`Code.gs`](../Code.gs) dan tidak perlu diubah dari sini.

## Gambaran

- Database: Google Spreadsheet hasil unggah `kamus_aceh_database_A-0015_batch.xlsx`.
- Server: aplikasi web Apps Script (Jalankan sebagai: Saya, Akses: Siapa saja).
- Frontend memanggil satu URL `/exec` yang sama untuk data, login, dan penyuntingan. URL itu diatur di `config.js` (`KAMUS_API`).
- Setiap kode diubah: Terapkan > Kelola deployment > Edit > Versi baru.

## Sheet yang dipakai

| Sheet | Fungsi |
|---|---|
| `Entri` | Data kata (sumber utama, kolom wajib lihat di bawah) |
| `Aktivitas` | Log aksi: waktu, username, jenis, id_kata, detail, id_revisi |
| `Riwayat` | Revisi: id_revisi, waktu, username, id_kata, aksi, ringkasan, sebelum, sesudah, membatalkan |
| `Kontributor` | Statistik per pengguna (kata, sunting, verif, streak, poin; berisi rumus) |
| `Pengguna` | username, nama, peran, hash_sandi, garam |
| `Ringkasan`, `Riwayat_Perkata` | Berisi rumus; dibuat otomatis oleh menu "Siapkan sheet" |

Kolom wajib di `Entri`: `id, huruf, kata_kepala, homonim, varian, jenis_entri, tipe_kata, arti_indonesia, rujukan, status_qc, kunci_cari, sumber, metode_input, waktu_input, dibuat_oleh, waktu_update, diubah_oleh, diverifikasi_oleh, waktu_verifikasi`, ditambah `contoh_1..25` dan `arti_1..25`.

## API

Semua POST dikirim sebagai teks JSON (`Content-Type: text/plain`).

| Metode | Aksi | Hasil |
|---|---|---|
| GET | `?aksi=data` | `{ok, entri:[...], riwayat:{id:[...]}}` |
| GET | `?aksi=kontributor` | `{ok, kontributor:[{username,n,r,j,kata,sunting,verif,streak,poin}]}` |
| GET | `?aksi=ping` | `{ok, waktu}` |
| POST | `login` (`user`, `pass`) | `{ok, token, nama, peran}` |
| POST | `keluar` (`token`) | `{ok}` |
| POST | `tambah_kata` (`token`, `data`) | `{ok, id, pesan}` |
| POST | `sunting_kata` (`token`, `id`, `data`) | `{ok, pesan}` |
| POST | `hapus_kata` (`token`, `id`) | `{ok, pesan}` |
| POST | `verifikasi_kata` (`token`, `id`) | `{ok, pesan}` |
| POST | `batalkan_revisi` (`token`, `id_revisi`) | `{ok, pesan}` |

Bentuk ringkas entri pada `?aksi=data`: `id, w` (kata), `H` (huruf), `j` (jenis), `c` (kelas), `d` (arti), `x` (contoh `[{e,t}]`), `r` (rujukan), `v` (varian), `h` (homonim), `p` (halaman), `k` (kunci cari), `q` (status QC).

## Peran dan izin

| Peran | Izin |
|---|---|
| `admin`, `penyunting` | tambah, sunting, hapus, verif, batalkan |
| `kontributor`, `impor` | tambah, sunting |
| `tamu` | tidak ada |

## Aturan penting

- Sesi: token UUID di `CacheService`, berlaku 6 jam (`SESI_DETIK = 21600`).
- Login: 5 kali gagal berturut-turut memblokir pengguna itu 10 menit.
- Sandi: SHA-256 dengan garam per pengguna (`hash(garam, sandi)`); menu minimal 8 karakter.
- Validasi (`bersih`): isian maksimal 2000 karakter; `jenis_entri` salah satu dari `kata, rujukan, bunyi, nama_diri`; `tipe_kata` salah satu dari `n, v, a, adv, pron, num, konj, prep, intj, part` atau kosong; `homonim` berupa angka 1 sampai 2 digit; wajib ada arti atau rujukan.
- Kata baru dari web: id `A-WEB-<yyMMddHHmmss><2 digit>`, `status_qc = perlu_verifikasi`, `sumber = WEB`, `metode_input = FORM`.
- Verifikasi menghapus `perlu_verifikasi` dari `status_qc`, lalu mengisi `diverifikasi_oleh` dan `waktu_verifikasi`.
- Setiap tambah/sunting/hapus/verif dicatat di `Riwayat` (dengan snapshot sebelum dan sesudah) dan `Aktivitas`. `batalkan_revisi` memulihkan snapshot lama (revisi pembatalan sendiri tidak bisa dibatalkan).
- Penulisan memakai `LockService` agar tidak bentrok.

## Menu spreadsheet

`Kamus Aceh` > Siapkan sheet (`siapkanSheet()`, aman diulang), Tambah pengguna, Ubah sandi pengguna.

## Hubungan dengan bagian lain repo

- `alat/bangun.py` membaca xlsx yang sama untuk membuat halaman statis `entri/<id>/`, `sitemap.xml`, dan `robots.txt`. Perubahan lewat web hanya masuk ke Spreadsheet, jadi xlsx di repo perlu diekspor ulang sebelum menjalankan skrip itu.
