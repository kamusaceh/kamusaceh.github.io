"use strict";

const CFG=window.KAMUS_CONFIG||{};

const API=
  "https://api.github.com/repos/"+
  CFG.owner+"/"+CFG.repo;

const BRANCH=CFG.branch||"main";

let ENTRIES=[];
let IS_ADMIN=false;
let CURRENT_EDIT=null;

const $=id=>document.getElementById(id);

function esc(value){
  return String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function slugify(text){
  return String(text||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,80)||"kata";
}

function shardKey(id){
  const first=String(id||"a").charAt(0).toLowerCase();
  return /[a-z]/.test(first)?first:"0";
}

async function sha256(text){
  const data=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(hash)]
    .map(b=>b.toString(16).padStart(2,"0"))
    .join("");
}

function authHeaders(){
  const h={
    "Accept":"application/vnd.github+json"
  };
  
 if(CFG.token){
  h.Authorization="Bearer "+CFG.token;
}

  return h;
}

async function api(path,options={}){
  const response=await fetch(API+path,{
    ...options,
    headers:{
      ...authHeaders(),
      ...(options.headers||{})
    }
  });

  const text=await response.text();

  let data=null;

  try{
    data=text?JSON.parse(text):null;
  }catch{
    data=text;
  }

  if(!response.ok){
    throw new Error(
      data&&data.message
      ?data.message
      :response.status+" "+response.statusText
    );
  }

  return data;
}

async function loadJSON(path){

  const url=
    "https://raw.githubusercontent.com/"+
    CFG.owner+"/"+CFG.repo+"/"+BRANCH+"/"+path+
    "?t="+Date.now();

  const response=await fetch(url);

  if(!response.ok){
    throw new Error(path+" tidak ditemukan");
  }

  return response.json();
}

async function loadUsers(){

  const url=
    "https://raw.githubusercontent.com/"+
    CFG.owner+"/"+CFG.repo+"/"+BRANCH+
    "/users/users.txt?t="+Date.now();

  const response=await fetch(url);

  if(!response.ok) return [];

  const text=await response.text();

  return text
    .split(/\r?\n/)
    .map(x=>x.trim())
    .filter(Boolean)
    .map(line=>{
      const p=line.split(":");
      return {
        username:p[0],
        hash:p.slice(1).join(":")
      };
    });
}

async function login(){

  if(!CFG.token){
    alert(
      "Login admin membutuhkan token pada config/app-config.js.\n"+
      "Setup harus dibuat dengan opsi simpan token."
    );
    return;
  }

  const username=prompt("Username admin:");

  if(!username) return;

  const password=prompt("Password:");

  if(password===null) return;

  const users=await loadUsers();
  const hash=await sha256(password);

  const found=users.find(
    u=>u.username===username && u.hash===hash
  );

  if(!found){
    alert("Username atau password salah.");
    return;
  }

  sessionStorage.setItem(
    "kamus_admin",
    JSON.stringify({
      username,
      loginAt:Date.now()
    })
  );

  IS_ADMIN=true;

  renderAuth();
  render();

  alert("Login berhasil.");
}

function logout(){

  sessionStorage.removeItem("kamus_admin");

  IS_ADMIN=false;

  renderAuth();
  render();
}

function restoreSession(){

  try{
    const data=
      JSON.parse(
        sessionStorage.getItem("kamus_admin")||"null"
      );

    if(data&&data.username){
      IS_ADMIN=true;
    }
  }catch{
    IS_ADMIN=false;
  }
}

function renderAuth(){

  const area=$("authArea");

  if(IS_ADMIN){

    area.innerHTML=
      '<button onclick="showAddForm()">+ Tambah Kata</button> '+
      '<button onclick="showPendingPanel()">Pending</button> '+
      '<button onclick="showHistoryPanel()">History</button> '+
      '<button class="secondary" onclick="logout()">Keluar</button>';

  }else{

    area.innerHTML=
      '<button onclick="login()">Login Admin</button>';

  }
}

