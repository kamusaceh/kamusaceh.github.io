// ===================== STATE =====================
let currentIndex = [];   // isi data/index.json (ringkas, buat daftar & pencarian)
let indexSha = null;

let formState = null;    // objek kata yang sedang diedit di form
let originalWordData = null; // snapshot data kata sebelum diedit (untuk undo)
let currentWordSha = null;   // sha file kata yang sedang dibuka (null = kata baru)

let actionStack = [];
let actionIdCounter = 0;

// ===================== UTIL =====================
function slugify(word){
  return word.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function uniqueSlug(base){
  const existing = new Set(currentIndex.map(e => e.slug));
  let slug = base || 'kata';
  let n = 2;
  while(existing.has(slug)){ slug = `${base}-${n++}`; }
  return slug;
}

function showStatus(elId, msg, type){
  const el = document.getElementById(elId);
  el.className = 'status ' + type;
  el.textContent = msg;
}

function newFormState(){
  return {
    _slug: null,
    word: '', pos: '', pronunciation: '', catatan: '',
    definitions: [{ arti: '', examples: [{ aceh: '', indonesia: '' }] }],
    sinonim: [], rujukan: []
  };
}

// ===================== KONEKSI & INDEKS =====================
async function connect(){
  const c = cfg();
  if(!c.owner || !c.repo){ showStatus('connectStatus', 'Owner dan repository wajib diisi.', 'err'); return; }
  showStatus('connectStatus', 'Menghubungkan...', 'info');
  try{
    await loadIndex();
    showStatus('connectStatus', `Terhubung ke ${c.owner}/${c.repo}@${c.branch}. ${currentIndex.length} kata dimuat.`, 'ok');
    newWord();
  }catch(e){
    showStatus('connectStatus', 'Gagal: ' + e.message, 'err');
  }
}

async function loadIndex(){
  const c = cfg();
  const path = `${c.dataPrefix}/index.json`;
  const file = await ghGetFile(c, path);
  if(file){ indexSha = file.sha; currentIndex = JSON.parse(fromBase64(file.content)); }
  else { indexSha = null; currentIndex = []; }
  renderList();
}

async function saveIndex(message){
  const c = cfg();
  const path = `${c.dataPrefix}/index.json`;
  const jsonStr = JSON.stringify(currentIndex, null, 2);
  const result = await ghPutFile(c, path, jsonStr, indexSha, message);
  indexSha = result.content.sha;
}

function renderList(){
  const q = (document.getElementById('search').value || '').toLowerCase();
  const listEl = document.getElementById('wordList');
  const filtered = currentIndex.filter(e => e.word.toLowerCase().includes(q));
  if(filtered.length === 0){
    listEl.innerHTML = '<div class="empty">Tidak ada kata yang cocok.</div>';
    return;
  }
  listEl.innerHTML = filtered
    .sort((a, b) => a.word.localeCompare(b.word))
    .map(e => `
      <div class="word-item" onclick="openWord('${e.slug}')">
        <span class="w-word">${escapeHtml(e.word)}</span>
        <span class="w-pos">${escapeHtml(e.pos || '')}</span>
        <span class="w-gloss">${escapeHtml(e.arti_singkat || '')}</span>
      </div>`)
    .join('');
}

// ===================== FORM (renderForm membaca formState) =====================
function renderForm(){
  document.getElementById('f_word').value = formState.word;
  document.getElementById('f_pos').value = formState.pos;
  document.getElementById('f_pron').value = formState.pronunciation;
  document.getElementById('f_catatan').value = formState.catatan;
  document.getElementById('f_sinonim').value = formState.sinonim.join(', ');
  document.getElementById('f_rujukan').value = formState.rujukan.join(', ');

  const box = document.getElementById('definitionsBox');
  box.innerHTML = formState.definitions.map((d, i) => `
    <div class="def-block">
      <div class="def-head">
        <span>Arti #${i + 1}</span>
        <button class="small-btn danger" onclick="removeDefinition(${i})">Hapus arti ini</button>
      </div>
      <div class="field">
        <label>Arti dalam Bahasa Indonesia</label>
        <input type="text" value="${escapeHtml(d.arti)}" oninput="updateDefField(${i}, 'arti', this.value)">
      </div>
      ${d.examples.map((ex, j) => `
        <div class="example-row">
          <div class="field">
            <label>Contoh (Aceh)</label>
            <input type="text" value="${escapeHtml(ex.aceh)}" oninput="updateExampleField(${i}, ${j}, 'aceh', this.value)">
          </div>
          <div class="field">
            <label>Terjemahan (Indonesia)</label>
            <input type="text" value="${escapeHtml(ex.indonesia)}" oninput="updateExampleField(${i}, ${j}, 'indonesia', this.value)">
          </div>
          <button class="small-btn" onclick="removeExample(${i}, ${j})">Hapus</button>
        </div>`).join('')}
      <button class="small-btn" onclick="addExample(${i})">+ Contoh kalimat</button>
    </div>`).join('');
}

function updateWordField(field, value){ formState[field] = value; }
function updateDefField(i, field, value){ formState.definitions[i][field] = value; }
function updateExampleField(i, j, field, value){ formState.definitions[i].examples[j][field] = value; }
function updateTagsField(field, value){ formState[field] = value.split(',').map(s => s.trim()).filter(Boolean); }

function addDefinition(){ formState.definitions.push({ arti: '', examples: [{ aceh: '', indonesia: '' }] }); renderForm(); }
function removeDefinition(i){
  formState.definitions.splice(i, 1);
  if(formState.definitions.length === 0) formState.definitions.push({ arti: '', examples: [{ aceh: '', indonesia: '' }] });
  renderForm();
}
function addExample(i){ formState.definitions[i].examples.push({ aceh: '', indonesia: '' }); renderForm(); }
function removeExample(i, j){
  formState.definitions[i].examples.splice(j, 1);
  if(formState.definitions[i].examples.length === 0) formState.definitions[i].examples.push({ aceh: '', indonesia: '' });
  renderForm();
}

function newWord(){
  formState = newFormState();
  currentWordSha = null;
  originalWordData = null;
  renderForm();
  document.getElementById('fileHistory').innerHTML = '<div class="empty">Kata baru — riwayat akan muncul setelah disimpan.</div>';
  document.getElementById('deleteBtn').style.display = 'none';
  document.getElementById('formStatus').className = 'status';
}

// ===================== BUKA / SIMPAN / HAPUS KATA =====================
async function openWord(slug){
  const c = cfg();
  const path = `${c.dataPrefix}/kata/${slug}.json`;
  showStatus('formStatus', 'Memuat kata...', 'info');
  try{
    const file = await ghGetFile(c, path);
    if(!file){ showStatus('formStatus', 'Kata tidak ditemukan di repo.', 'err'); return; }
    currentWordSha = file.sha;
    const data = JSON.parse(fromBase64(file.content));
    originalWordData = data;
    formState = JSON.parse(JSON.stringify(data));
    formState._slug = slug;
    renderForm();
    document.getElementById('deleteBtn').style.display = 'inline-block';
    document.getElementById('formStatus').className = 'status';
    loadWordHistory(slug);
  }catch(e){
    showStatus('formStatus', 'Gagal: ' + e.message, 'err');
  }
}

async function saveWord(){
  const c = cfg();
  if(!c.token){ showStatus('formStatus', 'Token wajib diisi.', 'err'); return; }
  if(!formState.word.trim()){ showStatus('formStatus', 'Kata (headword) wajib diisi.', 'err'); return; }

  const isNew = !formState._slug;
  const slug = isNew ? uniqueSlug(slugify(formState.word)) : formState._slug;
  const path = `${c.dataPrefix}/kata/${slug}.json`;

  const dataToSave = {
    word: formState.word.trim(),
    pos: formState.pos.trim(),
    pronunciation: formState.pronunciation.trim(),
    definitions: formState.definitions
      .filter(d => d.arti.trim())
      .map(d => ({
        arti: d.arti.trim(),
        examples: d.examples.filter(e => e.aceh.trim() || e.indonesia.trim())
      })),
    sinonim: formState.sinonim,
    rujukan: formState.rujukan,
    catatan: formState.catatan.trim()
  };

  const jsonStr = JSON.stringify(dataToSave, null, 2);
  const message = isNew ? `Tambah kata: ${dataToSave.word}` : `Update kata: ${dataToSave.word}`;
  const preSaveOriginal = originalWordData; // untuk undo, kalau ini update
  const prevIndexSnapshot = JSON.parse(JSON.stringify(currentIndex));

  showStatus('formStatus', isNew ? 'Menambah kata...' : 'Menyimpan perubahan...', 'info');
  try{
    const result = await ghPutFile(c, path, jsonStr, currentWordSha, message);
    const newSha = result.content.sha;

    const glossSingkat = dataToSave.definitions[0] ? dataToSave.definitions[0].arti : '';
    const idxEntry = currentIndex.find(e => e.slug === slug);
    if(idxEntry){ idxEntry.word = dataToSave.word; idxEntry.pos = dataToSave.pos; idxEntry.arti_singkat = glossSingkat; }
    else{ currentIndex.push({ slug, word: dataToSave.word, pos: dataToSave.pos, arti_singkat: glossSingkat }); }
    await saveIndex(`${isNew ? 'Tambah' : 'Update'} indeks: ${dataToSave.word}`);

    currentWordSha = newSha;
    originalWordData = dataToSave;
    formState._slug = slug;
    document.getElementById('deleteBtn').style.display = 'inline-block';

    showStatus('formStatus', 'Berhasil disimpan.', 'ok');
    renderList();
    loadWordHistory(slug);

    pushAction(isNew ? `Tambah kata "${dataToSave.word}"` : `Update kata "${dataToSave.word}"`, async () => {
      const cc = cfg();
      if(isNew){
        await ghDeleteFile(cc, path, newSha, `Undo: batalkan penambahan kata ${dataToSave.word}`);
      }else{
        const restoreStr = JSON.stringify(preSaveOriginal, null, 2);
        const r = await ghPutFile(cc, path, restoreStr, newSha, `Undo: kembalikan kata ${dataToSave.word}`);
        if(formState && formState._slug === slug){
          currentWordSha = r.content.sha;
          originalWordData = preSaveOriginal;
        }
      }
      currentIndex = prevIndexSnapshot;
      await saveIndex(`Undo: kembalikan indeks ${dataToSave.word}`);
      renderList();
      if(formState && formState._slug === slug) openWord(isNew ? slug : slug);
    });
  }catch(e){
    showStatus('formStatus', 'Gagal: ' + e.message + (String(e.message).includes('409') ? '\nKemungkinan file berubah di server sejak terakhir dibuka. Buka ulang kata ini lalu coba lagi.' : ''), 'err');
  }
}

async function deleteWord(){
  if(!formState || !formState._slug) return;
  const c = cfg();
  if(!confirm(`Yakin hapus kata "${formState.word}"? Aksi ini masih bisa di-undo lewat riwayat aksi sesi.`)) return;

  const slug = formState._slug;
  const path = `${c.dataPrefix}/kata/${slug}.json`;
  const contentBefore = JSON.stringify(originalWordData, null, 2);
  const wordLabel = originalWordData.word;
  const prevIndexSnapshot = JSON.parse(JSON.stringify(currentIndex));

  showStatus('formStatus', 'Menghapus kata...', 'info');
  try{
    await ghDeleteFile(c, path, currentWordSha, `Hapus kata: ${wordLabel}`);
    currentIndex = currentIndex.filter(e => e.slug !== slug);
    await saveIndex(`Update indeks: hapus ${wordLabel}`);

    showStatus('formStatus', 'Kata berhasil dihapus.', 'ok');
    renderList();
    newWord();

    pushAction(`Hapus kata "${wordLabel}"`, async () => {
      const cc = cfg();
      await ghPutFile(cc, path, contentBefore, null, `Undo: buat ulang kata ${wordLabel}`);
      currentIndex = prevIndexSnapshot;
      await saveIndex(`Undo: kembalikan indeks ${wordLabel}`);
      renderList();
    });
  }catch(e){
    showStatus('formStatus', 'Gagal: ' + e.message, 'err');
  }
}

// ===================== RIWAYAT PER KATA (commit Git + diff) =====================
async function loadWordHistory(slug){
  const c = cfg();
  const path = `${c.dataPrefix}/kata/${slug}.json`;
  const box = document.getElementById('fileHistory');
  box.innerHTML = '<div class="empty">Memuat riwayat commit...</div>';

  try{
    const commits = await ghListCommits(c, path);
    if(commits.length === 0){ box.innerHTML = '<div class="empty">Belum ada riwayat commit untuk kata ini.</div>'; return; }

    box.innerHTML = commits.map((cm, idx) => {
      const msg = (cm.commit.message || '').split('\n')[0];
      const author = cm.commit.author ? cm.commit.author.name : 'unknown';
      const date = cm.commit.author ? new Date(cm.commit.author.date).toLocaleString('id-ID') : '';
      const sha7 = cm.sha.slice(0, 7);
      const prevSha = idx < commits.length - 1 ? commits[idx + 1].sha : '';
      const boxId = `diffBox_${cm.sha}`;
      return `<div class="history-item">
        <div class="history-meta">
          <span class="history-time">${date}</span>
          <span class="history-label">${escapeHtml(msg)} — <span class="muted">${escapeHtml(author)}</span></span>
        </div>
        <button class="diff-toggle-btn" data-sha="${cm.sha}" data-prev="${prevSha}" data-box="${boxId}">${prevSha ? 'Lihat perubahan' : 'Lihat versi awal'}</button>
        <a href="${cm.html_url}" target="_blank" rel="noopener" class="sha-link">${sha7}</a>
      </div>
      <div id="${boxId}" class="diff-box"></div>`;
    }).join('');

    document.querySelectorAll('#fileHistory .diff-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleWordDiff(btn.dataset.sha, btn.dataset.prev || null, path, btn.dataset.box));
    });
  }catch(e){
    box.innerHTML = `<div class="empty">Error: ${escapeHtml(e.message)}</div>`;
  }
}

