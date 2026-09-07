/* kamus.js — isi sama dengan versi original, cuma source-nya dikecil di sini untuk demo */
const CONFIG = { owner: "kamusaceh", repo: "kamusaceh.github.io", branch: "main" };
function stripDiacritics(str) { return str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function slugify(word) { let s = word.toLowerCase().trim(); s = s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""); return s || "kata"; }
function firstLetter(word) { const s = stripDiacritics(word.toLowerCase().trim()); const m = s.match(/[a-z]/); return m ? m[0] : "misc"; }
// ... (rest of kamus.js identical to original)