async function loadEntries(){

  const data=await loadJSON("db/index.json");

  if(Array.isArray(data)){
    ENTRIES=data;
  }else if(Array.isArray(data.entries)){
    ENTRIES=data.entries;
  }else{
    ENTRIES=[];
  }

  ENTRIES=ENTRIES.filter(e=>e && !e.deleted);

  $("stats").textContent=
    ENTRIES.length+" entri kamus";

  render();

}

function render(){

  const query=
    ($("search").value||"").trim().toLowerCase();

  const results=
    ENTRIES.filter(e=>{

      const text=[
        e.lemma,
        ...(e.variants||[]),
        e.definition,
        e.example,
        e.translation,
        e.pos
      ].join(" ").toLowerCase();

      return !query || text.includes(query);

    });

  renderWOTD();

  $("list").innerHTML=
    results.length
    ?results.map(entryRowHTML).join("")
    :'<div class="empty">Tidak ada kata yang ditemukan.</div>';

}

function renderWOTD(){

  if(!ENTRIES.length){
    $("wotd").innerHTML="";
    return;
  }

  const index=
    Math.floor(
      Date.now()/(1000*60*60*24)
    )%ENTRIES.length;

  const e=ENTRIES[index];

  $("wotd").innerHTML=
    '<div class="wotd-label">KATA HARI INI</div>'+
    '<div class="wotd-word">'+esc(e.lemma)+'</div>'+
    '<div class="wotd-def">'+
      esc(e.definition||"")+
    '</div>';

}

function entryRowHTML(e){

  let admin="";

  if(IS_ADMIN){

    admin=
      '<div class="admin-tools">'+
      '<button class="admin-btn" onclick="showEditForm(\''+
        esc(e.id)+
      '\')">Edit</button>'+
      '<button class="admin-btn danger" onclick="deleteEntry(\''+
        esc(e.id)+
      '\')">Hapus</button>'+
      '</div>';

  }

  return(
    '<article class="entry">'+

      '<div class="entry-head">'+

        '<a class="entry-word" href="entries/'+
          encodeURIComponent(e.id)+
          '.html">'+
          esc(e.lemma)+
        '</a>'+

        '<span class="entry-pos">'+
          esc(e.pos||"")+
        '</span>'+

      '</div>'+

      '<div class="entry-def">'+
        esc(e.definition||"")+
      '</div>'+

      (
        e.example
        ?
        '<div class="entry-example">'+
          esc(e.example)+
          (
            e.translation
            ?" — "+esc(e.translation)
            :""
          )+
        '</div>'
        :""
      )+

      admin+

    '</article>'
  );

}

function hidePanels(){

  [
    "addPanel",
    "editPanel",
    "pendingPanel",
    "historyPanel"
  ].forEach(id=>{
    $(id).style.display="none";
  });

}

function showAddForm(){

  if(!IS_ADMIN){
    alert("Login admin diperlukan.");
    return;
  }

  hidePanels();

  const panel=$("addPanel");

  panel.style.display="block";

  panel.innerHTML=
    '<h2>Tambah Kata</h2>'+
    '<div class="form-grid">'+

      field("addLemma","Kata Aceh","full")+
      field("addVariants","Variasi / ejaan lain","full")+
      field("addPos","Kelas kata")+
      field("addIPA","IPA")+
      field("addDefinition","Definisi Indonesia","full")+
      field("addExample","Contoh kalimat Aceh","full")+
      field("addTranslation","Terjemahan contoh","full")+
      field("addNotes","Catatan","full")+

    '</div>'+

    '<div class="panel-actions">'+
      '<button onclick="saveNewEntry()">Simpan</button>'+
      '<button class="secondary" onclick="hidePanels()">Batal</button>'+
    '</div>'+

    '<div id="addStatus" class="status"></div>';

  panel.scrollIntoView({behavior:"smooth"});

}

function field(id,label,full=""){

  return(
    '<div class="form-field '+full+'">'+
      '<label>'+esc(label)+'</label>'+
      (
        id==="addDefinition"||
        id==="addExample"||
        id==="addTranslation"||
        id==="addNotes"
        ?
        '<textarea id="'+id+'"></textarea>'
        :
        '<input id="'+id+'">'
      )+
    '</div>'
  );

}

