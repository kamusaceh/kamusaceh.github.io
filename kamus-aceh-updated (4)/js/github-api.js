// ===== Konfigurasi & helper dasar =====
function cfg(){
  return {
    token: document.getElementById('token').value.trim(),
    owner: document.getElementById('owner').value.trim(),
    repo: document.getElementById('repo').value.trim(),
    branch: document.getElementById('branch').value.trim() || 'main',
    dataPrefix: (document.getElementById('dataPrefix').value.trim() || 'data').replace(/\/+$/,'')
  };
}

function authHeaders(c){
  const h = {'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(c.token) h['Authorization'] = `Bearer ${c.token}`;
  return h;
}

function toBase64(str){ return btoa(unescape(encodeURIComponent(str))); }
function fromBase64(b64){ return decodeURIComponent(escape(atob(b64.replace(/\n/g,'')))); }

// ===== Contents API =====
// Ambil satu file. Mengembalikan null kalau belum ada (404), bukan error.
async function ghGetFile(c, path, ref){
  const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}?ref=${encodeURIComponent(ref || c.branch)}`;
  const res = await fetch(url, { headers: authHeaders(c) });
  if(res.status === 404) return null;
  const data = await res.json();
  if(!res.ok) throw new Error(data.message || ('Gagal mengambil file: ' + path));
  if(Array.isArray(data)) throw new Error(path + ' adalah folder, bukan file.');
  return data; // { sha, content(base64), ... }
}

async function ghPutFile(c, path, contentStr, sha, message){
  const body = { message, content: toBase64(contentStr), branch: c.branch };
  if(sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(c), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.message || ('Gagal menyimpan: ' + path));
  return data;
}

async function ghDeleteFile(c, path, sha, message){
  const res = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders(c), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: c.branch })
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.message || ('Gagal menghapus: ' + path));
  return data;
}

// ===== Commits API (riwayat per file) =====
async function ghListCommits(c, path){
  const url = `https://api.github.com/repos/${c.owner}/${c.repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(c.branch)}&per_page=20`;
  const res = await fetch(url, { headers: authHeaders(c) });
  const data = await res.json();
  if(!res.ok) throw new Error(data.message || 'Gagal mengambil riwayat commit');
  return data;
}

// Ambil isi teks file pada commit/ref tertentu. File belum ada di ref itu -> string kosong.
async function ghTextAtRef(c, path, ref){
  const file = await ghGetFile(c, path, ref);
  return file ? fromBase64(file.content) : '';
}
