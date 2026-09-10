/* ==========================================================
   kamus.js — logika inti bersama untuk Kamus Bahasa Acèh
   Dipakai oleh: index.html
   ========================================================== */

const CONFIG = {
  owner: "kamusaceh",
  repo: "kamusaceh.github.io",
  branch: "main",
  tokenApiUrl: "https://script.google.com/macros/s/AKfycbyX4P3PzXC2zN6wmF1Su5TepkdRl5jPSLf9PWB0HQfKWvriyEDq0ZnO-2UTRSUou8FG/exec",
  cdnBase: (owner, repo, branch) =>
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/`
};

function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function slugify(word) {
  let s = stripDiacritics(word.toLowerCase().trim());
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "kata";
}
function firstLetter(word) {
  const s = stripDiacritics(word.toLowerCase().trim());
  const m = s.match(/[a-z]/);
  return m ? m[0] : "misc";
}

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${path}?t=${Date.now()}`;
}
async function fetchIndex(letter) {
  try {
    const res = await fetch(rawUrl(`index/${letter}.json`));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) { return []; }
}
async function fetchWordData(letter, slug) {
  const res = await fetch(rawUrl(`db/${letter}/${slug}.json`));
  if (!res.ok) throw new Error("Kata tidak ditemukan");
  return await res.json();
}
async function fetchAdmins() {
  const res = await fetch(rawUrl(`auth/admins.json`));
  if (!res.ok) return [];
  return await res.json();
}
// Baca statistik kontribusi admin lewat jalur publik (tanpa token GitHub) —
// dipakai untuk profil yang bisa dilihat siapa saja, termasuk pengunjung
// yang belum login, jadi TIDAK boleh minta token tulis lewat Apps Script.
async function fetchStatsPublic(username) {
  const empty = { username, added: 0, edited: 0, deleted: 0, restored: 0, recentActions: [] };
  try {
    const res = await fetch(rawUrl(`auth/stats/${username}.json`));
    if (!res.ok) return empty;
    return await res.json();
  } catch (e) { return empty; }
}

/* ---------- statistik & kata acak (gabungan semua index/<huruf>.json) --- */
let _allIndexCache = null;

async function fetchAllIndexEntries() {
  if (_allIndexCache) return _allIndexCache;
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  let totalBytes = 0;
  let lettersFilled = 0;
  let combined = [];
  await Promise.all(letters.map(async (letter) => {
    try {
      const res = await fetch(rawUrl(`index/${letter}.json`));
      if (!res.ok) return;
      const text = await res.text();
      totalBytes += new Blob([text]).size;
      const arr = JSON.parse(text);
      if (arr.length) lettersFilled++;
      combined = combined.concat(arr.map(item => ({ ...item, letter })));
    } catch (e) { /* huruf ini dilewati kalau gagal diambil */ }
  }));
  _allIndexCache = { entries: combined, totalBytes, lettersFilled, totalLetters: letters.length };
  return _allIndexCache;
}

function pickRandom(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

let currentAdmin = null;
const SESSION_KEY = "kamus_admin_session";

function saveSession(admin, hash) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: admin.username, nama: admin.nama, hash }));
  } catch (e) {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

async function loginAdmin(username, password) {
  const admins = await fetchAdmins();
  const hash = await sha256Hex(password);
  const found = admins.find(a => a.username === username && a.hash === hash);
  if (found) {
    currentAdmin = { username: found.username, nama: found.nama };
    saveSession(currentAdmin, hash);
    return true;
  }
  return false;
}
function logoutAdmin() {
  currentAdmin = null;
  clearSession();
}

async function restoreAdminSession() {
  let saved;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    saved = JSON.parse(raw);
  } catch (e) { return null; }
  if (!saved || !saved.username || !saved.hash) return null;

  try {
    const admins = await fetchAdmins();
    const found = admins.find(a => a.username === saved.username && a.hash === saved.hash);
    if (found) {
      currentAdmin = { username: found.username, nama: found.nama };
      return currentAdmin;
    }
    clearSession();
    return null;
  } catch (e) {
    currentAdmin = { username: saved.username, nama: saved.nama };
    return currentAdmin;
  }
}

