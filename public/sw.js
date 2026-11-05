/* Danchi service worker: Chichi's push notifications, with Done / Snooze buttons. */
const OFFLINE = "danchi-offline-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(OFFLINE).then((c) => c.addAll(["/offline.html", "/icons/icon-192.png", "/mascot/sleep.png"])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Pages always come fresh from the server (private data is never cached).
// Only when there is no internet at all, show a friendly offline page.
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html").then((r) => r || Response.error())));
});

function tellOpenTabs() {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => list.forEach((c) => c.postMessage({ type: "danchi-push" })));
}

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: "Danchi", body: e.data ? e.data.text() : "" };
  }
  if (d.clearTag) {
    e.waitUntil(
      self.registration.getNotifications({ tag: d.clearTag }).then((list) => list.forEach((n) => n.close())),
    );
    return;
  }
  const show = self.registration.showNotification(d.title || "Danchi", {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: d.tag || undefined,
    renotify: !d.silent && !!d.tag,
    silent: !!d.silent,
    requireInteraction: !!d.sticky,
    actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : [],
    data: { url: d.url || "/", reminderId: d.reminderId || null, checkinId: d.checkinId || null },
    vibrate: d.silent ? undefined : d.kind === "safety" ? [200, 100, 200, 100, 400] : [80, 40, 80],
  });
  e.waitUntil(Promise.all([show, d.silent ? null : tellOpenTabs()]));
});

function openApp(path) {
  const url = new URL(path || "/", self.location.origin).href;
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.location.origin) && "focus" in c) {
        return c.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : w));
      }
    }
    return self.clients.openWindow(url);
  });
}

self.addEventListener("notificationclick", (e) => {
  const data = e.notification.data || {};
  e.notification.close();
  if ((e.action === "safe" || e.action === "later") && data.checkinId) {
    e.waitUntil(
      fetch("/api/safe/act", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: data.checkinId, action: e.action }),
      })
        .then((r) => {
          if (!r.ok) return openApp(data.url);
          return self.registration.showNotification(e.action === "safe" ? "Yay, you're safe 💛 Rafi knows." : "Okay, 15 more minutes ⏰", {
            icon: "/icons/icon-192.png",
            badge: "/icons/badge-96.png",
            tag: "danchi-ack",
            silent: true,
          });
        })
        .then(tellOpenTabs)
        .catch(() => openApp(data.url)),
    );
    return;
  }
  if ((e.action === "done" || e.action === "snooze") && data.reminderId) {
    e.waitUntil(
      fetch("/api/reminders/act", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: data.reminderId, action: e.action, minutes: 10 }),
      })
        .then((r) => {
          if (!r.ok) return openApp(data.url);
          if (e.action === "snooze") {
            return self.registration.showNotification("Okay! I'll ask again in 10 min ⏰", {
              icon: "/icons/icon-192.png",
              badge: "/icons/badge-96.png",
              tag: "danchi-ack",
              silent: true,
            });
          }
        })
        .then(tellOpenTabs)
        .catch(() => openApp(data.url)),
    );
    return;
  }
  e.waitUntil(openApp(data.url));
});
