// Service worker Strategos : notifications Web Push + coquille minimale
// pour l'installation en PWA. Doit rester à la racine (/sw.js) pour
// contrôler tout le site avec le scope par défaut.
//
// Cache réseau-d'abord, uniquement pour la coquille (HTML/CSS/JS/icônes) :
// jamais pour les données (API, tuiles Cesium/Google, CDN externes) — le
// principe du projet est de n'afficher que des données réelles, jamais de
// contenu périmé présenté comme actuel. Le cache ne sert que de secours
// hors-ligne pour que l'app s'affiche au lieu d'un écran blanc.
const SHELL_CACHE = "strategos-shell-v1";
const SHELL_URLS = ["/", "/static/style.css", "/static/app.js", "/manifest.webmanifest", "/static/logo-mark.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== SHELL_CACHE).map((n) => caches.delete(n)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !SHELL_URLS.includes(url.pathname)) return; // tout le reste : comportement par défaut du navigateur
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req)),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // ignore un payload non-JSON
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Strategos", {
      body: data.body || "",
      icon: "/static/logo-mark.png",
      badge: "/static/logo-mark.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (new URL(c.url).pathname === new URL(url, self.location.origin).pathname && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