let _tokenCache = null;
async function getGithubToken() {
  if (_tokenCache) return _tokenCache;
  const res = await fetch(CONFIG.tokenApiUrl);
  const data = await res.json();
  if (data.status !== "success" || !data.data || !data.data[0]) {
    throw new Error("Gagal ambil token dari Apps Script");
  }
  _tokenCache = data.data[0].token;
  return _tokenCache;
}

function b64EncodeUnicode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64DecodeUnicode(str) { return decodeURIComponent(escape(atob(str))); }

async function githubApi(path, options = {}) {
  const token = await getGithubToken();
  const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/${path}`, {
    ...options,
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json", ...(options.headers || {}) }
  });
  return res;
}

async function getFileSha(path) {
  const res = await githubApi(`contents/${path}?ref=${CONFIG.branch}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Gagal cek file ${path}`);
  const data = await res.json();
  return data.sha;
}
async function getFileJson(path) {
  const res = await githubApi(`contents/${path}?ref=${CONFIG.branch}`);
  if (res.status === 404) return { sha: null, data: null };
  if (!res.ok) throw new Error(`Gagal ambil file ${path}`);
  const data = await res.json();
  return { sha: data.sha, data: JSON.parse(b64DecodeUnicode(data.content)) };
}
async function putFileJson(path, obj, message, sha) {
  const body = { message, content: b64EncodeUnicode(JSON.stringify(obj, null, 2)), branch: CONFIG.branch };
  if (sha) body.sha = sha;
  const res = await githubApi(`contents/${path}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gagal simpan ${path}: ${err.message || res.status}`);
  }
  return res.json();
}
async function deleteFile(path, sha, message) {
  const res = await githubApi(`contents/${path}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, branch: CONFIG.branch })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gagal hapus ${path}: ${err.message || res.status}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Pakai jeda singkat (dengan sedikit backoff) di antara percobaan supaya sha
// yang baru sempat "settle" di GitHub sebelum dicoba lagi — mengurangi error
// "index/x.json does not match ..." saat beberapa perubahan terjadi berdekatan.
async function putFileJsonWithRetry(path, mutateFn, message, maxRetries = 6) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(300 * attempt);
    const { sha, data } = await getFileJson(path);
    const newData = mutateFn(data);
    if (newData === null || newData === undefined) return newData;
    try {
      await putFileJson(path, newData, message, sha);
      return newData;
    } catch (e) {
      lastErr = e;
      if (!/does not match/i.test(e.message)) throw e;
    }
  }
  throw lastErr;
}

async function findAvailableSlug(baseSlug, letter) {
  let slug = baseSlug;
  let n = 1;
  while (true) {
    const sha = await getFileSha(`db/${letter}/${slug}.json`).catch(() => null);
    if (!sha) return slug;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }
}

/* ---------- statistik kontribusi per admin (auth/stats/<username>.json) --- */
// Best-effort: kalau gagal simpan, aksi utama (tambah/ubah/hapus kata) tetap
// dianggap berhasil — statistik cuma pelengkap, bukan boleh menggagalkan aksi.
async function recordContribution(username, action, wordInfo) {
  try {
    await putFileJsonWithRetry(
      `auth/stats/${username}.json`,
      (data) => {
        const stats = data || { username, added: 0, edited: 0, deleted: 0, restored: 0, recentActions: [] };
        if (action === "tambah") stats.added = (stats.added || 0) + 1;
        else if (action === "ubah") stats.edited = (stats.edited || 0) + 1;
        else if (action === "hapus") stats.deleted = (stats.deleted || 0) + 1;
        else if (action === "pulihkan") stats.restored = (stats.restored || 0) + 1;
        stats.recentActions = [
          { action, word: wordInfo.word, slug: wordInfo.slug, at: new Date().toISOString() },
          ...(stats.recentActions || [])
        ].slice(0, 50); // simpan 50 aksi terakhir saja supaya file tidak membengkak
        return stats;
      },
      `Stats: ${action} oleh ${username} - ${wordInfo.word}`
    );
  } catch (e) {
    console.warn("Gagal update statistik kontribusi:", e.message);
  }
}

