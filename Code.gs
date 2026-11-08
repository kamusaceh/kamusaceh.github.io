/**
 * KAMUS ACEH – server Google Apps Script (lengkap)
 * Database: Google Spreadsheet hasil unggah kamus_aceh_database_A-0015_batch.xlsx
 * Sheet yang dipakai: Entri, Aktivitas, Riwayat, Kontributor, Pengguna
 * (Ringkasan dan Riwayat_Perkata berisi rumus; dibuat otomatis oleh menu "Siapkan sheet").
 *
 * PASANG
 * 1. Unggah xlsx ke Google Drive > buka dengan Google Sheets > Berkas > Simpan sebagai Google Sheets.
 * 2. Ekstensi > Apps Script > tempel seluruh berkas ini > simpan > jalankan fungsi siapkanSheet() sekali (beri izin).
 * 3. Muat ulang spreadsheet. Menu "Kamus Aceh" muncul: Tambah pengguna / Ubah sandi / Siapkan sheet.
 * 4. Terapkan > Deployment baru > Aplikasi web. Jalankan sebagai: Saya. Akses: Siapa saja.
 * 5. Salin URL yang berakhiran /exec ke KAMUS_CONFIG di entri.html:
 *      loginUrl, addWordUrl, dataUrl  (ketiganya URL yang sama)
 * Setiap mengubah kode: Terapkan > Kelola deployment > Edit > Versi baru.
 *
 * API (semua POST dikirim sebagai teks JSON, Content-Type text/plain):
 *   GET  ?aksi=data         -> {ok, entri:[...], riwayat:{id:[...]}}     (format langsung dipakai halaman web)
 *   GET  ?aksi=kontributor  -> {ok, kontributor:[{username,n,r,j,kata,sunting,verif,streak,poin}]}
 *   POST {aksi:"login", user, pass}                  -> {ok, token, nama, peran}
 *   POST {aksi:"keluar", token}
 *   POST {aksi:"tambah_kata",   token, data}
 *   POST {aksi:"sunting_kata",  token, id, data}
 *   POST {aksi:"hapus_kata",    token, id}
 *   POST {aksi:"verifikasi_kata", token, id}
 *   POST {aksi:"batalkan_revisi", token, id_revisi}
 */

var CFG = {
  ZONA: 'Asia/Jakarta',
  SESI_DETIK: 21600,      // masa berlaku token: 6 jam
  GAGAL_MAKS: 5,          // gagal login berturut-turut sebelum diblokir 10 menit
  PANJANG_MAKS: 2000,     // batas panjang tiap isian
  MAKS_RIWAYAT: 1000,     // baris Riwayat yang dibaca rumus bantu
  MAKS_PERKATA: 20        // kolom riwayat_N di Riwayat_Perkata
};
var IZIN = {
  admin:       ['tambah', 'sunting', 'hapus', 'verif', 'batalkan'],
  penyunting:  ['tambah', 'sunting', 'hapus', 'verif', 'batalkan'],
  kontributor: ['tambah', 'sunting'],
  impor:       ['tambah', 'sunting'],
  tamu:        []
};
var JENIS = ['kata', 'rujukan', 'bunyi', 'nama_diri'];
var KELAS = ['', 'n', 'v', 'a', 'adv', 'pron', 'num', 'konj', 'prep', 'intj', 'part'];
var KOLOM_WAJIB = ['id', 'huruf', 'kata_kepala', 'homonim', 'varian', 'jenis_entri', 'tipe_kata', 'arti_indonesia',
  'rujukan', 'status_qc', 'kunci_cari', 'sumber', 'metode_input', 'waktu_input', 'dibuat_oleh', 'waktu_update',
  'diubah_oleh', 'diverifikasi_oleh', 'waktu_verifikasi'];
var HEAD = {
  Aktivitas:   ['waktu', 'username', 'jenis', 'id_kata', 'detail', 'id_revisi'],
  Riwayat:     ['id_revisi', 'waktu', 'username', 'id_kata', 'aksi', 'ringkasan', 'sebelum', 'sesudah', 'membatalkan'],
  Kontributor: ['username', 'nama', 'peran', 'bergabung', 'kata', 'sunting', 'verif', 'streak', 'poin'],
  Pengguna:    ['username', 'nama', 'peran', 'hash_sandi', 'garam']
};