function showEditForm(id){

  if(!IS_ADMIN){
    alert("Login admin diperlukan.");
    return;
  }

  const e=ENTRIES.find(x=>x.id===id);

  if(!e) return;

  CURRENT_EDIT=e;

  hidePanels();

  const panel=$("editPanel");

  panel.style.display="block";

  panel.innerHTML=
    '<h2>Edit Kata</h2>'+
    '<div class="form-grid">'+

      '<div class="form-field full">'+
        '<label>Kata Aceh</label>'+
        '<input id="editLemma" value="'+
          esc(e.lemma)+'">'+
      '</div>'+

      '<div class="form-field full">'+
        '<label>Variasi</label>'+
        '<input id="editVariants" value="'+
          esc((e.variants||[]).join(", "))+'">'+
      '</div>'+

      '<div class="form-field">'+
        '<label>Kelas kata</label>'+
        '<input id="editPos" value="'+
          esc(e.pos||"")+'">'+
      '</div>'+

      '<div class="form-field">'+
        '<label>IPA</label>'+
        '<input id="editIPA" value="'+
          esc(e.ipa||"")+'">'+
      '</div>'+

      '<div class="form-field full">'+
        '<label>Definisi</label>'+
        '<textarea id="editDefinition">'+
          esc(e.definition||"")+
        '</textarea>'+
      '</div>'+

      '<div class="form-field full">'+
        '<label>Contoh</label>'+
        '<textarea id="editExample">'+
          esc(e.example||"")+
        '</textarea>'+
      '</div>'+

      '<div class="form-field full">'+
        '<label>Terjemahan</label>'+
        '<textarea id="editTranslation">'+
          esc(e.translation||"")+
        '</textarea>'+
      '</div>'+

      '<div class="form-field full">'+
        '<label>Catatan</label>'+
        '<textarea id="editNotes">'+
          esc(e.notes||"")+
        '</textarea>'+
      '</div>'+

    '</div>'+

    '<div class="panel-actions">'+
      '<button onclick="saveEdit()">Simpan Perubahan</button>'+
      '<button class="secondary" onclick="hidePanels()">Batal</button>'+
    '</div>'+

    '<div id="editStatus" class="status"></div>';

  panel.scrollIntoView({behavior:"smooth"});

}

async function saveNewEntry(){

  const lemma=$("addLemma").value.trim();

  if(!lemma){
    alert("Kata Aceh wajib diisi.");
    return;
  }

  const id=slugify(lemma);

  if(ENTRIES.some(e=>e.id===id)){
    alert("Kata tersebut sudah ada.");
    return;
  }

  const entry={
    id,
    lemma,
    variants:$("addVariants").value
      .split(",")
      .map(x=>x.trim())
      .filter(Boolean),
    pos:$("addPos").value.trim(),
    ipa:$("addIPA").value.trim(),
    definition:$("addDefinition").value.trim(),
    example:$("addExample").value.trim(),
    translation:$("addTranslation").value.trim(),
    notes:$("addNotes").value.trim(),
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };

  try{

    $("addStatus").textContent="Menyimpan...";

    await saveRepository(entry,"create");

    ENTRIES.push(entry);

    $("stats").textContent=
      ENTRIES.length+" entri kamus";

    hidePanels();
    render();

    alert("Kata berhasil ditambahkan.");

  }catch(error){

    $("addStatus").textContent=
      "Gagal: "+error.message;

  }

}

async function saveEdit(){

  if(!CURRENT_EDIT) return;

  const oldId=CURRENT_EDIT.id;

  const entry={
    ...CURRENT_EDIT,
    lemma:$("editLemma").value.trim(),
    variants:$("editVariants").value
      .split(",")
      .map(x=>x.trim())
      .filter(Boolean),
    pos:$("editPos").value.trim(),
    ipa:$("editIPA").value.trim(),
    definition:$("editDefinition").value.trim(),
    example:$("editExample").value.trim(),
    translation:$("editTranslation").value.trim(),
    notes:$("editNotes").value.trim(),
    updatedAt:new Date().toISOString()
  };

  try{

    $("editStatus").textContent="Menyimpan...";

    await saveRepository(
      entry,
      "edit",
      oldId
    );

    const index=
      ENTRIES.findIndex(e=>e.id===oldId);

    if(index>=0){
      ENTRIES[index]=entry;
    }

    CURRENT_EDIT=null;

    hidePanels();
    render();

    alert("Perubahan berhasil disimpan.");

  }catch(error){

    $("editStatus").textContent=
      "Gagal: "+error.message;

  }

}

