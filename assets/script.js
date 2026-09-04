/**
 * Logika Utama Aplikasi Kamus Aceh Digital
 */
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  registerServiceWorker();
});

let searchIndex = {};
let loadedShards = {};
let activeToken = null;

async function initApp() {
  console.log("Memuat data Kamus Aceh...");
  await loadSearchIndex();
  await loadRemoteToken();
  setupSearchInput();
}

async function loadRemoteToken() {
  try {
    const res = await fetch("token.txt");
    if (res.ok) {
      const raw = (await res.text()).trim();
      if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
        let str = '';
        for (let i = 0; i < raw.length; i += 2) {
          str += String.fromCharCode(parseInt(raw.substr(i, 2), 16));
        }
        activeToken = str;
      } else {
        try { activeToken = atob(raw); } catch(e) { activeToken = raw; }
      }
      console.log("Token berhasil dimuat & didekripsi.");
    }
  } catch (err) {
    console.warn("Token belum dikonfigurasi di token.txt");
  }
}

async function loadSearchIndex() {
  try {
    const response = await fetch("db/index.json");
    if (!response.ok) throw new Error("Gagal membaca db/index.json");
    searchIndex = await response.json();
    console.log("Index berhasil dimuat:", Object.keys(searchIndex).length, "kata");
  } catch (err) {
    console.error("Kesalahan memuat indeks:", err);
  }
}

function setupSearchInput() {
  const input = document.getElementById("searchInput");
  if (input) {
    input.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      renderSearchResults(q);
    });
  }
}

function renderSearchResults(query) {
  const container = document.getElementById("resultsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!query) return;

  const matches = Object.keys(searchIndex).filter(word => word.includes(query)).slice(0, 12);
  
  if (matches.length === 0) {
    container.innerHTML = `<div class="col-span-2 text-center text-slate-400 py-8">Kata tidak ditemukan.</div>`;
    return;
  }

  matches.forEach(word => {
    const item = searchIndex[word];
    const card = document.createElement("div");
    card.className = "bg-slate-800 border border-slate-700 p-4 rounded-xl hover:border-emerald-500 transition cursor-pointer";
    card.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-lg font-bold text-emerald-400">${word}</h3>
        <span class="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">${item.kelas || 'kata'}</span>
      </div>
      <p class="text-sm text-slate-300">${item.arti || ''}</p>
    `;
    card.onclick = () => loadAndShowWordDetail(word, item.shard);
    container.appendChild(card);
  });
}

async function loadAndShowWordDetail(word, shardName) {
  try {
    if (!loadedShards[shardName]) {
      const res = await fetch(`db/shards/${shardName}.json`);
      loadedShards[shardName] = await res.json();
    }
    const detail = loadedShards[shardName][word];
    if (detail) {
      alert(`Kata: ${word}\nKelas: ${detail.kelas}\nArti ID: ${detail.arti_id}\nArti EN: ${detail.arti_en || '-'}\nContoh: ${detail.contoh || '-'}`);
    }
  } catch(e) {
    console.error("Gagal memuat detail kata:", e);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn(err));
  }
}