async function getStats(username) {
  const { data } = await getFileJson(`auth/stats/${username}.json`);
  return data || { username, added: 0, edited: 0, deleted: 0, restored: 0, recentActions: [] };
}

async function addWord(entry) {
  if (!currentAdmin) throw new Error("Harus login sebagai admin");
  const letter = firstLetter(entry.word);
  const baseSlug = slugify(entry.word);
  const slug = await findAvailableSlug(baseSlug, letter);

  const record = {
    word: entry.word, pos: entry.pos || "", meaning: entry.meaning,
    examples: entry.examples || [], rujukan: entry.rujukan || [], sumber: entry.sumber || "",
    added_by: currentAdmin.username, edited_by: currentAdmin.username, updated_at: new Date().toISOString()
  };

  await putFileJson(`db/${letter}/${slug}.json`, record, `Tambah kata: ${entry.word}`, null);
  await putFileJsonWithRetry(
    `index/${letter}.json`,
    (idxData) => {
      const idx = idxData || [];
      idx.push({ slug, word: entry.word, meaning: entry.meaning });
      idx.sort((a, b) => a.word.localeCompare(b.word));
      return idx;
    },
    `Update index: tambah ${entry.word}`
  );
  recordContribution(currentAdmin.username, "tambah", { word: entry.word, slug });
  return slug;
}

async function editWord(letter, slug, updates) {
  if (!currentAdmin) throw new Error("Harus login sebagai admin");
  const { sha, data } = await getFileJson(`db/${letter}/${slug}.json`);
  if (!data) throw new Error("Kata tidak ditemukan");

  const updated = { ...data, ...updates, edited_by: currentAdmin.username, updated_at: new Date().toISOString() };
  await putFileJson(`db/${letter}/${slug}.json`, updated, `Ubah kata: ${updated.word}`, sha);
  await putFileJsonWithRetry(
    `index/${letter}.json`,
    (idxData) => {
      if (!idxData) return null;
      return idxData.map(item => item.slug === slug ? { ...item, word: updated.word, meaning: updated.meaning } : item);
    },
    `Update index: ubah ${updated.word}`
  );
  recordContribution(currentAdmin.username, "ubah", { word: updated.word, slug });
  return updated;
}

async function deleteWord(letter, slug) {
  if (!currentAdmin) throw new Error("Harus login sebagai admin");
  const sha = await getFileSha(`db/${letter}/${slug}.json`);
  if (!sha) throw new Error("Kata tidak ditemukan");
  const wordBefore = await getFileJson(`db/${letter}/${slug}.json`).then(r => r.data).catch(() => null);
  await deleteFile(`db/${letter}/${slug}.json`, sha, `Hapus kata: ${slug}`);
  await putFileJsonWithRetry(
    `index/${letter}.json`,
    (idxData) => (idxData ? idxData.filter(item => item.slug !== slug) : null),
    `Update index: hapus ${slug}`
  );
  recordContribution(currentAdmin.username, "hapus", { word: wordBefore?.word || slug, slug });
}

async function fetchWordHistory(letter, slug) {
  const res = await fetch(
    `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/commits?path=db/${letter}/${slug}.json&sha=${CONFIG.branch}&per_page=30`
  );
  if (!res.ok) throw new Error("Gagal mengambil riwayat (kemungkinan batas rate GitHub tercapai, coba lagi nanti)");
  return await res.json();
}
async function fetchWordVersionAtCommit(letter, slug, commitSha) {
  const res = await fetch(
    `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${commitSha}/db/${letter}/${slug}.json`
  );
  if (!res.ok) throw new Error("Versi ini tidak tersedia (kata mungkin belum ada / sedang terhapus saat itu)");
  return await res.json();
}
function formatTanggalRiwayat(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
  catch (e) { return iso; }
}

