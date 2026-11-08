#!/usr/bin/env python3
"""Membangun bagian SEO situs: meta tag, halaman statis per kata (/entri/<id>/),
sitemap.xml, robots.txt, favicon.svg. Dijalankan dari akar repo:  python3 alat/bangun.py
Idempotent: aman dijalankan berulang. Sumber data: kamus_aceh_database_A-0015_batch.xlsx (sheet Entri)."""
import os, re, json, html, shutil, datetime, sys
from openpyxl import load_workbook

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(R)
SITE = "https://kamusaceh.github.io"
NAMA = "Kamus Aceh"
SOSMED = "basaacehproject"
SAMEAS = [f"https://www.instagram.com/{SOSMED}", f"https://www.facebook.com/{SOSMED}",
          f"https://www.youtube.com/@{SOSMED}", f"https://www.tiktok.com/@{SOSMED}",
          f"https://x.com/{SOSMED}", f"https://github.com/{SOSMED}", f"https://t.me/{SOSMED}"]
HARI = datetime.date.today().isoformat()
e = lambda s: html.escape(str(s), quote=True)
JNS = {"kata": "Kata", "bunyi": "Bunyi", "rujukan": "Rujukan", "nama_diri": "Nama diri"}

def potong(s, n):
    s = re.sub(r"\s+", " ", str(s)).strip()
    return s if len(s) <= n else s[:n - 1].rsplit(" ", 1)[0].rstrip(",;:. ") + "…"

def seo(judul, desk, kanon, robots="index,follow", jsonld=None, tipe="website"):
    gambar = SITE + "/og.png"
    t = [f'<!--seo-->',
         f'<meta name="description" content="{e(desk)}">',
         f'<meta name="robots" content="{robots}">',
         f'<link rel="canonical" href="{e(kanon)}">',
         '<meta name="theme-color" content="#0A6B58">',
         '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
         f'<meta property="og:site_name" content="{NAMA}">',
         '<meta property="og:locale" content="id_ID">',
         f'<meta property="og:type" content="{tipe}">',
         f'<meta property="og:title" content="{e(judul)}">',
         f'<meta property="og:description" content="{e(desk)}">',
         f'<meta property="og:url" content="{e(kanon)}">',
         f'<meta property="og:image" content="{gambar}">',
         '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
         '<meta name="twitter:card" content="summary_large_image">',
         f'<meta name="twitter:title" content="{e(judul)}">',
         f'<meta name="twitter:description" content="{e(desk)}">',
         f'<meta name="twitter:image" content="{gambar}">']
    for j in (jsonld or []):
        t.append('<script type="application/ld+json">' + json.dumps(j, ensure_ascii=False).replace("</", "<\\/") + '</script>')
    t.append('<!--/seo-->')
    return "\n".join(t)

def pasang(s, judul, blok):
    s = re.sub(r"<!--seo-->.*?<!--/seo-->\n?", "", s, flags=re.S)
    s = re.sub(r"<title>.*?</title>", lambda m: f"<title>{e(judul)}</title>\n{blok}", s, count=1, flags=re.S)
    return s

def tulis(p, s):
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    open(p, "w", encoding="utf-8").write(s)

# 1. tautan sosial di semua halaman
URL = {"Instagram": f"https://www.instagram.com/{SOSMED}", "Facebook": f"https://www.facebook.com/{SOSMED}",
       "YouTube": f"https://www.youtube.com/@{SOSMED}", "TikTok": f"https://www.tiktok.com/@{SOSMED}",
       "X": f"https://x.com/{SOSMED}", "GitHub": f"https://github.com/{SOSMED}", "Telegram": f"https://t.me/{SOSMED}"}
def sosmed(s):
    for n, u in URL.items():
        s = re.sub(r'href="https://[^"]*"( target="_blank" rel="noopener" aria-label="%s")' % n, r'href="%s"\1' % u, s)
    return s

# 2. halaman umum
ORG = {"@context": "https://schema.org", "@type": "Organization", "name": "Proyek Basa Aceh", "url": SITE + "/", "logo": SITE + "/favicon.svg", "sameAs": SAMEAS}
HALAMAN = {
  "index.html": (f"{NAMA} · Kamus Aceh–Indonesia daring",
     "Kamus Aceh–Indonesia daring: cari arti kata bahasa Aceh lengkap dengan kelas kata dan contoh kalimat. Proyek Basa Aceh.",
     SITE + "/", "index,follow",
     [{"@context": "https://schema.org", "@type": "WebSite", "name": NAMA, "url": SITE + "/", "inLanguage": "id", "publisher": {"@type": "Organization", "name": "Proyek Basa Aceh"}}, ORG]),
  "entri/index.html": (f"Entri {NAMA}", "Halaman satu kata Kamus Aceh: arti, contoh kalimat, rincian, dan riwayat suntingan.",
     SITE + "/entri/", "noindex,follow", None),
  "kontributor/index.html": (f"Kontributor {NAMA}", "Papan peringkat dan profil para kontributor yang menyumbang, menyunting, dan memverifikasi kata di Kamus Aceh.",
     SITE + "/kontributor/", "index,follow", [ORG]),
  "riwayat/index.html": (f"Riwayat suntingan {NAMA}", "Riwayat lengkap suntingan satu kata di Kamus Aceh.",
     SITE + "/riwayat/", "noindex,follow", None),
  "profil/index.html": (f"Profil Kontributor {NAMA}", "Profil kontributor Kamus Aceh: sumbangan kata, suntingan, verifikasi, dan lencana.",
     SITE + "/profil/", "noindex,follow", None),
}
for f, (j, d, k, rb, ld) in HALAMAN.items():
    s = sosmed(open(f, encoding="utf-8").read())
    tulis(f, pasang(s, j, seo(j, d, k, rb, ld)))
