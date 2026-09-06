/* ==========================================================
   kamus.js — logika inti bersama untuk Kamus Bahasa Acèh
   Dipakai oleh: homepage.html, entri.html, setup.html
   ========================================================== */

/* ---------- 1. KONFIGURASI (hardcode di sini, admin tidak lihat) --- */
const CONFIG = {
  owner: "kamusaceh",
  repo: "kamusaceh.github.io",
  branch: "main",
  tokenApiUrl: "https://script.google.com/macros/s/AKfycbyX4P3PzXC2zN6wmF1Su5TepkdRl5jPSLf9PWB0HQfKWvriyEDq0ZnO-2UTRSUou8FG/exec",
  cdnBase: (owner, repo, branch) =>
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/`
};

/* ---------- 2. UTIL: slug & huruf ---------------------------------- */
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

/* ---------- 3. BACA DATA PUBLIK (tanpa token) ---------------------- */
function rawUrl(path) {
  return `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${path}?t=${Date.now()}`;
}
async function fetchIndex(letter) {
  try {
    const res = await fetch(rawUrl(`index/${letter}.json`));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
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

/* ---------- 4. HASH PASSWORD (SHA-256) --- */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- 5. LOGIN ADMIN --- */
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
  } catch (e) {
    return null;
  }
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

/* ---------- 6. TOKEN GITHUB --- */
let _tokenCache = null;
async function getGithubToken() {
  if (_tokenCache) return _tokenCache;
  try {
    const res = await fetch(CONFIG.tokenApiUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== "success" || !data.data || !data.data[0]) {
      throw new Error("Gagal ambil token dari Apps Script");
    }
    _tokenCache = data.data[0].token;
    return _tokenCache;
  } catch (e) {
    throw new Error("Gagal ambil token: " + e.message);
  }
}

/* ---------- 7. OPERASI GITHUB --- */
function b64EncodeUnicode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64DecodeUnicode(str) { return decodeURIComponent(escape(atob(str))); }

async function githubApi(path, options = {}) {
  const token = await getGithubToken();
  const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/${path}`, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      ...(options.headers || {})
    }
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
  const body = {
    message,
    content: b64EncodeUnicode(JSON.stringify(obj, null, 2)),
    branch: CONFIG.branch
  };
  if (sha) body.sha = sha;
  const res = await githubApi(`contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gagal simpan ${path}: ${err.message || res.status}`);
  }
  return res.json();
}
async function deleteFile(path, sha, message) {
  const res = await githubApi(`contents/${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, branch: CONFIG.branch })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gagal hapus ${path}`);
  }
}

/* ---------- 8. CRUD KATA --- */
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
async function addWord(entry) {
  if (!currentAdmin) throw new Error("Harus login sebagai admin");
  const letter = firstLetter(entry.word);
  const baseSlug = slugify(entry.word);
  const slug = await findAvailableSlug(baseSlug, letter);
  const record = {
    word: entry.word,
    pos: entry.pos || "",
    meaning: entry.meaning,
    examples: entry.examples || [],
    rujukan: entry.rujukan || [],
    sumber: entry.sumber || "",
    added_by: currentAdmin.username,
    edited_by: currentAdmin.username,
    updated_at: new Date().toISOString()
  };
  await putFileJson(`db/${letter}/${slug}.json`, record, `Tambah kata: ${entry.word}`, null);
  const { sha: idxSha, data: idxData } = await getFileJson(`index/${letter}.json`);
  const idx = idxData || [];
  idx.push({ slug, word: entry.word, meaning: entry.meaning });
  idx.sort((a, b) => a.word.localeCompare(b.word));
  await putFileJson(`index/${letter}.json`, idx, `Update index: tambah ${entry.word}`, idxSha);
  await logContribution(currentAdmin.username, { slug, letter, word: entry.word, action: "tambah" });
  return slug;
}
async function editWord(letter, slug, updates) {
  if (!currentAdmin) throw new Error("Harus login sebagai admin");
  const { sha, data } = await getFileJson(`db/${letter}/${slug}.json`);
  if (!data) throw new Error("Kata tidak ditemukan");
  const updated = {
    ...data,
    ...updates,
    edited_by: currentAdmin.username,
    updated_at: new Date().toISOString()
  };
  await putFileJson(`db/${letter}/${slug}.json`, updated, `Ubah kata: ${updated.word}`, sha);
  const { sha: idxSha, data: idxData } = await getFileJson(`index/${letter}.json`);
  if (idxData) {
    const idx = idxData.map(item =>
      item.slug === slug ? { ...item, word: updated.word, meaning: updated.meaning } : item
    );
    await putFileJson(`index/${letter}.json`, idx, `Update index: ubah ${updated.word}`, idxSha);
  }
  await logContribution(currentAdmin.username, { slug, letter, word: updated.word, action: "ubah" });
  return updated;
}
async function deleteWord(letter, slug) {
  if (!currentAdmin) throw new Error("Harus login sebagai admin");
  const sha = await getFileSha(`db/${letter}/${slug}.json`);
  if (!sha) throw new Error("Kata tidak ditemukan");
  await deleteFile(`db/${letter}/${slug}.json`, sha, `Hapus kata: ${slug}`);
  const { sha: idxSha, data: idxData } = await getFileJson(`index/${letter}.json`);
  if (idxData) {
    const idx = idxData.filter(item => item.slug !== slug);
    await putFileJson(`index/${letter}.json`, idx, `Update index: hapus ${slug}`, idxSha);
  }
}