let _riwayatOnRestoreDone = null;
function openHistoryModal(letter, slug, word, onRestoreDone) {
  _riwayatOnRestoreDone = onRestoreDone || null;
  let modal = document.getElementById("riwayat-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "riwayat-modal";
    modal.className = "riwayat-modal-overlay";
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
  }
  modal.innerHTML = `
    <div class="riwayat-modal-box">
      <div class="riwayat-modal-header">
        <h2>Riwayat: ${escapeHtml(word)}</h2>
        <button type="button" id="riwayat-close">×</button>
      </div>
      <div id="riwayat-list">Memuat riwayat…</div>
    </div>`;
  modal.style.display = "flex";
  modal.querySelector("#riwayat-close").addEventListener("click", () => { modal.style.display = "none"; });
  loadHistoryList(letter, slug);
}
async function loadHistoryList(letter, slug) {
  const listEl = document.getElementById("riwayat-list");
  if (!listEl) return;
  try {
    const commits = await fetchWordHistory(letter, slug);
    if (!commits.length) { listEl.innerHTML = "<p>Belum ada riwayat untuk kata ini.</p>"; return; }
    listEl.innerHTML = commits.map((c, i) => {
      const isLatest = i === 0;
      const isDeleteCommit = /hapus/i.test(c.commit.message);
      const authorName = c.commit.author?.name || c.author?.login || "tidak diketahui";
      const dateStr = formatTanggalRiwayat(c.commit.author?.date);
      return `
      <div class="riwayat-item${isLatest ? " riwayat-current" : ""}">
        <div class="riwayat-item-main">
          <strong>${escapeHtml(c.commit.message)}</strong>
          <span class="riwayat-meta">oleh ${escapeHtml(authorName)} · ${escapeHtml(dateStr)}</span>
        </div>
        <div class="riwayat-item-actions">
          ${isLatest ? '<span class="riwayat-tag">Versi saat ini</span>' : ""}
          ${(!isLatest && !isDeleteCommit) ? `<button type="button" class="riwayat-lihat" data-sha="${c.sha}">Lihat</button>` : ""}
          ${(!isLatest && !isDeleteCommit && currentAdmin) ? `<button type="button" class="riwayat-pulihkan" data-sha="${c.sha}">Pulihkan</button>` : ""}
        </div>
        <div class="riwayat-preview" id="preview-${c.sha}" style="display:none"></div>
      </div>`;
    }).join("");

    listEl.querySelectorAll(".riwayat-lihat").forEach(btn => {
      btn.addEventListener("click", async () => {
        const sha = btn.dataset.sha;
        const previewEl = document.getElementById(`preview-${sha}`);
        if (previewEl.style.display === "block") { previewEl.style.display = "none"; return; }
        previewEl.style.display = "block";
        previewEl.textContent = "Memuat…";
        try {
          const data = await fetchWordVersionAtCommit(letter, slug, sha);
          previewEl.innerHTML = `
            <p><strong>Arti:</strong> ${escapeHtml(data.meaning)}</p>
            ${(data.examples || []).map(ex => `<p class="aceh">"${escapeHtml(ex.aceh)}" — <em>${escapeHtml(ex.indo)}</em></p>`).join("")}
          `;
        } catch (e) { previewEl.textContent = e.message; }
      });
    });

    listEl.querySelectorAll(".riwayat-pulihkan").forEach(btn => {
      btn.addEventListener("click", async () => {
        const sha = btn.dataset.sha;
        if (!confirm("Pulihkan kata ke versi ini? Ini akan membuat commit baru di GitHub.")) return;
        btn.disabled = true;
        btn.textContent = "Memulihkan…";
        try {
          await restoreWordVersion(letter, slug, sha);
          const modal = document.getElementById("riwayat-modal");
          if (modal) modal.style.display = "none";
          if (typeof _riwayatOnRestoreDone === "function") _riwayatOnRestoreDone();
        } catch (e) {
          alert("Gagal memulihkan: " + e.message);
          btn.disabled = false;
          btn.textContent = "Pulihkan";
        }
      });
    });
  } catch (e) {
    listEl.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
  }
}