s = open("404.html", encoding="utf-8").read()
tulis("404.html", pasang(s, f"Halaman tidak ditemukan · {NAMA}", seo("Halaman tidak ditemukan", "Halaman ini tidak ada.", SITE + "/", "noindex,follow")))

# 3. halaman statis per kata
wb = load_workbook([f for f in os.listdir(".") if f.endswith(".xlsx")][0], read_only=True, data_only=True)
rows = list(wb["Entri"].iter_rows(values_only=True)); H = {n: i for i, n in enumerate(rows[0])}
tmpl = re.sub(r"<!--seo-->.*?<!--/seo-->\n?", "", open("entri/index.html", encoding="utf-8").read(), flags=re.S)
for d in os.listdir("entri"):
    if os.path.isdir(f"entri/{d}"): shutil.rmtree(f"entri/{d}")
urls = []
for r in rows[1:]:
    g = lambda k: ("" if r[H[k]] is None else str(r[H[k]]).strip())
    id_, w = g("id"), g("kata_kepala")
    if not id_ or not w: continue
    h, arti, rj, v = g("homonim"), g("arti_indonesia"), g("rujukan"), g("varian")
    ex = [(g(f"contoh_{n}"), g(f"arti_{n}")) for n in range(1, 26) if g(f"contoh_{n}") or g(f"arti_{n}")]
    if not arti and not rj: continue            # tanpa arti/rujukan = isi tipis: jangan diindeks
    lab = w + (f" ({h})" if h else "")
    isi = arti or (f"Lihat: {rj}" if rj else "")
    judul = f"{lab} – arti dan contoh kalimat bahasa Aceh · {NAMA}"
    bagus = [x for x in ex if x[0] and x[1] and not re.match(r"^[\s–—-]", x[0])]
    desk = f"Arti kata “{lab}” dalam bahasa Aceh: {potong(isi, 130).rstrip('.')}." + (f" Contoh: {potong(bagus[0][0], 60)} = {potong(bagus[0][1], 60)}" if bagus else "")
    kanon = f"{SITE}/entri/{id_}/"
    ld = [{"@context": "https://schema.org", "@type": "DefinedTerm", "name": w, "description": isi, "inLanguage": "ace", "url": kanon,
           "inDefinedTermSet": {"@type": "DefinedTermSet", "name": NAMA, "url": SITE + "/"}},
          {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": NAMA, "item": SITE + "/"},
              {"@type": "ListItem", "position": 2, "name": lab, "item": kanon}]}]
    s = pasang(tmpl, judul, seo(judul, potong(desk, 300), kanon, "index,follow", ld, "article"))
    sup = f'<sup class="hm">{e(h)}</sup>' if h else ""
    ganti = [('<h1 id="word"></h1>', f'<h1 id="word">{sup}{e(w)}</h1>'),
             ('id="bg" aria-hidden="true"></div>', f'id="bg" aria-hidden="true">{e(w)}</div>'),
             ('<p class="def" id="def"></p>', f'<p class="def" id="def">{e(isi)}</p>'),
             ('<div class="xs" id="exs"></div>', '<div class="xs" id="exs">' + "".join(f'<div><p class="ex">{e(a)}</p><p class="tr">{e(b)}</p></div>' for a, b in ex) + '</div>'),
             ('<section class="blk" id="histblk">', '<section class="blk" id="histblk" hidden>'),
             ('<div class="say" id="say"></div>', f'<div class="say" id="say">{("<span class=syl>varian: "+e(v)+"</span>") if v else ""}</div>')]
    for a, b in ganti:
        assert s.count(a) == 1, (id_, a)
        s = s.replace(a, b)
    tulis(f"entri/{id_}/index.html", s)
    urls.append(kanon)

# 4. sitemap, robots, favicon
st = [SITE + "/", SITE + "/kontributor/", SITE + "/huruf/"] + urls
tulis("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      "".join(f"  <url><loc>{e(u)}</loc><lastmod>{HARI}</lastmod></url>\n" for u in st) + "</urlset>\n")
tulis("robots.txt", f"User-agent: *\nAllow: /\nDisallow: /profil/\nDisallow: /riwayat/\nDisallow: /pdf/\nDisallow: /entri/index.html\n\nSitemap: {SITE}/sitemap.xml\n")
tulis("favicon.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0A6B58"/><text x="32" y="46" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="40" fill="#fff">K</text></svg>\n')
print(f"halaman kata: {len(urls)}; sitemap: {len(st)} URL")