/* ===================== utilitas ===================== */
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ss() { return SpreadsheetApp.getActive(); }
function sheet(n) { var s = ss().getSheetByName(n); if (!s) throw new Error('Sheet "' + n + '" tidak ada. Jalankan menu Kamus Aceh > Siapkan sheet.'); return s; }
function now() { return Utilities.formatDate(new Date(), CFG.ZONA, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function hex(b) { return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join(''); }
function hash(garam, sandi) { return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, garam + sandi, Utilities.Charset.UTF_8)); }
function norm(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ''); }
function lastRow(sh, col) {
  var v = sh.getRange(1, col, sh.getMaxRows(), 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (v[i][0] !== '' && v[i][0] !== null) return i + 1;
  return 1;
}
function tulis(sh, row, values) {          // tulis sebagai teks biasa (apostrof dan "=" di awal kata tidak ditafsirkan)
  var r = sh.getRange(row, 1, 1, values.length);
  r.setNumberFormat('@'); r.setValues([values]);
}
function entri() {
  var sh = sheet('Entri'), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  KOLOM_WAJIB.forEach(function (k) { if (h.indexOf(k) < 0) throw new Error('Kolom "' + k + '" tidak ada di sheet Entri.'); });
  return { sh: sh, h: h };
}
function rowObj(h, r) { var o = {}; h.forEach(function (k, i) { o[k] = (r[i] === null || r[i] === undefined) ? '' : String(r[i]); }); return o; }
function objRow(h, o) { return h.map(function (k) { return o[k] === undefined ? '' : o[k]; }); }

/* ===================== snapshot (format sheet Riwayat) ===================== */
function snapshot(d) {
  var c = [];
  for (var i = 1; i <= 25; i++) if (d['contoh_' + i] || d['arti_' + i]) c.push({ aceh: d['contoh_' + i] || '', indo: d['arti_' + i] || '' });
  return JSON.stringify({ kata: d.kata_kepala, homonim: d.homonim || '', varian: d.varian || '', jenis_entri: d.jenis_entri, kelas: d.tipe_kata,
    arti: d.arti_indonesia, rujukan: d.rujukan, contoh: c, status_qc: d.status_qc });
}
function dariSnapshot(js) {
  var s = typeof js === 'string' ? JSON.parse(js) : js, d = {
    kata_kepala: s.kata, jenis_entri: s.jenis_entri, tipe_kata: s.kelas, arti_indonesia: s.arti, rujukan: s.rujukan, status_qc: s.status_qc
  };
  if (s.homonim !== undefined) d.homonim = s.homonim;
  if (s.varian !== undefined) d.varian = s.varian;
  for (var i = 1; i <= 25; i++) { var c = (s.contoh || [])[i - 1] || {}; d['contoh_' + i] = c.aceh || ''; d['arti_' + i] = c.indo || ''; }
  return d;
}

/* ===================== validasi masukan ===================== */
function bersih(d) {
  var o = {}, s = function (v) { return String(v === undefined || v === null ? '' : v).trim().slice(0, CFG.PANJANG_MAKS); };
  ['kata_kepala', 'homonim', 'varian', 'arti_indonesia', 'rujukan'].forEach(function (k) { o[k] = s(d[k]); });
  o.jenis_entri = s(d.jenis_entri) || 'kata';
  o.tipe_kata = s(d.tipe_kata);
  if (JENIS.indexOf(o.jenis_entri) < 0) throw new Error('Jenis entri tidak dikenal.');
  if (KELAS.indexOf(o.tipe_kata) < 0) throw new Error('Kelas kata tidak dikenal.');
  if (!o.kata_kepala) throw new Error('Isi kata kepala.');
  if (!o.arti_indonesia && !o.rujukan) throw new Error('Isi arti atau rujukan.');
  if (o.homonim && !/^\d{1,2}$/.test(o.homonim)) throw new Error('Homonim harus berupa angka.');
  for (var i = 1; i <= 25; i++) { o['contoh_' + i] = s(d['contoh_' + i]); o['arti_' + i] = s(d['arti_' + i]); }
  return o;
}
function isi(h, d, baris) {                // salin isian d ke array baris (hanya kunci yang ada)
  ['kata_kepala', 'homonim', 'varian', 'jenis_entri', 'tipe_kata', 'arti_indonesia', 'rujukan', 'status_qc'].forEach(function (k) {
    if (d[k] !== undefined) baris[h.indexOf(k)] = d[k];
  });
  for (var i = 1; i <= 25; i++) {
    baris[h.indexOf('contoh_' + i)] = d['contoh_' + i] || '';
    baris[h.indexOf('arti_' + i)] = d['arti_' + i] || '';
  }
  baris[h.indexOf('kunci_cari')] = (norm(baris[h.indexOf('kata_kepala')]) + ' ' + norm(String(baris[h.indexOf('varian')] || '').replace(/;/g, ' '))).replace(/\s+/g, ' ').trim();
}
function cari(E, id) {
  var v = E.sh.getRange(1, 1, lastRow(E.sh, 1), 1).getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) return i + 1;
  return 0;
}

