/**
 * Script Utama Frontend Kamus Aceh Digital
 * Menangani Pencarian Real-time & Mode Beranda (Default Featured Entries)
 */
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  registerServiceWorker();
});

let searchIndex = {};
let loadedShards = {};
let activeToken = null;

const FEATURED_ENTRIES = [
  { kata: "aneuk", arti: "Anak", kelas: "n / Nomina" },
  { kata: "bu", arti: "Nasi", kelas: "n / Nomina" },
  { kata: "gunong", arti: "Gunung", kelas: "n / Nomina" },
  { kata: "ie", arti: "Air", kelas: "n / Nomina" },
  { kata: "laot", arti: "Laut", kelas: "n / Nomina" },
  { kata: "leumo", arti: "Sapi / Lembu", kelas: "n / Nomina" },
  { kata: "malam", arti: "Malam", kelas: "n / Nomina" },
  { kata: "rumoh", arti: "Rumah", kelas: "n / Nomina" },
  { kata: "ureueng", arti: "Orang", kelas: "n / Nomina" },
  { kata: "uroe", arti: "Hari / Matahari", kelas: "n / Nomina" }
];

async function initApp() {
  console.log("Inisialisasi Kamus Aceh...");
  await loadSearchIndex();
  await loadRemoteToken();
  setupEventListeners();
  renderDefaultBerandaWords();
}

// 1. Memuat Kosa Kata Pilihan Saat Pencarian Kosong (Mode Beranda)
function renderDefaultBerandaWords() {
  const container = document.getElementById("resultsContainer");
  const sectionTitle = document.getElementById("sectionTitle");
  const resultCount = document.getElementById("resultCount");

  if (!container) return;

  if (sectionTitle) {
    sectionTitle.innerHTML = "🌟 <span>Kosa Kata Pilihan Beranda</span>";
  }
  if (resultCount) {
    resultCount.textContent = `Menampilkan ${FEATURED_ENTRIES.length} kata pilihan`;
  }

  container.innerHTML = FEATURED_ENTRIES.map(item => `
    <div class="bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 p-4 rounded-xl shadow-md transition group">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-emerald-400 group-hover:text-emerald-300 transition">${item.kata}</h3>
        <span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">${item.kelas}</span>
      </div>
      <p class="text-sm text-slate-200 mt-2 font-medium">${item.arti}</p>
      <div class="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
        <span>Kosa kata umum</span>
        <a href="entries/${item.kata}.html" class="text-emerald-400 hover:underline">Detail ➔</a>
      </div>
    </div>
  `).join("");
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
    searchInput.addEventListener("input", debounce(handleSearchInput, 200));
  }
}

function handleSearchInput(e) {
  const query = e.target.value.trim().toLowerCase();
  const container = document.getElementById("resultsContainer");
  const sectionTitle = document.getElementById("sectionTitle");
  const resultCount = document.getElementById("resultCount");

  if (!container) return;

  // Jika input pencarian kosong, kembalikan ke kosa kata pilihan beranda
  if (query.length === 0) {
    renderDefaultBerandaWords();
    return;
  }

  if (sectionTitle) {
    sectionTitle.innerHTML = "🔍 <span>Hasil Pencarian</span>";
  }

  const matches = Object.keys(searchIndex).filter(word => word.includes(query)).slice(0, 15);
  
  if (resultCount) {
    resultCount.textContent = `Ditemukan ${matches.length} kata`;
  }

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 bg-slate-800/40 rounded-2xl border border-slate-800">
        <p class="text-base text-slate-300 font-semibold">Kata "${escapeHtml(query)}" tidak ditemukan</p>
        <p class="text-xs text-slate-500 mt-1">Coba gunakan kata kunci lain atau periksa kembali ejaan Anda.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = matches.map(word => `
    <div class="bg-slate-800 border border-slate-700 hover:border-emerald-500/50 p-4 rounded-xl shadow space-y-2 transition">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-emerald-400">${word}</h3>
        <span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Entri Terdaftar</span>
      </div>
      <p class="text-xs text-slate-300">File Shard: <code class="text-emerald-400 font-mono">db/shards/${searchIndex[word]}.json</code></p>
      <div class="pt-2 text-right">
        <a href="entries/${word}.html" class="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1">Lihat Detail ➔</a>
      </div>
    </div>
  `).join("");
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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