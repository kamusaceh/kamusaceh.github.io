/**
 * Konfigurasi Utama Aplikasi Web Kamus Aceh
 */
const CONFIG = {
  appName: "Kamus Aceh Digital",
  version: "2.2.0",
  tokenSourceUrl: "token.txt",
  paths: {
    indexDb: "db/index.json",
    shards: "db/shards/",
    pendingDb: "db/pending.json",
    usersDb: "db/users.json",
    entries: "entries/"
  },
  features: {
    offlineMode: true,
    enableSuggestions: true,
    fetchTokenDynamically: true
  }
};

if (typeof window !== "undefined") {
  window.APP_CONFIG = CONFIG;
}