/* ---------- 8b. RIWAYAT KATA --- */
async function fetchWordHistory(letter, slug) {
  const res = await fetch(
    `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/commits?path=db/${letter}/${slug}.json&sha=${CONFIG.branch}&per_page=30`
  );
  if (!res.ok) throw new Error("Gagal mengambil riwayat");
  return await res.json();
}
async function fetchWordVersionAtCommit(letter, slug, commitSha) {
  const res = await fetch(
    `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${commitSha}/db/${letter}/${slug}.json`
  );
  if (!res.ok) throw new Error("Versi tidak tersedia");
  return await res.json();
}
function formatTanggalRiwayat(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
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
  modal.innerHTML = `<div class="riwayat-modal-box"><div class="riwayat-modal-header"><h2>Riwayat: ${escapeHtml(word)}</h2><button type="button" id="riwayat-close">×</button></div><div id="riwayat-list">Memuat riwayat…</div></div>`;
  modal.style.display = "flex";
  modal.querySelector("#riwayat-close").addEventListener("click", () => { modal.style.display = "none"; });
  loadHistoryList(letter, slug);
}
async function loadHistoryList(letter, slug) {
  const listEl = document.getElementById("riwayat-list");
  if (!listEl) return;
  try {
    const commits = await fetchWordHistory(letter, slug);
    if (!commits.length) {
      listEl.innerHTML = "<p>Belum ada riwayat untuk kata ini.</p>";
      return;
    }
    listEl.innerHTML = commits.map((c, i) => {
      const isLatest = i === 0;
      const authorName = c.commit.author?.name || c.author?.login || "tidak diketahui";
      const dateStr = formatTanggalRiwayat(c.commit.author?.date);
      return `<div class="riwayat-item${isLatest ? " riwayat-current" : ""}"><strong>${escapeHtml(c.commit.message)}</strong><span class="riwayat-meta">oleh ${escapeHtml(authorName)} · ${escapeHtml(dateStr)}</span></div>`;
    }).join("");
  } catch (e) {
    listEl.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
  }
}

/* ---------- 8c. KONTRIBUSI ADMIN --- */
function contribPath(username) {
  return `contrib/${username}.json`;
}
async function fetchContributions(username) {
  const res = await fetch(rawUrl(contribPath(username)));
  if (!res.ok) return [];
  return await res.json();
}
async function fetchAdminByUsername(username) {
  const admins = await fetchAdmins();
  return admins.find(a => a.username === username) || null;
}
async function logContribution(username, entry) {
  try {
    const path = contribPath(username);
    const { sha, data } = await getFileJson(path);
    const list = data || [];
    list.unshift({ ...entry, at: new Date().toISOString() });
    await putFileJson(path, list, `Kontribusi: ${username}`, sha);
  } catch (e) {
    console.warn("Gagal mencatat kontribusi:", e.message);
  }
}

/* ---------- 9. RENDER --- */
function renderEntri(container, data, slug, letter) {
  container.innerHTML = `<div class="entri"><h1>${escapeHtml(data.word)}</h1><p>${escapeHtml(data.meaning)}</p></div>`;
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
