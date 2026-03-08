const CACHE_NAME = "eliga-v13";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/favicon.png"
];

// ---------- Install / Activate ----------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: "reload" })));
    }).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== "eliga-notif-meta")
             .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- Fetch strategy ----------

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: "Hors ligne" }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          return cached || new Response("Hors ligne — Rafraîchissez la page", { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

// ---------- Notification cursor helpers (stored in CacheStorage) ----------

async function readCursor() {
  try {
    const cache = await caches.open("eliga-notif-meta");
    const r = await cache.match("/notif-cursor");
    return r ? r.text() : null;
  } catch { return null; }
}

async function saveCursor(id) {
  try {
    const cache = await caches.open("eliga-notif-meta");
    await cache.put("/notif-cursor", new Response(id));
  } catch {}
}

// ---------- Core polling logic (shared by periodicSync + manual trigger) ----------

async function checkAndNotify() {
  try {
    const res = await fetch("/api/notifications", { credentials: "include" });
    if (!res.ok) return;
    const notifs = await res.json();
    if (!notifs || notifs.length === 0) return;

    // Update badge
    const unread = notifs.filter(n => !n.isRead).length;
    if ("setAppBadge" in self.navigator) {
      unread > 0
        ? self.navigator.setAppBadge(unread).catch(() => {})
        : self.navigator.clearAppBadge().catch(() => {});
    }

    const lastSeenId = await readCursor();
    const lastSeenIndex = lastSeenId ? notifs.findIndex(n => String(n.id) === String(lastSeenId)) : -1;

    const newOnes = lastSeenId
      ? notifs.filter(n => !n.isRead && String(n.id) !== String(lastSeenId) &&
          (lastSeenIndex === -1 || notifs.indexOf(n) < lastSeenIndex))
      : notifs.filter(n => !n.isRead);

    if (newOnes.length > 0) {
      const title = "Eliga";
      const body = newOnes.length === 1
        ? newOnes[0].content
        : `${newOnes.length} nouvelles notifications`;
      const url = newOnes.length === 1 && newOnes[0].tournamentId
        ? `/tournaments/${newOnes[0].tournamentId}`
        : "/";

      await self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-96.png",
        tag: "eliga-notif",
        renotify: true,
        vibrate: [200, 100, 200, 100, 400],
        silent: true,
        data: { url }
      });
    }

    // Advance cursor
    if (notifs.length > 0) {
      await saveCursor(String(notifs[0].id));
    }

    // Tell open tabs to play sound if there are new notifications
    if (newOnes.length > 0) {
      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of allClients) {
        client.postMessage({ type: "PLAY_SOUND" });
      }
    }
  } catch {}
}

// ---------- Periodic Background Sync (Chrome Android — works screen-off) ----------

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "eliga-notif-sync") {
    event.waitUntil(checkAndNotify());
  }
});

// ---------- Web Push fallback ----------

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: "Eliga", body: event.data.text() }; }

  const title = payload.title || "Eliga";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-96.png",
    tag: "eliga",
    renotify: true,
    vibrate: [200, 100, 200],
    silent: true,
    data: payload.data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------- Notification click — open/focus the app ----------

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  if (event.action === "close") return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.postMessage({ type: "NAVIGATE", url });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ---------- Messages from the page ----------

self.addEventListener("message", (event) => {
  if (!event.data) return;

  // Force SW update
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Page telling SW to update its cursor (stays in sync)
  if (event.data.type === "SET_CURSOR" && event.data.id) {
    saveCursor(String(event.data.id));
  }

  // Page asking SW to do an immediate check (e.g. on visibility change)
  if (event.data.type === "CHECK_NOW") {
    checkAndNotify();
  }
});