async function deleteEntry(id){

  if(!confirm(
    "Hapus kata ini dari kamus?"
  )) return;

  const e=ENTRIES.find(x=>x.id===id);

  if(!e) return;

  try{

    const deleted={
      ...e,
      deleted:true,
      deletedAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };

    await saveRepository(
      deleted,
      "delete",
      id
    );

    ENTRIES=
      ENTRIES.filter(x=>x.id!==id);

    render();

    alert("Kata berhasil dihapus.");

  }catch(error){

    alert(
      "Gagal menghapus: "+
      error.message
    );

  }

}

async function saveRepository(entry,action,oldId=null){

  if(!CFG.token){
    throw new Error(
      "Token GitHub tidak tersedia."
    );
  }

  const ref=
    await api(
      "/git/ref/heads/"+
      encodeURIComponent(BRANCH)
    );

  const commit=
    await api(
      "/git/commits/"+
      encodeURIComponent(ref.object.sha)
    );

  const tree=
    await api(
      "/git/trees/"+
      encodeURIComponent(commit.tree.sha)+
      "?recursive=1"
    );

  const index=
    await api(
      "/contents/db/index.json?ref="+
      encodeURIComponent(BRANCH)
    );

  const oldIndex=
    JSON.parse(
      atob(index.content.replace(/\n/g,""))
    );

  let all=
    Array.isArray(oldIndex)
    ?oldIndex
    :oldIndex.entries||[];

  if(action==="create"){
    all.push(entry);
  }

  if(action==="edit"){
    all=all.map(x=>
      x.id===oldId
      ?entry
      :x
    );
  }

  if(action==="delete"){
    all=all.filter(x=>x.id!==oldId);
  }

  all.sort((a,b)=>
    String(a.lemma||"")
      .localeCompare(
        String(b.lemma||""),
        "id"
      )
  );

  const newTree=[
    {
      path:"db/index.json",
      mode:"100644",
      type:"blob",
      content:JSON.stringify(all,null,2)
    }
  ];

  newTree.push({
    path:"entries/"+entry.id+".html",
    mode:"100644",
    type:"blob",
    content:makeEntryPage(entry)
  });

  if(action==="edit"&&oldId&&oldId!==entry.id){

    newTree.push({
      path:"entries/"+oldId+".html",
      mode:"100644",
      type:"blob",
      sha:null
    });

  }

  if(action==="delete"){

    newTree.push({
      path:"entries/"+id+".html",
      mode:"100644",
      type:"blob",
      sha:null
    });

  }

  const newTreeResult=
    await api("/git/trees",{
      method:"POST",
      body:JSON.stringify({
        base_tree:commit.tree.sha,
        tree:newTree
      })
    });

  const newCommit=
    await api("/git/commits",{
      method:"POST",
      body:JSON.stringify({
        message:
          "Kamus Basa Aceh: "+
          action+" "+entry.lemma,
        tree:newTreeResult.sha,
        parents:[ref.object.sha]
      })
    });

  await api(
    "/git/refs/heads/"+
    encodeURIComponent(BRANCH),
    {
      method:"PATCH",
      body:JSON.stringify({
        sha:newCommit.sha
      })
    }
  );

}

function showPendingPanel(){

  if(!IS_ADMIN) return;

  hidePanels();

  const panel=$("pendingPanel");

  panel.style.display="block";

  loadPending(panel);

  panel.scrollIntoView({behavior:"smooth"});

}

