/* ==========================================================
   kamus.js — logika inti bersama untuk Kamus Bahasa Acèh
   Dipakai oleh: homepage.html, entri.html, setup.html
   ========================================================== */

/* ---------- 1. KONFIGURASI (hardcode di sini, admin tidak lihat) --- */
const CONFIG = {
  owner: "kamusaceh",
  repo: "kamusaceh.github.io",
  branch: "main",
  // Ganti dengan URL Apps Script (action=token) milik Anda sendiri.
  // JANGAN taruh token GitHub asli di sini — hanya URL endpoint-nya.
  tokenApiUrl: "https://script.google.com/macros/s/GANTI_DENGAN_ID_APPS_SCRIPT_ANDA/exec",
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

let currentAdmin = null; // { username, nama } — dipulihkan dari localStorage saat halaman dibuka
const SESSION_KEY = "kamus_admin_session";

function saveSession(admin, hash) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: admin.username, nama: admin.nama, hash }));
  } catch (e) {
    // localStorage tidak tersedia (mis. mode private/incognito ketat) — login tetap jalan, hanya tidak persist
  }
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

// Panggil sekali saat halaman dimuat: coba pulihkan sesi admin dari localStorage,
// lalu cek ulang ke auth/admins.json supaya kalau password sudah diganti / akun
// dihapus, sesi lama otomatis tidak berlaku lagi.
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
    clearSession(); // password/akun berubah — sesi lama tidak valid lagi
    return null;
  } catch (e) {
    // gagal cek (mis. sedang offline) — tetap pakai sesi lama sementara daripada paksa logout
    currentAdmin = { username: saved.username, nama: saved.nama };
    return currentAdmin;
  }
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

  // sinkronkan meaning di index kalau berubah
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

/* ---------- 8b. RIWAYAT KATA (gaya Wikipedia, publik baca, admin bisa pulihkan) --- */

// Daftar commit untuk satu file kata (publik, tidak perlu token — endpoint baca GitHub)
async function fetchWordHistory(letter, slug) {
  const res = await fetch(
    `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/commits?path=db/${letter}/${slug}.json&sha=${CONFIG.branch}&per_page=30`
  );
  if (!res.ok) throw new Error("Gagal mengambil riwayat (kemungkinan batas rate GitHub tercapai, coba lagi nanti)");
  return await res.json();
}

// Isi kata pada satu titik commit tertentu (publik, baca file mentah di commit itu)
async function fetchWordVersionAtCommit(letter, slug, commitSha) {
  const res = await fetch(
    `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${commitSha}/db/${letter}/${slug}.json`
  );
  if (!res.ok) throw new Error("Versi ini tidak tersedia (kata mungkin belum ada / sedang terhapus saat itu)");
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
    if (!commits.length) {
      listEl.innerHTML = "<p>Belum ada riwayat untuk kata ini.</p>";
      return;
    }
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
        } catch (e) {
          previewEl.textContent = e.message;
        }
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
  const currentSha = await getFileSha(`db/${letter}/${slug}.json`); // null kalau kata sedang dalam status terhapus

  const restored = {
    ...oldData,
    edited_by: currentAdmin.username,
    updated_at: new Date().toISOString()
  };

  await putFileJson(
    `db/${letter}/${slug}.json`,
    restored,
    `Pulihkan kata: ${restored.word} (dari commit ${commitSha.slice(0, 7)})`,
    currentSha
  );

  // sinkronkan index/<letter>.json (tambahkan lagi kalau sebelumnya terhapus, atau update meaning-nya)
  const { sha: idxSha, data: idxData } = await getFileJson(`index/${letter}.json`);
  let idx = idxData || [];
  const exists = idx.some(item => item.slug === slug);
  if (exists) {
    idx = idx.map(item => (item.slug === slug ? { ...item, word: restored.word, meaning: restored.meaning } : item));
  } else {
    idx.push({ slug, word: restored.word, meaning: restored.meaning });
    idx.sort((a, b) => a.word.localeCompare(b.word));
  }
  await putFileJson(`index/${letter}.json`, idx, `Update index: pulihkan ${restored.word}`, idxSha);

  await logContribution(currentAdmin.username, { slug, letter, word: restored.word, action: "pulihkan" });

  return restored;
}

/* ---------- 8c. KONTRIBUSI ADMIN (dipakai kontributor.html, publik bisa lihat) --- */

