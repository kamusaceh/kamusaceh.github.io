/* Tooltip kelas kata: klik (atau Enter/Spasi) pada singkatan seperti "n", "v", "a", "adv"
   menampilkan nama lengkapnya. Dipakai di beranda, halaman entri, dan riwayat.
   Sasaran: elemen .cls dan #cardCls. Isi diambil dari teks elemen itu sendiri.
   Penanda "[turunan]" di data diganti ikon .trn yang juga bisa diklik untuk penjelasan. */
(function(){
var KELAS={
n:"Nomina (kata benda)",
v:"Verba (kata kerja)",
a:"Adjektiva (kata sifat)",
adv:"Adverbia (kata keterangan)",
kata:"Jenis entri: kata",
rujukan:"Jenis entri: rujukan",
"nama diri":"Jenis entri: nama diri",
bunyi:"Jenis entri: bunyi"
};
var TRN="Turunan: bentuk yang dibentuk dari kata dasar. Tanda \u2013 mewakili kata dasarnya.";
var ICON_TRN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4v7a3 3 0 0 0 3 3h11"/><path d="M15 10l4 4-4 4"/></svg>';
var RE_TRN=/\[turunan\]\s*/i;
var SEL=".cls,#cardCls,.trn";
var css=document.createElement("style");
css.textContent=
".kelas-ok{cursor:pointer}"+
".trn{display:inline-flex;align-items:center;justify-content:center;width:1.5em;height:1.15em;margin-right:.45em;"+
"border:1px solid var(--line,#c9d3ce);border-radius:.35em;color:var(--accent,#0f6b52);background:var(--surface,transparent);"+
"vertical-align:-.2em;font-size:inherit;line-height:1}"+
".trn svg{width:.85em;height:.85em;flex:none}"+
".kelas-ok:focus-visible{outline:2px solid var(--accent,#0f6b52);outline-offset:2px}"+
"#kelasTip{position:absolute;z-index:9999;max-width:240px;padding:7px 12px;border-radius:10px;"+
"background:var(--ink,#10231d);color:var(--bg,#fff);font:600 .82rem/1.3 var(--display,system-ui,sans-serif);"+
"letter-spacing:0;text-transform:none;box-shadow:0 6px 20px rgba(0,0,0,.2);pointer-events:none;"+
"opacity:0;transform:translateY(4px);transition:opacity .15s,transform .15s}"+
"#kelasTip.on{opacity:1;transform:none}"+
"@media (prefers-reduced-motion:reduce){#kelasTip{transition:none}}";
document.head.appendChild(css);

var tip=null,owner=null,timer=0;
function nama(el){
if(el.classList&&el.classList.contains("trn"))return TRN;
return KELAS[(el.textContent||"").trim().toLowerCase()]||"";
}

function tutup(){
clearTimeout(timer);
if(tip)tip.classList.remove("on");
if(owner){owner.removeAttribute("aria-describedby");owner=null}
}
function buka(el){
var t=nama(el);if(!t)return;
if(!tip){tip=document.createElement("div");tip.id="kelasTip";tip.setAttribute("role","tooltip");document.body.appendChild(tip)}
tip.textContent=t;
el.setAttribute("aria-describedby","kelasTip");
owner=el;
var r=el.getBoundingClientRect(),sx=window.pageXOffset,sy=window.pageYOffset;
var w=tip.offsetWidth,vw=document.documentElement.clientWidth;
var left=r.left+sx+r.width/2-w/2;
left=Math.max(sx+8,Math.min(left,sx+vw-w-8));
tip.style.left=left+"px";
tip.style.top=(r.bottom+sy+8)+"px";
tip.classList.add("on");
clearTimeout(timer);timer=setTimeout(tutup,4000);
}

document.addEventListener("click",function(e){
var el=e.target.closest&&e.target.closest(SEL);
if(el&&nama(el)){e.preventDefault();if(owner===el)tutup();else buka(el);return}
tutup();
});
document.addEventListener("keydown",function(e){
if(e.key==="Escape"){tutup();return}
if(e.key!=="Enter"&&e.key!==" ")return;
var el=e.target.closest&&e.target.closest(SEL);
if(el&&nama(el)){e.preventDefault();if(owner===el)tutup();else buka(el)}
});
window.addEventListener("scroll",tutup,{passive:true});
window.addEventListener("resize",tutup);

/* badge dibuat ulang tiap kali kata berganti: tandai agar bisa difokus dan terbaca sebagai tombol */
function ganti(){
var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
var p=n.parentNode;
if(!p||/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|NOSCRIPT)$/.test(p.nodeName))return NodeFilter.FILTER_REJECT;
return RE_TRN.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
}});
var list=[],n;
while((n=w.nextNode()))list.push(n);
list.forEach(function(n){
var m=n.nodeValue.match(RE_TRN),p=n.parentNode;
var before=n.nodeValue.slice(0,m.index),after=n.nodeValue.slice(m.index+m[0].length);
var ic=document.createElement("span");ic.className="trn";ic.innerHTML=ICON_TRN;
if(before)p.insertBefore(document.createTextNode(before),n);
p.insertBefore(ic,n);
n.nodeValue=after;
});
}
function siap(){
ganti();
Array.prototype.forEach.call(document.querySelectorAll(SEL),function(el){
var t=nama(el);
if(t){
el.classList.add("kelas-ok");
el.setAttribute("tabindex","0");
el.setAttribute("role","button");
el.setAttribute("aria-label",el.classList.contains("trn")?t:(el.textContent||"").trim()+": "+t);
}else{
el.classList.remove("kelas-ok");
el.removeAttribute("tabindex");el.removeAttribute("role");el.removeAttribute("aria-label");
}
});
}
if(window.MutationObserver){new MutationObserver(siap).observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",siap);else siap();
})();
