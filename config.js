/* ==============================================================
   KONFIGURASI SERVER (satu-satunya yang perlu Anda isi)
   Tempel URL aplikasi web Google Apps Script, yang berakhiran /exec
   ============================================================== */
var KAMUS_API = "https://script.google.com/macros/s/AKfycbx1ssf2Jkdv2lLWRa0c1b1MxUmtZMfLqWk_-RYC3h_V9ewzHyx1HKyWpy7PmSKkHmwC/exec";
var KAMUS_CONFIG = { loginUrl: KAMUS_API, addWordUrl: KAMUS_API, dataUrl: KAMUS_API };

function kamusGalat(pesan) {
  var el = document.getElementById("kamus-galat");
  if (!el) {
    el = document.createElement("div");
    el.id = "kamus-galat"; el.setAttribute("role", "alert");
    el.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;padding:14px 18px;border:2px solid currentColor;border-radius:14px;background:Canvas;color:CanvasText;font:600 14px/1.45 system-ui,sans-serif";
    document.body.appendChild(el);
  }
  el.textContent = pesan || "Tidak dapat memuat data dari server. Coba muat ulang, atau periksa KAMUS_API di config.js.";
}

function kamusAmbil(aksi) {
  if (!KAMUS_API) {
    kamusGalat("Server belum disambungkan. Isi KAMUS_API di config.js dengan URL aplikasi web Apps Script.");
    return Promise.reject(new Error("KAMUS_API kosong"));
  }
  return fetch(KAMUS_API + (KAMUS_API.indexOf("?") < 0 ? "?" : "&") + "aksi=" + aksi + "&_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); });
}

function kamusOrang(x) {
  var bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"], j = String(x.j || ""), m = j.match(/^(\d{4})-(\d{2})/);
  return { n: x.n || x.username, r: x.r, j: m ? bln[+m[2] - 1] + " " + m[1] : j, kata: x.kata, sunting: x.sunting, verif: x.verif, lafal: x.lafal, streak: x.streak };
}

/* Beranda dimuat ulang dengan URL unik agar data terbaru tidak tertahan cache. */
function kamusAcak() {
  var h = "abcdefghijklmnopqrstuvwxyz", d = "0123456789", s = h + d, a = [], i, j, t;
  var r = function (n) { return Math.floor(Math.random() * n); };
  a.push(h.charAt(r(26)), d.charAt(r(10)), s.charAt(r(36)), s.charAt(r(36)));
  for (i = a.length - 1; i > 0; i--) { j = r(i + 1); t = a[i]; a[i] = a[j]; a[j] = t; }
  return a.join("");
}
(function () {
  function acak(a) { a.setAttribute("href", "/?" + kamusAcak()); a.setAttribute("data-beranda", ""); }
  function cocok(a) { return a && (a.getAttribute("href") === "/" || a.hasAttribute("data-beranda")); }
  function semua() { var l = document.querySelectorAll('a[href="/"],a[data-beranda]'), i; for (i = 0; i < l.length; i++) acak(l[i]); }
  function pilih(e) { var a = e.target && e.target.closest ? e.target.closest("a") : null; if (cocok(a)) acak(a); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", semua); else semua();
  ["pointerdown", "click", "auxclick", "keydown"].forEach(function (n) { document.addEventListener(n, pilih, true); });
})();

/* Kotak pencarian bersama untuk semua halaman selain beranda. */
(function () {
  function pasang() {
    var style = document.createElement("style");
    style.textContent = ".site-search{max-width:560px;margin:0 auto 20px;width:100%;font-family:var(--display,system-ui,sans-serif)}.site-search form{display:flex;gap:8px;background:var(--surface,#fff);border:2px solid var(--ink,#0E2520);border-radius:16px;padding:6px;box-shadow:4px 4px 0 var(--ink,#0E2520)}.site-search input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink,#0E2520);font:500 1rem var(--display,system-ui,sans-serif);padding:9px 12px;outline:none}.site-search input::placeholder{color:var(--muted,#586D67)}.site-search button{border:0;border-radius:11px;background:var(--accent,#0A6B58);color:var(--accent-ink,#fff);font:700 .95rem var(--display,system-ui,sans-serif);padding:9px 17px;cursor:pointer}.site-search form:focus-within{border-color:var(--accent,#0A6B58)}@media(max-width:520px){.site-search{padding-inline:0}.site-search button{padding-inline:12px}}";
    document.head.appendChild(style);
    if (document.getElementById("q")) {
      var input = document.getElementById("q"), term = new URLSearchParams(location.search).get("q");
      if (term) {
        input.value = term;
        var entry = document.getElementById("entry"), done = false;
        function tampilkan() { if (done) return; done = true; input.dispatchEvent(new Event("input", { bubbles: true })); }
        if (entry && window.MutationObserver) new MutationObserver(function () { if (entry.childElementCount) tampilkan(); }).observe(entry, { childList: true });
        setTimeout(tampilkan, 1800);
      }
      return;
    }
    var header = document.querySelector("header.top"), main = document.querySelector("main"), wrap = header && header.parentNode;
    if (!wrap) return;
    var box = document.createElement("div"); box.className = "site-search";
    box.innerHTML = '<form action="/" method="get" role="search" aria-label="Cari kata di Kamus Aceh"><input type="search" name="q" placeholder="Cari kata, misalnya gampong" aria-label="Cari kata" autocomplete="off"><button type="submit">Cari</button></form>';
    if (main && main.parentNode === wrap) wrap.insertBefore(box, main); else header.insertAdjacentElement("afterend", box);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pasang); else pasang();
})();

/* Sembunyikan tombol sunting dan hapus pada halaman entri bagi pengguna yang belum masuk. */
(function () {
  var style = document.createElement("style");
  style.textContent = ".crud{display:none!important}.crud.authenticated{display:grid!important}";
  document.head.appendChild(style);
  function sinkronCrud() {
    var crud = document.querySelector(".crud"); if (!crud) return;
    var token = null; try { token = sessionStorage.getItem("kamus-token"); } catch (e) {}
    crud.classList.toggle("authenticated", !!token);
  }
  function mulai() {
    sinkronCrud();
    var tombolLogin = document.getElementById("loginBtn");
    if (tombolLogin && window.MutationObserver) new MutationObserver(sinkronCrud).observe(tombolLogin, { childList: true, subtree: true, characterData: true });
    window.addEventListener("storage", sinkronCrud);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mulai); else mulai();
})();
