/**
 * Logika Utama Aplikasi Web Statis Kamus Aceh
 * Mengambil token dari https://lokasitoken.com/token.txt
 */

document.addEventListener("DOMContentLoaded", () => {
  initApp();
  registerServiceWorker();
});

let searchIndex = {};
let loadedShards = {};
let activeToken = null;

async function initApp() {
  console.log("Inisialisasi Kamus Aceh...");
  await loadSearchIndex();
  
  if (window.APP_CONFIG?.features?.fetchTokenDynamically) {
    await loadRemoteToken();
  }
}

async function loadRemoteToken() {
  try {
    const url = window.APP_CONFIG?.tokenSourceUrl || "https://lokasitoken.com/token.txt";
    const res = await fetch(url);
    if (res.ok) {
      activeToken = (await res.text()).trim();
      console.log("Token berhasil dimuat langsung dari lokasitoken.com");
    }
  } catch (err) {
    console.warn("Gagal memuat token dari URL eksternal:", err);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker terdaftar:', reg.scope))
      .catch(err => console.warn('Service Worker gagal mendaftar:', err));
  }
}

async function loadSearchIndex() {
  try {
    const response = await fetch(window.APP_CONFIG?.paths?.indexDb || "db/index.json");
    if (!response.ok) throw new Error("Gagal memuat index.json");
    searchIndex = await response.json();
  } catch (error) {
    console.error("Kesalahan memuat indeks:", error);
  }
}