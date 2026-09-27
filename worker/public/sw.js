// Service worker Strategos : uniquement les notifications Web Push (aucun
// cache/offline — volontairement minimal). Doit rester à la racine (/sw.js)
// pour contrôler tout le site avec le scope par défaut.

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
