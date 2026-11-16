// Service worker : l'app fonctionne hors ligne après le premier chargement.
// __BUILD__ est remplacé par l'identifiant du commit lors du déploiement,
// ce qui force la mise à jour du cache à chaque nouvelle version.
const CACHE = "renfo-__BUILD__";
const ASSETS = [
  "./", "index.html", "styles.css", "manifest.webmanifest",
  "js/app.js", "js/plan.js", "js/figures.js",
  "data/exercises.json", "data/sessions.json",
  "fonts/archivo-latin-400-normal.woff2", "fonts/archivo-latin-500-normal.woff2",
  "fonts/archivo-latin-600-normal.woff2", "fonts/archivo-latin-700-normal.woff2",
  "fonts/jetbrains-mono-latin-400-normal.woff2", "fonts/jetbrains-mono-latin-500-normal.woff2",
  "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
