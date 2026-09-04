

var CFG=window.KAMUS_CONFIG||{};

var API=
  "https://api.github.com/repos/"
  +CFG.owner
  +"/"
  +CFG.repo;

var BRANCH=
  CFG.branch||"main";


function ghHeaders(){

  var h={
    "Accept":
      "application/vnd.github+json",
    "Content-Type":
      "application/json"
  };

  if(CFG.token){
    h.Authorization=
      "Bearer "+CFG.token;
  }

  return h;
}


async function sha256Hex(str){

  var data=
    new TextEncoder().encode(str);

  var hash=
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array
    .from(new Uint8Array(hash))
    .map(function(x){
      return x
        .toString(16)
        .padStart(2,"0");
    })
    .join("");
}


function getAuth(){

  try{

    var raw=
      sessionStorage.getItem(
        "kamusAuth"
      );

    return raw
      ?JSON.parse(raw)
      :null;

  }catch(e){

    return null;

  }

}


function setAuth(a){

  sessionStorage.setItem(
    "kamusAuth",
    JSON.stringify(a)
  );

}


function clearAuth(){

  sessionStorage.removeItem(
    "kamusAuth"
  );

}


function isAdmin(){

  var a=getAuth();

  return !!(
    a &&
    a.role==="admin"
  );

}


async function loadUsers(){

  var r=
    await fetch(
      "users/users.txt?t="+Date.now()
    );

  if(!r.ok){
    throw new Error(
      "users/users.txt tidak ditemukan"
    );
  }

  var txt=await r.text();

  return txt
    .split("\n")
    .map(function(x){
      return x.trim();
    })
    .filter(function(x){
      return x &&
        x.charAt(0)!=="#";
    })
    .map(function(line){

      var p=line.split(",");

      return {
        username:p[0],
        hash:p[1],
        role:p[2],
        created:p[3],
        status:p[4]
      };

    });

}


function renderAuth(){

  var area=
    document.getElementById(
      "authArea"
    );

  var a=getAuth();

  if(!a){

    area.innerHTML=
      '<button class="btn-small" onclick="loginForm()">Masuk</button>';

    return;

  }

  area.innerHTML=
    '<span class="user-badge">'
    +a.username
    +'<span class="role-badge">'
    +a.role
    +'</span></span>'
    +'<button class="btn-small" onclick="logout()">Keluar</button>';

}


function loginForm(){

  var area=
    document.getElementById(
      "authArea"
    );

  area.innerHTML=
    '<div class="auth-area">'
    +'<input id="loginUser" placeholder="Username">'
    +'<input id="loginPass" type="password" placeholder="Password">'
    +'<button class="btn-small" onclick="login()">Masuk</button>'
    +'<button class="btn-small ghost" onclick="renderAuth()">Batal</button>'
    +'<span id="loginMsg"></span>'
    +'</div>';

}


async function login(){

  var user=
    document.getElementById(
      "loginUser"
    ).value.trim();

  var pass=
    document.getElementById(
      "loginPass"
    ).value;

  var msg=
    document.getElementById(
      "loginMsg"
    );

  if(!user||!pass){

    msg.textContent=
      "Isi username dan password.";

    return;

  }

  msg.textContent=
    "Memeriksa…";

  try{

    var users=
      await loadUsers();

    var hash=
      await sha256Hex(pass);

    var found=
      users.find(function(u){
        return u.username===user;
      });

    if(
      !found||
      found.status!=="active"||
      found.hash!==hash
    ){

      msg.textContent=
        "Username atau password salah.";

      return;

    }

    setAuth({
      username:found.username,
      role:found.role
    });

    renderAuth();

  }catch(e){

    msg.textContent=
      "Gagal memeriksa akun.";

  }

}


function logout(){

  clearAuth();

  renderAuth();

}


var ALL_ENTRIES=[];


async function loadEntries(){

  try{

    var r=
      await fetch(
        "db/index.json?t="+Date.now()
      );

    if(!r.ok){
      throw new Error();
    }

    var d=await r.json();

    ALL_ENTRIES=
      (d.entries||[])
      .sort(function(a,b){
        return a.lemma.localeCompare(
          b.lemma
        );
      });

    render();

  }catch(e){

    document.getElementById(
      "list"
    ).innerHTML=
      '<div class="empty">Belum ada data.</div>';

  }

}


function render(){

  var stats=
    document.getElementById(
      "stats"
    );

  stats.textContent=
    ALL_ENTRIES.length+
    " entri tersedia";

  var active=
    ALL_ENTRIES;

  if(active.length){

    var w=
      active[
        Math.floor(
          Math.random()*active.length
        )
      ];

    document.getElementById(
      "wotd"
    ).innerHTML=
      '<div class="label">Kata Hari Ini</div>'+
      row(w);

  }

  draw(active);

}


function row(e){

  return '<div class="entry-row">'
    +'<div>'
    +'<a class="headword" href="entri/'
    +e.slug
    +'/">'
    +e.lemma
    +'</a>'
    +'<span class="pron">'
    +(e.pron||"")
    +'</span>'
    +'<div class="sense">'
    +'<span class="pos">'
    +(e.pos||"")
    +'</span> '
    +(e.def||"")
    +'</div>'
    +'</div>'
    +'</div>';

}


function draw(entries){

  var list=
    document.getElementById(
      "list"
    );

  if(!entries.length){

    list.innerHTML=
      '<div class="empty">Tidak ada entri yang cocok.</div>';

    return;

  }

  list.innerHTML=
    entries
      .map(function(e){
        return '<div class="entry">'
          +row(e)
          +'</div>';
      })
      .join("");

}


document.addEventListener(
  "DOMContentLoaded",
  function(){

    var s=
      document.getElementById(
        "search"
      );

    s.addEventListener(
      "input",
      function(){

        var q=
          s.value
            .trim()
            .toLowerCase();

        if(!q){

          draw(ALL_ENTRIES);

          return;

        }

        draw(
          ALL_ENTRIES.filter(
            function(e){

              return(
                e.lemma
                  .toLowerCase()
                  .includes(q)
                ||
                (e.def||"")
                  .toLowerCase()
                  .includes(q)
              );

            }
          )
        );

      }
    );

  }
);


loadEntries();
renderAuth();

