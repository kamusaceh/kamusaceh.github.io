/**
 * Script Utama Frontend Kamus Aceh Digital
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
  await loadRemoteToken();
  setupEventListeners();
}

async function loadRemoteToken() {
  try {
    const res = await fetch("token.txt");
    if (res.ok) {
      const raw = (await res.text()).trim();
      if (/^[0-9a-fA-F]+$/.test(raw)) {
        let str = "";
        for (let i = 0; i < raw.length; i += 2) {
          str += String.fromCharCode(parseInt(raw.substr(i, 2), 16));
        }
        activeToken = str;
      } else {
        activeToken = raw;
      }
      console.log("Token lokal berhasil dimuat & didekripsi.");
    }
  } catch (err) {
    console.warn("Gagal membaca token lokal:", err);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker terdaftar:', reg.scope))
      .catch(err => console.warn('Service Worker gagal:', err));
  }
}

async function loadSearchIndex() {
  try {
    const response = await fetch(window.APP_CONFIG?.paths?.indexDb || "db/index.json");
    if (!response.ok) throw new Error("Gagal memuat index.json");
    searchIndex = await response.json();
    console.log("Indeks pencarian berhasil dimuat.");
  } catch (error) {
    console.error("Kesalahan memuat indeks:", error);
  }
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(handleSearchInput, 250));
  }
}

function handleSearchInput(e) {
  const query = e.target.value.trim().toLowerCase();
  const container = document.getElementById("resultsContainer");
  if (!container) return;

  if (query.length === 0) {
    container.innerHTML = "";
    return;
  }

  const matches = Object.keys(searchIndex).filter(word => word.includes(query)).slice(0, 10);
  
  if (matches.length === 0) {
    container.innerHTML = '<div class="col-span-2 text-center text-slate-500 py-8">Kata tidak ditemukan</div>';
    return;
  }

  container.innerHTML = matches.map(word => `
    <div class="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow space-y-1">
      <h3 class="text-lg font-bold text-emerald-400">${word}</h3>
      <p class="text-xs text-slate-400">Detail kosa kata tersedia di basis data.</p>
    </div>
  `).join("");
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}