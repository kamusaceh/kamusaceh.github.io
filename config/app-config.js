/**
 * Konfigurasi Utama Aplikasi Web Kamus Aceh
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
  featuredWords: ["aneuk", "bu", "gunong", "ie", "laot", "leumo", "malam", "rumoh", "ureueng", "uroe"],
  searchSettings: {
    maxResults: 20,
    debounceMs: 200
  }
};

if (typeof window !== "undefined") {
  window.APP_CONFIG = CONFIG;
}