/* ===================== pencatatan ===================== */
function catat(sesi, aksi, id, ringkasan, sebelum, sesudah, membatalkan) {
  var t = now(), R = sheet('Riwayat'), A = sheet('Aktivitas'), n = lastRow(R, 1);
  var rid = 'R' + ('000000' + n).slice(-6);           // baris terakhir = jumlah revisi + 1 = nomor revisi berikutnya
  tulis(R, n + 1, [rid, t, sesi.u, id, aksi, ringkasan, sebelum || '', sesudah || '', membatalkan || '']);
  tulis(A, lastRow(A, 1) + 1, [t, sesi.u, aksi, id, ringkasan, rid]);
  return { t: t, rid: rid };
}
function pastikanKontributor(sesi) {
  var K = sheet('Kontributor'), n = lastRow(K, 1), v = n > 1 ? K.getRange(2, 1, n - 1, 1).getValues() : [];
  for (var i = 0; i < v.length; i++) if (v[i][0] === sesi.u) return;
  var r = n + 1, f = function (j) { return '=COUNTIFS(Aktivitas!$B:$B,$A' + r + ',Aktivitas!$C:$C,"' + j + '")'; };
  K.getRange(r, 1, 1, 9).setValues([[sesi.u, sesi.nama, sesi.peran, Utilities.formatDate(new Date(), CFG.ZONA, 'yyyy-MM-dd'),
    f('tambah'), f('sunting'), f('verif'), 0, '=E' + r + '*3+F' + r + '+G' + r + '*2']]);
}

