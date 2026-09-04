/**
 * Build & Sync Script untuk Kamus Aceh
 */
const fs = require('fs');
const path = require('path');

console.log("[Setup] Inisialisasi kompilasi basis data...");

// Ambil & Dekripsi token jika ada di token.txt
const tokenFile = path.join(__dirname, 'token.txt');
if (fs.existsSync(tokenFile)) {
  const rawToken = fs.readFileSync(tokenFile, 'utf8').trim();
  if (/^[0-9a-fA-F]+$/.test(rawToken) && rawToken.length % 2 === 0) {
    let str = "";
    for (let i = 0; i < rawToken.length; i += 2) {
      str += String.fromCharCode(parseInt(rawToken.substr(i, 2), 16));
    }
    process.env.SECRET_API_KEY = str;
    console.log("[Setup] Token berhasil didekripsi dari Hex token.txt");
  } else {
    try {
      const decoded = Buffer.from(rawToken, 'base64').toString('utf8');
      process.env.SECRET_API_KEY = decoded;
    } catch(e) {
      process.env.SECRET_API_KEY = rawToken;
    }
  }
}

try {
  const indexFile = path.join(__dirname, 'db', 'index.json');
  if (fs.existsSync(indexFile)) {
    const data = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    console.log(`[Setup] Indeks ditemukan dengan ${Object.keys(data).length} entri.`);
  }
  console.log("[Setup] Proses verifikasi selesai tanpa kesalahan.");
} catch (e) {
  console.error("[Setup] Gagal:", e.message);
}