async function restoreWordVersion(letter, slug, commitSha) {
  if (!currentAdmin) throw new Error("Harus login sebagai admin");
  const oldData = await fetchWordVersionAtCommit(letter, slug, commitSha);
  const currentSha = await getFileSha(`db/${letter}/${slug}.json`);

  const restored = { ...oldData, edited_by: currentAdmin.username, updated_at: new Date().toISOString() };

  await putFileJson(`db/${letter}/${slug}.json`, restored,
    `Pulihkan kata: ${restored.word} (dari commit ${commitSha.slice(0, 7)})`, currentSha);

  await putFileJsonWithRetry(
    `index/${letter}.json`,
    (idxData) => {
      let idx = idxData || [];
      const exists = idx.some(item => item.slug === slug);
      if (exists) {
        idx = idx.map(item => (item.slug === slug ? { ...item, word: restored.word, meaning: restored.meaning } : item));
      } else {
        idx.push({ slug, word: restored.word, meaning: restored.meaning });
        idx.sort((a, b) => a.word.localeCompare(b.word));
      }
      return idx;
    },
    `Update index: pulihkan ${restored.word}`
  );
  recordContribution(currentAdmin.username, "pulihkan", { word: restored.word, slug });
  return restored;
}

function renderEntri(container, data, slug, letter) {
  const examplesHtml = (data.examples || [])
    .map((ex, i) => `
      <div class="contoh">
        <span class="no">${String(i + 1).padStart(2, "0")}</span>
        <div>
          <p class="aceh">"${escapeHtml(ex.aceh)}"</p>
          <p class="indo">${escapeHtml(ex.indo)}</p>
        </div>
      </div>`).join("");

  const rujukanHtml = (data.rujukan || [])
    .map(r => `<a href="/entri/${r}" class="rujukan-chip" data-slug="${r}">${r}</a>`).join(" ");

  const riwayatHtml = `<button type="button" class="riwayat-link" data-action="riwayat">Riwayat Kata</button>`;

  const adminHtml = currentAdmin
    ? `<div class="admin-bar"><button data-action="ubah">Ubah</button><button data-action="hapus">Hapus</button></div>`
    : "";

  container.innerHTML = `
    <div class="entri" data-letter="${letter}" data-slug="${slug}" data-word="${escapeHtml(data.word)}">
      <h1>${escapeHtml(data.word)} <span class="pos">${escapeHtml(data.pos || "")}</span></h1>
      <p class="meaning">${escapeHtml(data.meaning)}</p>
      ${examplesHtml ? `<h2>Contoh Kalimat</h2>${examplesHtml}` : ""}
      ${rujukanHtml ? `<h2>Lihat juga</h2><div class="rujukan-list">${rujukanHtml}</div>` : ""}
      ${data.sumber ? `<h2>Sumber / Referensi</h2><p class="sumber">${escapeHtml(data.sumber)}</p>` : ""}
      ${data.added_by ? `<p class="meta">Ditambah oleh <button type="button" class="profil-link" data-username="${escapeHtml(data.added_by)}">${escapeHtml(data.added_by)}</button>${data.edited_by && data.edited_by !== data.added_by ? `, terakhir diubah oleh <button type="button" class="profil-link" data-username="${escapeHtml(data.edited_by)}">${escapeHtml(data.edited_by)}</button>` : ""}</p>` : ""}
      <div class="entri-footer">
        ${riwayatHtml}
        ${adminHtml}
      </div>
    </div>`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