/* ===================== operasi CRUD ===================== */
function opTambah(d, sesi) {
  d = bersih(d);
  var E = entri(), b = new Array(E.h.length).fill(''), id = 'A-WEB-' + Utilities.formatDate(new Date(), CFG.ZONA, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  d.status_qc = 'perlu_verifikasi';
  b[E.h.indexOf('id')] = id;
  b[E.h.indexOf('huruf')] = (norm(d.kata_kepala).charAt(0) || 'a').toUpperCase();
  isi(E.h, d, b);
  b[E.h.indexOf('sumber')] = 'WEB'; b[E.h.indexOf('metode_input')] = 'FORM';
  b[E.h.indexOf('waktu_input')] = now(); b[E.h.indexOf('dibuat_oleh')] = sesi.u;
  tulis(E.sh, lastRow(E.sh, 1) + 1, b);
  catat(sesi, 'tambah', id, 'Kata baru: ' + d.kata_kepala, '', snapshot(d));
  pastikanKontributor(sesi);
  return { ok: true, id: id, pesan: 'Kata ditambahkan.' };
}
function terapkanSunting(E, n, d, sesi, aksi, ringkasanAwal, membatalkan) {
  var lama = E.sh.getRange(n, 1, 1, E.h.length).getValues()[0], so = rowObj(E.h, lama), b = lama.slice();
  isi(E.h, d, b);
  var sn = rowObj(E.h, b), ubah = [];
  ['kata_kepala', 'homonim', 'varian', 'jenis_entri', 'tipe_kata', 'arti_indonesia', 'rujukan', 'status_qc'].forEach(function (k) { if (so[k] !== sn[k]) ubah.push(k.replace('_indonesia', '').replace('_kepala', '')); });
  for (var i = 1; i <= 25; i++) if (so['contoh_' + i] !== sn['contoh_' + i] || so['arti_' + i] !== sn['arti_' + i]) ubah.push('contoh ' + i);
  if (!ubah.length) return false;
  var c = catat(sesi, aksi, so.id, (ringkasanAwal || 'Mengubah ') + ubah.join(', '), snapshot(so), snapshot(sn), membatalkan);
  b[E.h.indexOf('waktu_update')] = c.t; b[E.h.indexOf('diubah_oleh')] = sesi.u;
  tulis(E.sh, n, b);
  pastikanKontributor(sesi);
  return true;
}
function opSunting(id, d, sesi) {
  var E = entri(), n = cari(E, id);
  if (!n) return { ok: false, pesan: 'Kata tidak ditemukan.' };
  return terapkanSunting(E, n, bersih(d), sesi, 'sunting') ? { ok: true, pesan: 'Perubahan tersimpan.' } : { ok: true, pesan: 'Tidak ada perubahan.' };
}
function opHapus(id, sesi, ringkasan, membatalkan) {
  var E = entri(), n = cari(E, id);
  if (!n) return { ok: false, pesan: 'Kata tidak ditemukan.' };
  var d = rowObj(E.h, E.sh.getRange(n, 1, 1, E.h.length).getValues()[0]);
  catat(sesi, 'hapus', id, ringkasan || ('Menghapus ' + d.kata_kepala), snapshot(d), '', membatalkan);
  E.sh.deleteRow(n);
  pastikanKontributor(sesi);
  return { ok: true, pesan: 'Kata dihapus.' };
}
function opVerifikasi(id, sesi) {
  var E = entri(), n = cari(E, id);
  if (!n) return { ok: false, pesan: 'Kata tidak ditemukan.' };
  var b = E.sh.getRange(n, 1, 1, E.h.length).getValues()[0], so = rowObj(E.h, b);
  var qc = String(so.status_qc).split(';').filter(function (x) { return x && x !== 'perlu_verifikasi'; }).join(';');
  var sebelum = snapshot(so); b[E.h.indexOf('status_qc')] = qc;
  var sn = rowObj(E.h, b), c = catat(sesi, 'verif', id, 'Memverifikasi ' + so.kata_kepala, sebelum, snapshot(sn));
  b[E.h.indexOf('diverifikasi_oleh')] = sesi.u; b[E.h.indexOf('waktu_verifikasi')] = c.t;
  tulis(E.sh, n, b);
  pastikanKontributor(sesi);
  return { ok: true, pesan: 'Kata terverifikasi.' };
}
function opBatalkan(idRev, sesi) {
  var R = sheet('Riwayat'), n = lastRow(R, 1);
  if (n < 2) return { ok: false, pesan: 'Riwayat kosong.' };
  var v = R.getRange(2, 1, n - 1, 9).getValues(), rev = null, sudah = false;
  v.forEach(function (r) { if (r[0] === idRev) rev = r; if (r[8] === idRev) sudah = true; });
  if (!rev) return { ok: false, pesan: 'Revisi tidak ditemukan.' };
  if (sudah) return { ok: false, pesan: 'Revisi ini sudah dibatalkan.' };
  if (rev[8]) return { ok: false, pesan: 'Revisi pembatalan tidak bisa dibatalkan; lakukan sunting biasa.' };
  var aksi = rev[4], id = rev[3], E = entri(), idx = cari(E, id), ket = 'Membatalkan ' + idRev + ': ';
  if (aksi === 'tambah') {
    if (!idx) return { ok: false, pesan: 'Kata sudah tidak ada.' };
    return opHapus(id, sesi, ket + 'kata baru dicabut', idRev);
  }
  if (!rev[6]) return { ok: false, pesan: 'Revisi ini tidak punya data sebelum.' };
  var d = dariSnapshot(rev[6]);
  if (aksi === 'hapus') {
    if (idx) return { ok: false, pesan: 'Kata sudah ada kembali.' };
    var b = new Array(E.h.length).fill('');
    b[E.h.indexOf('id')] = id; b[E.h.indexOf('huruf')] = (norm(d.kata_kepala).charAt(0) || 'a').toUpperCase();
    isi(E.h, d, b);
    b[E.h.indexOf('sumber')] = 'WEB'; b[E.h.indexOf('metode_input')] = 'PULIH'; b[E.h.indexOf('waktu_input')] = now(); b[E.h.indexOf('dibuat_oleh')] = sesi.u;
    tulis(E.sh, lastRow(E.sh, 1) + 1, b);
    catat(sesi, 'tambah', id, ket + 'kata dipulihkan', '', snapshot(rowObj(E.h, b)), idRev);
    return { ok: true, pesan: 'Kata dipulihkan.' };
  }
  if (!idx) return { ok: false, pesan: 'Kata tidak ditemukan.' };
  return terapkanSunting(E, idx, d, sesi, 'sunting', ket + 'mengembalikan ', idRev) ? { ok: true, pesan: 'Revisi dibatalkan.' } : { ok: true, pesan: 'Isi sudah sama dengan sebelum revisi.' };
}

/* ===================== login ===================== */
function opLogin(q) {
  var c = CacheService.getScriptCache(), key = 'gagal:' + String(q.user).toLowerCase(), g = Number(c.get(key) || 0);
  if (g >= CFG.GAGAL_MAKS) return { ok: false, pesan: 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.' };
  var P = sheet('Pengguna'), n = lastRow(P, 1), v = n > 1 ? P.getRange(2, 1, n - 1, 5).getValues() : [];
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).toLowerCase() === String(q.user).toLowerCase() && v[i][3] && v[i][3] !== 'HASH_CONTOH' && String(v[i][3]) === hash(String(v[i][4]), String(q.pass))) {
      var tk = Utilities.getUuid(), peran = String(v[i][2]).toLowerCase();
      c.put(tk, JSON.stringify({ u: String(v[i][0]), nama: String(v[i][1]), peran: peran }), CFG.SESI_DETIK);
      c.remove(key);
      return { ok: true, token: tk, nama: String(v[i][1]), peran: peran };
    }
  }
  c.put(key, String(g + 1), 600);
  return { ok: false, pesan: 'Nama pengguna atau kata sandi salah.' };
}

