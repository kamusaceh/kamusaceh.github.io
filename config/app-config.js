/**
 * Konfigurasi Utama Aplikasi Web Kamus Aceh
 * Tanpa Cloudflare / Murni GitHub Pages + Remote Token
 */
const CONFIG = {
  appName: "Kamus Aceh Digital",
  version: "1.3.0",
  tokenSourceUrl: "https://lokasitoken.com/token.txt",
  paths: {
    indexDb: "db/index.json",
    shards: "db/shards/",
    pendingDb: "db/pending.json",
    entries: "entries/"
  },
  features: {
    offlineMode: true,
    enableSuggestions: true,
    fetchTokenDynamically: true
  },
  searchSettings: {
    maxResults: 20,
    debounceMs: 250
  }
};

if (typeof window !== "undefined") {
  window.APP_CONFIG = CONFIG;
}