async function loadPending(panel){

  panel.innerHTML=
    "<h2>Kontribusi Pending</h2>"+
    "<div>Memuat...</div>";

  try{

    const data=
      await loadJSON("db/pending.json");

    const list=
      Array.isArray(data)
      ?data
      :data.items||[];

    if(!list.length){

      panel.innerHTML=
        "<h2>Kontribusi Pending</h2>"+
        '<div class="empty">Tidak ada kontribusi pending.</div>';

      return;
    }

    panel.innerHTML=
      "<h2>Kontribusi Pending</h2>"+
      list.map((x,i)=>
        '<div class="pending-item">'+
          "<strong>"+esc(x.lemma||"")+"</strong>"+
          "<div>"+esc(x.definition||"")+"</div>"+
          '<div class="status">'+
            esc(x.createdAt||"")+
          "</div>"+
          '<div class="panel-actions">'+
            '<button onclick="approvePending('+i+')">Terima</button>'+
            '<button class="danger" onclick="rejectPending('+i+')">Tolak</button>'+
          "</div>"+
        "</div>"
      ).join("");

  }catch(error){

    panel.innerHTML=
      "<h2>Kontribusi Pending</h2>"+
      '<div class="status">Belum ada file pending.</div>';

  }

}

function showHistoryPanel(){

  if(!IS_ADMIN) return;

  hidePanels();

  const panel=$("historyPanel");

  panel.style.display="block";

  loadHistory(panel);

  panel.scrollIntoView({behavior:"smooth"});

}

async function loadHistory(panel){

  panel.innerHTML=
    "<h2>History</h2>"+
    "<div>Memuat...</div>";

  try{

    const data=
      await loadJSON(
        "db/history/edits.json"
      );

    const list=
      Array.isArray(data)
      ?data
      :data.items||[];

    if(!list.length){

      panel.innerHTML=
        "<h2>History</h2>"+
        '<div class="empty">Belum ada history.</div>';

      return;

    }

    panel.innerHTML=
      "<h2>History</h2>"+
      list.slice().reverse().map(x=>
        '<div class="history-item">'+
          "<strong>"+esc(x.action||"")+"</strong> · "+
          esc(x.lemma||"")+
          '<div class="status">'+
            esc(x.time||x.updatedAt||"")+
          "</div>"+
        "</div>"
      ).join("");

  }catch{

    panel.innerHTML=
      "<h2>History</h2>"+
      '<div class="empty">Belum ada history.</div>';

  }

}

async function approvePending(index){

  alert(
    "Fungsi penerimaan pending tersedia setelah "+
    "endpoint penulisan repository dikonfigurasi."
  );

}

async function rejectPending(index){

  alert(
    "Fungsi penolakan pending tersedia setelah "+
    "endpoint penulisan repository dikonfigurasi."
  );

}

function makeEntryPage(e){

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(e.lemma)} — Kamus Basa Aceh</title>
<link rel="stylesheet" href="../assets/style.css">
</head>
<body>

<header>
<div class="mark">KAMUS BASA ACEH</div>
<h1>${esc(e.lemma)}</h1>
<div class="tagline">Entri kamus Aceh–Indonesia</div>
</header>

<main>

<article class="entry">

<div class="entry-head">
<span class="entry-word">${esc(e.lemma)}</span>
<span class="entry-pos">${esc(e.pos||"")}</span>
</div>

<div class="entry-def">
<strong>Definisi:</strong>
${esc(e.definition||"")}
</div>

${
  e.ipa
  ?'<div class="status">IPA: '+esc(e.ipa)+'</div>'
  :""
}

${
  e.example
  ?
  '<div class="entry-example">'+
  esc(e.example)+
  (
    e.translation
    ?" — "+esc(e.translation)
    :""
  )+
  "</div>"
  :""
}

${
  e.variants&&e.variants.length
  ?
  '<div class="status">Variasi: '+
  esc(e.variants.join(", "))+
  "</div>"
  :""
}

${
  e.notes
  ?
  '<div class="status">Catatan: '+
  esc(e.notes)+
  "</div>"
  :""
}

</article>

<p>
<a href="../homepage.html">← Kembali ke Kamus</a>
</p>

</main>

<footer>
Kamus Basa Aceh © Komunitas Penutur Bahasa Aceh
</footer>

</body>
</html>`;

}

$("search").addEventListener(
  "input",
  render
);

restoreSession();
renderAuth();

loadEntries().catch(error=>{

  $("stats").textContent=
    "Database belum dapat dimuat.";

  $("list").innerHTML=
    '<div class="empty">'+
    esc(error.message)+
    "</div>";

});

