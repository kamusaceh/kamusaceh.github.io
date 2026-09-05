/* ==========================================================
   kamus.js — logika inti bersama untuk Kamus Bahasa Acèh
   Dipakai oleh: homepage.html, entri.html, setup.html
   ========================================================== */

/* ---------- 1. KONFIGURASI (hardcode di sini, admin tidak lihat) --- */
const CONFIG = {
  owner: "kamusaceh",
  repo: "kamusaceh.github.io",
  branch: "main",
  // URL Apps Script (action=token) — disalin otomatis dari setup.html saat setup dijalankan.
  tokenApiUrl: "https://script.google.com/macros/s/AKfycbyX4P3PzXC2zN6wmF1Su5TepkdRl5jPSLf9PWB0HQfKWvriyEDq0ZnO-2UTRSUou8FG/exec",
  // Sumber baca publik (tanpa token, tanpa rate limit ketat)
  cdnBase: (owner, repo, branch) =>
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/`
};

/* ---------- 2. UTIL: slug & huruf ---------------------------------- */

// Buang diakritik (é, è, ê, ë, dst) supaya jadi huruf dasar ascii
function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(word) {
  let s = stripDiacritics(word.toLowerCase().trim());
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "kata";
}

// Huruf awal untuk sharding index/db (huruf dasar, a-z)
function firstLetter(word) {
  const s = stripDiacritics(word.toLowerCase().trim());
  const m = s.match(/[a-z]/);
  return m ? m[0] : "misc";
}

/* ---------- 3. BACA DATA PUBLIK (tanpa token) ---------------------- */

function rawUrl(path) {
  // pakai raw.githubusercontent supaya selalu versi terbaru (jsDelivr bisa cache)
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

/* ---------- 4. HASH PASSWORD (SHA-256, di browser) ------------------ */

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- 5. LOGIN ADMIN (client-side, cocokkan ke auth/admins.json) */

let currentAdmin = null; // { username, nama } — hanya di memori, hilang saat refresh

async function loginAdmin(username, password) {
  const admins = await fetchAdmins();
  const hash = await sha256Hex(password);
  const found = admins.find(a => a.username === username && a.hash === hash);
  if (found) {
    currentAdmin = { username: found.username, nama: found.nama };
    return true;
  }
  return false;
}

function logoutAdmin() {
  currentAdmin = null;
}

/* ---------- 6. TOKEN GITHUB (dari Apps Script) ---------------------- */

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

/* ---------- 7. OPERASI TULIS KE GITHUB (contents API) ---------------- */

function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str)));
}

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

// Ambil sha file (kalau ada). null kalau file belum ada.
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

// Buat/update file JSON
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
    throw new Error(`Gagal hapus ${path}: ${err.message || res.status}`);
  }
}

/* ---------- 8. CRUD KATA (dipakai homepage.html untuk form admin) --- */

// Cari slug yang belum dipakai (tabrakan → tambah angka: manoe-2, manoe-3, ...)
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

  // update index/<letter>.json
  const { sha: idxSha, data: idxData } = await getFileJson(`index/${letter}.json`);
  const idx = idxData || [];
  idx.push({ slug, word: entry.word, meaning: entry.meaning });
  idx.sort((a, b) => a.word.localeCompare(b.word));
  await putFileJson(`index/${letter}.json`, idx, `Update index: tambah ${entry.word}`, idxSha);

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

  // sinkronkan meaning di index kalau berubah
  const { sha: idxSha, data: idxData } = await getFileJson(`index/${letter}.json`);
  if (idxData) {
    const idx = idxData.map(item =>
      item.slug === slug ? { ...item, word: updated.word, meaning: updated.meaning } : item
    );
    await putFileJson(`index/${letter}.json`, idx, `Update index: ubah ${updated.word}`, idxSha);
  }
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

/* ---------- 9. RENDER HALAMAN ENTRI (dipakai homepage.html & entri.html) */

function renderEntri(container, data, slug, letter) {
  const examplesHtml = (data.examples || [])
    .map(
      (ex, i) => `
      <div class="contoh">
        <span class="no">${String(i + 1).padStart(2, "0")}</span>
        <div>
          <p class="aceh">"${escapeHtml(ex.aceh)}"</p>
          <p class="indo">${escapeHtml(ex.indo)}</p>
        </div>
      </div>`
    )
    .join("");

  const rujukanHtml = (data.rujukan || [])
    .map(r => `<a href="/entri/${r}" class="rujukan-chip" data-slug="${r}">${r}</a>`)
    .join(" ");

  const adminHtml = currentAdmin
    ? `
    <div class="admin-bar">
      <a href="https://github.com/${CONFIG.owner}/${CONFIG.repo}/commits/${CONFIG.branch}/db/${letter}/${slug}.json"
         target="_blank" rel="noopener">Riwayat Kata</a>
      <button data-action="ubah">Ubah</button>
      <button data-action="hapus">Hapus</button>
    </div>`
    : "";

  container.innerHTML = `
    <div class="entri" data-letter="${letter}" data-slug="${slug}">
      <h1>${escapeHtml(data.word)} <span class="pos">${escapeHtml(data.pos || "")}</span></h1>
      <p class="meaning">${escapeHtml(data.meaning)}</p>
      ${examplesHtml ? `<h2>Contoh Kalimat</h2>${examplesHtml}` : ""}
      ${rujukanHtml ? `<h2>Lihat juga</h2><div class="rujukan-list">${rujukanHtml}</div>` : ""}
      ${data.sumber ? `<h2>Sumber / Referensi</h2><p class="sumber">${escapeHtml(data.sumber)}</p>` : ""}
      ${data.added_by ? `<p class="meta">Ditambah oleh ${escapeHtml(data.added_by)}${data.edited_by && data.edited_by !== data.added_by ? `, terakhir diubah oleh ${escapeHtml(data.edited_by)}` : ""}</p>` : ""}
      ${adminHtml}
    </div>`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
