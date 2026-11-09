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

/* Danchi sw v2: self-healing push subscription, in-app chime, louder reminders. */

function tellOpenTabs(extra) {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => list.forEach((c) => c.postMessage(Object.assign({ type: "danchi-push" }, extra || {}))));
}

/** Is Danchi open and on screen right now? */
function appOnScreen() {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => list.some((c) => c.visibilityState === "visible" && c.focused));
}

function vibrateFor(d) {
  if (d.silent) return undefined;
  if (d.kind === "safety") return [300, 120, 300, 120, 500];
  if (d.kind === "reminder") return [250, 120, 250, 120, 250];
  return [120, 60, 120];
}

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: "Danchi", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    (async () => {
      // Old servers sent "clear" pushes that showed nothing; browsers punish
      // that (iPhone even drops the subscription), so we only close quietly
      // and always show something.
      if (d.clearTag) {
        const list = await self.registration.getNotifications({ tag: d.clearTag });
        list.forEach((n) => n.close());
        if (!d.title) return;
      }
      // When the app is open on screen, the page plays Chichi's chime, so the
      // phone's own sound stays quiet (no double ding).
      const onScreen = !d.silent && (await appOnScreen().catch(() => false));
      const silent = !!d.silent || onScreen;
      await self.registration.showNotification(d.title || "Danchi", {
        body: d.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: d.tag || undefined,
        renotify: !silent && !!d.tag,
        silent,
        requireInteraction: !!d.sticky,
        actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : [],
        data: { url: d.url || "/", reminderId: d.reminderId || null, checkinId: d.checkinId || null },
        vibrate: silent ? undefined : vibrateFor(d),
        timestamp: Date.now(),
      });
      if (!d.silent) await tellOpenTabs({ chime: onScreen, kind: d.kind || null });
    })(),
  );
});

/* The browser renewed or dropped our subscription (updates do this). Make a
   new one right away and tell the server, so pings never stop. */
function b64ToBytes(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(
    (async () => {
      let sub = e.newSubscription || null;
      if (!sub) {
        let key = e.oldSubscription && e.oldSubscription.options ? e.oldSubscription.options.applicationServerKey : null;
        if (!key) {
          const r = await fetch("/api/push", { credentials: "include" });
          const info = r.ok ? await r.json() : {};
          if (!info.publicKey) return;
          key = b64ToBytes(info.publicKey);
        }
        sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      await fetch("/api/push", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.assign(sub.toJSON(), { oldEndpoint: e.oldSubscription ? e.oldSubscription.endpoint : undefined })),
      });
    })().catch(() => {}),
  );
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