/* ===================== titik masuk web ===================== */
function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.aksi) || 'data';
    if (a === 'ping') return out({ ok: true, waktu: now() });
    if (a === 'kontributor') return out(bacaKontributor());
    if (a === 'data') return out(bacaData());
    return out({ ok: false, pesan: 'Aksi tidak dikenal.' });
  } catch (err) { return out({ ok: false, pesan: String(err.message || err) }); }
}
function bacaData() {
  var E = entri(), n = lastRow(E.sh, 1), entriList = [], riwayat = {};
  if (n > 1) E.sh.getRange(2, 1, n - 1, E.h.length).getValues().forEach(function (r) {
    if (!r[0]) return;
    var d = rowObj(E.h, r), x = [];
    for (var i = 1; i <= 25; i++) if (d['contoh_' + i] || d['arti_' + i]) x.push({ e: d['contoh_' + i], t: d['arti_' + i] });
    entriList.push({ id: d.id, w: d.kata_kepala, H: (d.huruf || norm(d.kata_kepala).charAt(0)).toUpperCase(), j: d.jenis_entri, c: d.tipe_kata, d: d.arti_indonesia,
      x: x, r: d.rujukan, v: d.varian, h: d.homonim, p: d.halaman, k: d.kunci_cari, q: d.status_qc });
  });
  var R = sheet('Riwayat'), m = lastRow(R, 1);
  if (m > 1) R.getRange(2, 1, m - 1, 9).getValues().forEach(function (r) {
    if (!r[3]) return;
    (riwayat[r[3]] = riwayat[r[3]] || []).push({ r: r[0], t: r[1], u: r[2], a: r[4], s: r[5], b: r[6] || '', x: r[7] || '', m: r[8] || '' });
  });
  return { ok: true, entri: entriList, riwayat: riwayat };
}
function bacaKontributor() {
  // Statistik dihitung langsung dari Riwayat (log permanen), bukan dari
  // rumus/angka cache pada sheet Kontributor yang bisa tertinggal atau nol.
  var profil = {}, urut = [];
  function kunci(u) { return String(u || '').trim().toLowerCase(); }
  function siapkan(u, nama, peran, bergabung, streak) {
    var key = kunci(u);
    if (!key) return null;
    if (!profil[key]) {
      profil[key] = { username: String(u).trim(), n: nama || String(u).trim(), r: peran || 'kontributor',
        j: bergabung || '', kata: 0, sunting: 0, verif: 0, streak: Number(streak) || 0 };
      urut.push(key);
    } else {
      if (nama) profil[key].n = nama;
      if (peran) profil[key].r = peran;
      if (bergabung) profil[key].j = bergabung;
      if (streak !== undefined && streak !== '') profil[key].streak = Number(streak) || 0;
    }
    return profil[key];
  }

  // Ambil identitas akun agar nama dan peran tetap konsisten.
  var P = sheet('Pengguna'), np = lastRow(P, 1);
  if (np > 1) P.getRange(2, 1, np - 1, 5).getDisplayValues().forEach(function (r) {
    if (r[0]) siapkan(r[0], r[1], r[2], '', 0);
  });

  // Pertahankan tanggal bergabung dan streak yang sudah tersimpan.
  var K = sheet('Kontributor'), nk = lastRow(K, 1);
  if (nk > 1) K.getRange(2, 1, nk - 1, 9).getDisplayValues().forEach(function (r) {
    if (r[0]) { var p = siapkan(r[0], r[1], r[2], r[3], r[7]); if (p) p.terdaftar = true; }
  });

  // Riwayat adalah sumber hitung utama: satu baris untuk setiap perubahan.
  var R = sheet('Riwayat'), nr = lastRow(R, 1);
  if (nr > 1) R.getRange(2, 1, nr - 1, 9).getValues().forEach(function (r) {
    var username = String(r[2] || '').trim();
    var aksi = String(r[4] || '').trim().toLowerCase();
    if (!username) return;
    var p = siapkan(username, username, 'kontributor', '', 0);
    p.adaAktivitas = true;
    if (aksi === 'tambah') p.kata++;
    else if (aksi === 'sunting') p.sunting++;
    else if (aksi === 'verif' || aksi === 'verifikasi') p.verif++;
  });

  var list = urut.map(function (key) {
    var p = profil[key];
    p.poin = p.kata * 3 + p.sunting + p.verif * 2;
    return p;
  }).filter(function (p) {
    // Akun tanpa kontribusi tetap ditampilkan jika sudah tercatat di sheet Kontributor.
    var tampil = !!(p.terdaftar || p.adaAktivitas);
    delete p.terdaftar; delete p.adaAktivitas;
    return tampil;
  });
  return { ok: true, kontributor: list };
}
function doPost(e) {
  var q;
  try { q = JSON.parse(e.postData.contents); } catch (x) { return out({ ok: false, pesan: 'Permintaan tidak valid.' }); }
  try {
    if (q.aksi === 'login') return out(opLogin(q));
    var c = CacheService.getScriptCache(), raw = q.token && c.get(q.token);
    if (q.aksi === 'keluar') { if (q.token) c.remove(q.token); return out({ ok: true }); }
    if (!raw) return out({ ok: false, pesan: 'Sesi habis. Masuk lagi.' });
    var sesi = JSON.parse(raw), izin = IZIN[sesi.peran] || [];
    var perlu = { tambah_kata: 'tambah', sunting_kata: 'sunting', hapus_kata: 'hapus', verifikasi_kata: 'verif', batalkan_revisi: 'batalkan' }[q.aksi];
    if (!perlu) return out({ ok: false, pesan: 'Aksi tidak dikenal.' });
    if (izin.indexOf(perlu) < 0) return out({ ok: false, pesan: 'Peran "' + sesi.peran + '" tidak boleh melakukan aksi ini.' });
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      if (q.aksi === 'tambah_kata') return out(opTambah(q.data || {}, sesi));
      if (q.aksi === 'sunting_kata') return out(opSunting(q.id, q.data || {}, sesi));
      if (q.aksi === 'hapus_kata') return out(opHapus(q.id, sesi));
      if (q.aksi === 'verifikasi_kata') return out(opVerifikasi(q.id, sesi));
      return out(opBatalkan(q.id_revisi, sesi));
    } finally { lock.releaseLock(); }
  } catch (err) { return out({ ok: false, pesan: String(err.message || err) }); }
}