function contribPath(username) {
  return `contrib/${username}.json`;
}

// Baca publik, tanpa token — sama seperti data kata lain
async function fetchContributions(username) {
  const res = await fetch(rawUrl(contribPath(username)));
  if (!res.ok) return [];
  return await res.json();
}

async function fetchAdminByUsername(username) {
  const admins = await fetchAdmins();
  return admins.find(a => a.username === username) || null;
}

// Mencatat satu aksi (tambah/ubah/pulihkan) ke riwayat kontribusi admin.
// Sengaja tidak melempar error kalau gagal — mencatat kontribusi tidak boleh
// menggagalkan aksi utama pada kata itu sendiri.
async function logContribution(username, entry) {
  try {
    const path = contribPath(username);
    const { sha, data } = await getFileJson(path);
    const list = data || [];
    list.unshift({ ...entry, at: new Date().toISOString() });
    await putFileJson(path, list, `Kontribusi: ${username} ${entry.action} ${entry.word}`, sha);
  } catch (e) {
    console.warn("Gagal mencatat kontribusi:", e.message);
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

  // Riwayat kata: tombol yang buka panel riwayat di dalam halaman (bukan link keluar ke GitHub)
  const riwayatHtml = `<button type="button" class="riwayat-link" data-action="riwayat">Riwayat Kata</button>`;

  // Tombol Ubah/Hapus: hanya untuk admin yang sudah login
  const adminHtml = currentAdmin
    ? `
    <div class="admin-bar">
      <button data-action="ubah">Ubah</button>
      <button data-action="hapus">Hapus</button>
    </div>`
    : "";

  container.innerHTML = `
    <div class="entri" data-letter="${letter}" data-slug="${slug}" data-word="${escapeHtml(data.word)}">
      <h1>${escapeHtml(data.word)} <span class="pos">${escapeHtml(data.pos || "")}</span></h1>
      <p class="meaning">${escapeHtml(data.meaning)}</p>
      ${examplesHtml ? `<h2>Contoh Kalimat</h2>${examplesHtml}` : ""}
      ${rujukanHtml ? `<h2>Lihat juga</h2><div class="rujukan-list">${rujukanHtml}</div>` : ""}
      ${data.sumber ? `<h2>Sumber / Referensi</h2><p class="sumber">${escapeHtml(data.sumber)}</p>` : ""}
      ${data.added_by ? `<p class="meta">Ditambah oleh <a class="profil-link" href="/kontributor/${data.added_by}">${escapeHtml(data.added_by)}</a>${data.edited_by && data.edited_by !== data.added_by ? `, terakhir diubah oleh <a class="profil-link" href="/kontributor/${data.edited_by}">${escapeHtml(data.edited_by)}</a>` : ""}</p>` : ""}
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

/* ---------- 10. RENDER HALAMAN KONTRIBUTOR (publik, dipakai kontributor.html) --- */

const AKSI_LABEL = { tambah: "menambahkan", ubah: "mengubah", pulihkan: "memulihkan" };

function renderProfil(container, admin, contributions) {
  const ditambah = contributions.filter(c => c.action === "tambah");
  const lainnya = contributions.filter(c => c.action !== "tambah");

  const rows = contributions.length
    ? contributions.map(c => `
      <div class="kontrib-item">
        <a href="/entri/${c.slug}" class="kontrib-word">${escapeHtml(c.word)}</a>
        <span class="kontrib-action kontrib-${c.action}">${AKSI_LABEL[c.action] || c.action}</span>
        <span class="kontrib-date">${formatTanggalRiwayat(c.at)}</span>
      </div>`).join("")
    : "<p>Belum ada kontribusi.</p>";

  container.innerHTML = `
    <div class="profil">
      <h1>${escapeHtml(admin.nama)}</h1>
      <p class="profil-username">@${escapeHtml(admin.username)}</p>
      <div class="profil-stats">
        <div class="stat"><strong>${contributions.length}</strong><span>Total kontribusi</span></div>
        <div class="stat"><strong>${ditambah.length}</strong><span>Kata ditambah</span></div>
        <div class="stat"><strong>${lainnya.length}</strong><span>Kata diubah/dipulihkan</span></div>
      </div>
      <h2>Riwayat Kontribusi</h2>
      <div class="kontrib-list">${rows}</div>
    </div>`;
}
