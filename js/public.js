// ===================== KONFIGURASI SITUS PUBLIK =====================
// Diisi sekali sesuai repo tempat data kamus disimpan — pengunjung tidak
// perlu mengisi apa pun, beda dengan admin.html yang perlu token.
const SITE = {
  owner: 'kamusaceh',
  repo: 'kamusaceh.github.io',
  branch: 'main',
  dataPrefix: 'data',
  // Kalau situs ini dihosting di GitHub Pages sebagai project page
  // (bukan <owner>.github.io), isi basePath dengan "/nama-repo".
  basePath: ''
};

function rawUrl(path){
  return `https://raw.githubusercontent.com/${SITE.owner}/${SITE.repo}/${SITE.branch}/${path}`;
}

async function fetchJsonPublic(path){
  const res = await fetch(rawUrl(path), { cache: 'no-store' });
  if(!res.ok) throw new Error(res.status === 404 ? 'Tidak ditemukan' : ('Gagal memuat (' + res.status + ')'));
  return res.json();
}

function escapeHtmlPublic(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===================== ROUTING =====================
function stripBase(pathname){
  if(SITE.basePath && pathname.startsWith(SITE.basePath)) return pathname.slice(SITE.basePath.length) || '/';
  return pathname;
}

function currentSlug(){
  const p = stripBase(location.pathname);
  const m = p.match(/^\/entri\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function navigate(path){
  history.pushState(null, '', SITE.basePath + path);
  route();
}

function goHome(e){
  if(e) e.preventDefault();
  navigate('/');
  return false;
}

window.addEventListener('popstate', route);

async function route(){
  const slug = currentSlug();
  if(slug) await renderEntry(slug);
  else await renderListView();
}

// ===================== TAMPILAN DAFTAR + PENCARIAN =====================
let cachedIndex = null;

const HOME_WORD_LIMIT = 5;

async function renderListView(){
  const content = document.getElementById('content');
  document.title = 'Kamus Aceh–Indonesia';
  content.innerHTML = `
    <div class="card">
      <input type="text" id="publicSearch" placeholder="Cari kata Aceh atau arti Indonesia...">
      <div id="publicCount" class="muted" style="margin-top:6px;"></div>
    </div>
    <div class="card list-card">
      <div id="publicWordList" class="word-list"><div class="empty">Memuat daftar kata...</div></div>
    </div>`;

  document.getElementById('publicSearch').addEventListener('input', (e) => renderPublicList(e.target.value));

  try{
    if(!cachedIndex) cachedIndex = await fetchJsonPublic(`${SITE.dataPrefix}/index.json`);
    document.getElementById('publicCount').textContent = `${cachedIndex.length} kata dalam kamus`;
    renderPublicList('');
  }catch(e){
    document.getElementById('publicWordList').innerHTML = `<div class="empty">Gagal memuat daftar kata: ${escapeHtmlPublic(e.message)}</div>`;
  }
}

function renderPublicList(query){
  const q = (query || '').toLowerCase();
  const listEl = document.getElementById('publicWordList');
  const isSearching = q.length > 0;

  const filtered = cachedIndex.filter(e =>
    e.word.toLowerCase().includes(q) || (e.arti_singkat || '').toLowerCase().includes(q)
  );

  if(filtered.length === 0){
    listEl.innerHTML = '<div class="empty">Tidak ada kata yang cocok.</div>';
    return;
  }

  const sorted = filtered.sort((a, b) => a.word.localeCompare(b.word));
  // Beranda (tanpa pencarian): cukup tampilkan beberapa kata saja, bukan semua ribuan entri.
  const toShow = isSearching ? sorted : sorted.slice(0, HOME_WORD_LIMIT);

  listEl.innerHTML = toShow
    .map(e => `
      <div class="word-item" onclick="navigate('/entri/${encodeURIComponent(e.slug)}')">
        <span class="w-word">${escapeHtmlPublic(e.word)}</span>
        <span class="w-pos">${escapeHtmlPublic(e.pos || '')}</span>
        <span class="w-gloss">${escapeHtmlPublic(e.arti_singkat || '')}</span>
      </div>`)
    .join('') + (!isSearching && sorted.length > HOME_WORD_LIMIT
      ? `<div class="empty" style="text-align:left;">Menampilkan ${HOME_WORD_LIMIT} dari ${sorted.length} kata. Ketik di kotak pencarian untuk melihat kata lainnya.</div>`
      : '');
}

// ===================== TAMPILAN SATU ENTRI KATA =====================
async function renderEntry(slug){
  const content = document.getElementById('content');
  content.innerHTML = '<div class="card"><div class="empty">Memuat kata...</div></div>';

  try{
    const data = await fetchJsonPublic(`${SITE.dataPrefix}/kata/${slug}.json`);
    document.title = `${data.word} — Kamus Aceh–Indonesia`;

    const EX_LIMIT = 5;
    const defsHtml = (data.definitions || []).map((d, i) => {
      const examples = d.examples || [];
      const shown = examples.slice(0, EX_LIMIT);
      const rest = examples.slice(EX_LIMIT);
      const exampleHtml = (ex) => `
          <div class="example">
            <div class="example-aceh">${escapeHtmlPublic(ex.aceh)}</div>
            <div class="example-id">${escapeHtmlPublic(ex.indonesia)}</div>
          </div>`;
      const boxId = `moreEx_${i}`;
      return `
      <div class="entry-def">
        <div class="entry-def-num">${i + 1}. ${escapeHtmlPublic(d.arti)}</div>
        ${shown.map(exampleHtml).join('')}
        ${rest.length ? `
          <div id="${boxId}" style="display:none;">${rest.map(exampleHtml).join('')}</div>
          <button class="small-btn" onclick="const b=document.getElementById('${boxId}'); const shown=b.style.display!=='none'; b.style.display=shown?'none':'block'; this.textContent=shown?'Lihat semua contoh (${examples.length})':'Sembunyikan sebagian contoh';">Lihat semua contoh (${examples.length})</button>
        ` : ''}
      </div>`;
    }).join('');

    const tagsHtml = (arr) => (arr || []).map(t => `<span class="tag">${escapeHtmlPublic(t)}</span>`).join('');

    content.innerHTML = `
      <div class="card">
        <a href="/" onclick="return goHome(event)" class="sha-link">← Kembali ke daftar</a>
        <h2 class="entry-title">${escapeHtmlPublic(data.word)} ${data.pos ? `<span class="entry-pos">${escapeHtmlPublic(data.pos)}</span>` : ''}</h2>
        ${data.pronunciation ? `<div class="entry-pron">${escapeHtmlPublic(data.pronunciation)}</div>` : ''}
        ${defsHtml || '<div class="empty">Belum ada arti.</div>'}
        ${data.sinonim && data.sinonim.length ? `<div class="field"><label>Sinonim</label>${tagsHtml(data.sinonim)}</div>` : ''}
        ${data.rujukan && data.rujukan.length ? `<div class="field"><label>Rujukan</label>${tagsHtml(data.rujukan)}</div>` : ''}
        ${data.catatan ? `<div class="field"><label>Catatan</label><p>${escapeHtmlPublic(data.catatan)}</p></div>` : ''}
      </div>`;
  }catch(e){
    content.innerHTML = `
      <div class="card">
        <a href="/" onclick="return goHome(event)" class="sha-link">← Kembali ke daftar</a>
        <div class="empty">Kata "${escapeHtmlPublic(slug)}" tidak ditemukan.</div>
      </div>`;
  }
}

// ===================== INIT (baca redirect dari 404.html, lalu route) =====================
window.addEventListener('load', () => {
  const redirect = sessionStorage.getItem('redirectPath');
  if(redirect){
    sessionStorage.removeItem('redirectPath');
    if(redirect !== location.pathname + location.search + location.hash){
      history.replaceState(null, '', redirect);
    }
  }
  route();
});
