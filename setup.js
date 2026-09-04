const fs = require('fs');

function getDecodedToken() {
  if (!fs.existsSync('token.txt')) return null;
  const raw = fs.readFileSync('token.txt', 'utf8').trim();
  if (/^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex').toString('utf8');
  }
  return raw;
}

console.log("Inisialisasi setup script Kamus Aceh...");
const token = getDecodedToken();
if (token) {
  console.log("Token berhasil dimuat & didekripsi.");
} else {
  console.log("token.txt tidak ditemukan.");
}