async function toggleWordDiff(sha, prevSha, path, boxId){
  const box = document.getElementById(boxId);
  if(box.classList.contains('show')){ box.classList.remove('show'); return; }
  box.classList.add('show');
  box.innerHTML = '<pre class="diff-pre">Memuat diff...</pre>';

  const c = cfg();
  try{
    const [newStr, oldStr] = await Promise.all([
      ghTextAtRef(c, path, sha),
      prevSha ? ghTextAtRef(c, path, prevSha) : Promise.resolve('')
    ]);
    const diffArr = computeLineDiff(oldStr, newStr);
    box.innerHTML = `<pre class="diff-pre">${renderDiffHtml(diffArr)}</pre>`;
  }catch(e){
    box.innerHTML = `<pre class="diff-pre">Gagal memuat diff: ${escapeHtml(e.message)}</pre>`;
  }
}

// ===================== RIWAYAT AKSI SESI (undo) =====================
function pushAction(label, undoFn){
  actionStack.unshift({ id: ++actionIdCounter, time: new Date(), label, undoFn, undone: false });
  if(actionStack.length > 50) actionStack.pop();
  renderActions();
}

function renderActions(){
  const box = document.getElementById('actionList');
  if(actionStack.length === 0){
    box.innerHTML = '<div class="empty">Belum ada aksi.</div>';
    return;
  }
  box.innerHTML = actionStack.map(a => {
    const time = a.time.toLocaleTimeString('id-ID');
    let right;
    if(a.undone) right = '<span class="history-undone">Sudah di-undo</span>';
    else right = `<button onclick="runActionUndo(${a.id})">Undo</button>`;
    return `<div class="history-item">
      <div class="history-meta"><span class="history-time">${time}</span><span class="history-label">${escapeHtml(a.label)}</span></div>
      ${right}
    </div>`;
  }).join('');
}

function clearActions(){ actionStack = []; renderActions(); }

async function runActionUndo(id){
  const entry = actionStack.find(a => a.id === id);
  if(!entry || entry.undone) return;
  showStatus('formStatus', `Menjalankan undo: ${entry.label}...`, 'info');
  try{
    await entry.undoFn();
    entry.undone = true;
    showStatus('formStatus', `Undo berhasil: ${entry.label}`, 'ok');
  }catch(e){
    showStatus('formStatus', `Gagal undo (${entry.label}): ${e.message}`, 'err');
  }
  renderActions();
}

// ===================== INIT =====================
window.addEventListener('load', () => {
  formState = newFormState();
  renderForm();
  renderActions();
});