/* ===================== menu di spreadsheet ===================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Kamus Aceh')
    .addItem('Siapkan sheet', 'siapkanSheet')
    .addItem('Tambah pengguna', 'menuTambahPengguna')
    .addItem('Ubah sandi pengguna', 'menuUbahSandi')
    .addToUi();
}
function tanya(judul, teks) {
  var u = SpreadsheetApp.getUi(), r = u.prompt(judul, teks, u.ButtonSet.OK_CANCEL);
  return r.getSelectedButton() === u.Button.OK ? r.getResponseText().trim() : null;
}
function menuTambahPengguna() {
  var user = tanya('Tambah pengguna', 'Nama pengguna (untuk login):'); if (!user) return;
  var nama = tanya('Tambah pengguna', 'Nama lengkap:'); if (!nama) return;
  var peran = (tanya('Tambah pengguna', 'Peran (admin, penyunting, kontributor, tamu):') || '').toLowerCase();
  if (!IZIN[peran]) return SpreadsheetApp.getUi().alert('Peran tidak dikenal.');
  var sandi = tanya('Tambah pengguna', 'Kata sandi (minimal 8 karakter):');
  if (!sandi || sandi.length < 8) return SpreadsheetApp.getUi().alert('Kata sandi minimal 8 karakter.');
  var P = sheet('Pengguna'), n = lastRow(P, 1), v = n > 1 ? P.getRange(2, 1, n - 1, 1).getValues() : [];
  for (var i = 0; i < v.length; i++) if (String(v[i][0]).toLowerCase() === user.toLowerCase()) return SpreadsheetApp.getUi().alert('Nama pengguna sudah ada.');
  var garam = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  tulis(P, n + 1, [user, nama, peran, hash(garam, sandi), garam]);
  SpreadsheetApp.getUi().alert('Pengguna ditambahkan.');
}
function menuUbahSandi() {
  var user = tanya('Ubah sandi', 'Nama pengguna:'); if (!user) return;
  var sandi = tanya('Ubah sandi', 'Kata sandi baru (minimal 8 karakter):');
  if (!sandi || sandi.length < 8) return SpreadsheetApp.getUi().alert('Kata sandi minimal 8 karakter.');
  var P = sheet('Pengguna'), n = lastRow(P, 1), v = n > 1 ? P.getRange(2, 1, n - 1, 1).getValues() : [];
  for (var i = 0; i < v.length; i++) if (String(v[i][0]).toLowerCase() === user.toLowerCase()) {
    var garam = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    var r = P.getRange(i + 2, 4, 1, 2); r.setNumberFormat('@'); r.setValues([[hash(garam, sandi), garam]]);
    return SpreadsheetApp.getUi().alert('Kata sandi diperbarui.');
  }
  SpreadsheetApp.getUi().alert('Pengguna tidak ditemukan.');
}

/* ===================== siapkan sheet (aman dijalankan berulang) ===================== */
function siapkanSheet() {
  var S = ss();
  entri();                                                    // pastikan sheet Entri lengkap kolomnya
  var oldK = S.getSheetByName('Kontributor');
  if (oldK && oldK.getLastColumn() >= 10) {
    var oldHead = oldK.getRange(1, 1, 1, 10).getDisplayValues()[0];
    if (oldHead[0] === 'username' && oldHead[1] === 'nama' && oldHead[2] === 'peran' && oldHead[3] === 'bergabung' && oldHead[4] === 'kata' && oldHead[5] === 'sunting' && oldHead[6] === 'verif' && oldHead[8] === 'streak' && oldHead[9] === 'poin') oldK.deleteColumn(8);
  }
  Object.keys(HEAD).forEach(function (n) {
    var sh = S.getSheetByName(n) || S.insertSheet(n), h = HEAD[n];
    if (sh.getRange(1, 1, 1, h.length).getValues()[0].join('|') !== h.join('|')) sh.getRange(1, 1, 1, h.length).setValues([h]);
    sh.setFrozenRows(1); sh.getRange(1, 1, 1, h.length).setFontWeight('bold');
  });
  // kolom bantu + sheet rumus
  var R = sheet('Riwayat'), M = CFG.MAKS_RIWAYAT;
  R.getRange(1, 10, 1, 2).setValues([['kunci_bantu', 'teks_bantu']]).setFontWeight('bold');
  var f = [];
  for (var r = 2; r <= M; r++) f.push(['=IF(D' + r + '="","",D' + r + '&"|"&COUNTIF($D$2:D' + r + ',D' + r + '))', '=IF(D' + r + '="","",B' + r + '&" · "&C' + r + '&" · "&E' + r + '&" · "&F' + r + ')']);
  R.getRange(2, 10, M - 1, 2).setFormulas(f);
  buatRingkasan(); buatRiwayatPerkata();
  // validasi isian di Entri
  var E = entri(), maks = Math.max(E.sh.getMaxRows(), 2);
  var vj = SpreadsheetApp.newDataValidation().requireValueInList(JENIS, true).setAllowInvalid(false).build();
  var vk = SpreadsheetApp.newDataValidation().requireValueInList(KELAS.filter(String), true).setAllowInvalid(true).build();
  E.sh.getRange(2, E.h.indexOf('jenis_entri') + 1, maks - 1, 1).setDataValidation(vj);
  E.sh.getRange(2, E.h.indexOf('tipe_kata') + 1, maks - 1, 1).setDataValidation(vk);
  SpreadsheetApp.getUi().alert('Sheet siap. Tambahkan pengguna lewat menu Kamus Aceh > Tambah pengguna.');
}
function buatRingkasan() {
  var S = ss(), sh = S.getSheetByName('Ringkasan') || S.insertSheet('Ringkasan'), E = entri(), n = Math.max(lastRow(E.sh, 1), 2);
  sh.clear();
  sh.getRange(1, 1, 1, 7).setValues([['id', 'kata_kepala', 'homonim', 'jumlah_revisi', 'jumlah_sunting', 'edit_terakhir', 'diedit_oleh']]).setFontWeight('bold');
  var ci = function (k) { return String.fromCharCode(65 + E.h.indexOf(k)); }, f = [];   // kolom Entri (A..Z cukup untuk 3 kolom pertama)
  for (var r = 2; r <= n; r++) f.push(['=Entri!A' + r, '=Entri!C' + r, '=IF(Entri!D' + r + '="","",Entri!D' + r + ')',
    '=COUNTIF(Riwayat!$D$2:$D$5000,A' + r + ')', '=COUNTIFS(Riwayat!$D$2:$D$5000,A' + r + ',Riwayat!$E$2:$E$5000,"sunting")',
    '=IFERROR(LOOKUP(2,1/(Riwayat!$D$2:$D$5000=A' + r + '),Riwayat!$B$2:$B$5000),"")', '=IFERROR(LOOKUP(2,1/(Riwayat!$D$2:$D$5000=A' + r + '),Riwayat!$C$2:$C$5000),"")']);
  sh.getRange(2, 1, f.length, 7).setFormulas(f); sh.setFrozenRows(1);
}
function buatRiwayatPerkata() {
  var S = ss(), sh = S.getSheetByName('Riwayat_Perkata') || S.insertSheet('Riwayat_Perkata'), E = entri(), n = Math.max(lastRow(E.sh, 1), 2), N = CFG.MAKS_PERKATA, M = CFG.MAKS_RIWAYAT;
  sh.clear();
  var head = ['id_kata', 'kata']; for (var i = 1; i <= N; i++) head.push('riwayat_' + i);
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  var f = [], col = function (c) { var s = ''; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - m) / 26); } return s; };
  for (var r = 2; r <= n; r++) {
    var row = ['=Entri!A' + r, '=Entri!C' + r + '&IF(Entri!D' + r + '="","","  ("&Entri!D' + r + '&")")'];
    for (var k = 1; k <= N; k++) row.push('=IFERROR(INDEX(Riwayat!$K$2:$K$' + M + ',MATCH($A' + r + '&"|"&COLUMNS($C' + r + ':' + col(2 + k) + r + '),Riwayat!$J$2:$J$' + M + ',0)),"")');
    f.push(row);
  }
  sh.getRange(2, 1, f.length, head.length).setFormulas(f); sh.setFrozenRows(1); sh.setFrozenColumns(2);
}
