import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/lib/auth";
import { playNotificationSound } from "@/lib/notification-sound";

const LAST_SEEN_KEY = "eliga-last-notification-id";
const POLL_INTERVAL_MS = 30_000; // fallback polling every 30s

function updateBadge(count: number) {
  if ("setAppBadge" in navigator) {
    if (count > 0) {
      (navigator as any).setAppBadge(count).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }
}

function syncCursorToSW(id: string) {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SET_CURSOR", id });
  }
}

function askSWToCheckNow() {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CHECK_NOW" });
  }
}

async function registerPeriodicSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("periodicSync" in reg) {
      const status = await (navigator as any).permissions.query({ name: "periodic-background-sync" });
      if (status.state === "granted") {
        await (reg as any).periodicSync.register("eliga-notif-sync", { minInterval: 60_000 });
      }
    }
  } catch {}
}

// Convert a base64 URL-safe string to a Uint8Array (needed for VAPID public key)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function subscribeToPush(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // Fetch VAPID public key
    const res = await fetch("/api/push/vapid-public-key", { credentials: "include" });
    if (!res.ok) return;
    const { key } = await res.json();
    if (!key) return;

    const reg = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    // Send subscription to server
    const subJson = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
    });
  } catch {}
}

async function unsubscribeFromPush(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch {}
}

async function showOSNotification(title: string, body: string, url?: string) {
  const options: NotificationOptions = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-96.png",
    tag: "eliga-notif",
    renotify: true,
    silent: true,
    data: { url: url || "/" },
  };
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    } catch {}
  }
  try {
    const n = new Notification(title, options);
    if (url) n.onclick = () => { window.focus(); window.location.href = url; n.close(); };
  } catch {}
}

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export function useNotificationPoller() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotifPermission>("default");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const lastSeenIdRef = useRef<string | null>(localStorage.getItem(LAST_SEEN_KEY));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  useEffect(() => {
    if (!isSupported) { setPermission("unsupported"); return; }
    const p = Notification.permission as NotifPermission;
    setPermission(p);
    setIsEnabled(p === "granted");
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setIsRequesting(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as NotifPermission);
      const ok = perm === "granted";
      setIsEnabled(ok);
      if (ok) {
        try {
          const res = await fetch("/api/notifications", { credentials: "include" });
          if (res.ok) {
            const notifs: any[] = await res.json();
            if (notifs.length > 0) {
              const id = String(notifs[0].id);
              lastSeenIdRef.current = id;
              localStorage.setItem(LAST_SEEN_KEY, id);
              syncCursorToSW(id);
            }
            updateBadge(notifs.filter(n => !n.isRead).length);
          }
        } catch {}
        registerPeriodicSync();
        // Subscribe to Web Push so notifications arrive even when app is closed
        subscribeToPush();
      }
      return ok;
    } finally {
      setIsRequesting(false);
    }
  }, [isSupported]);

  // Handle a single incoming notification (from SSE or poll)
  const handleNewNotification = useCallback(async (notif: any) => {
    if (Notification.permission !== "granted") return;

    const id = String(notif.id);
    if (lastSeenIdRef.current === id) return; // already seen

    playNotificationSound();

    const url = notif.tournamentId ? `/tournaments/${notif.tournamentId}` : "/";
    await showOSNotification("eLIGA", notif.content, url);

    lastSeenIdRef.current = id;
    localStorage.setItem(LAST_SEEN_KEY, id);
    syncCursorToSW(id);

    // Refresh badge
    try {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
      if (res.ok) {
        const { count } = await res.json();
        updateBadge(count);
      }
    } catch {}
  }, []);

  // Fallback polling (for missed SSE events or reconnects)
  const poll = useCallback(async () => {
    if (!user || Notification.permission !== "granted") return;
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return;
      const notifs: any[] = await res.json();
      if (!notifs || notifs.length === 0) return;

      const totalUnread = notifs.filter(n => !n.isRead).length;
      updateBadge(totalUnread);

      const lastSeenId = lastSeenIdRef.current;
      const lastSeenIndex = lastSeenId
        ? notifs.findIndex(n => String(n.id) === lastSeenId)
        : -1;

      const newOnes = lastSeenId
        ? notifs.filter(n => !n.isRead && String(n.id) !== lastSeenId &&
            (lastSeenIndex === -1 || notifs.indexOf(n) < lastSeenIndex))
        : notifs.filter(n => !n.isRead);

      if (newOnes.length > 0) {
        playNotificationSound();
        if (newOnes.length === 1) {
          await showOSNotification(
            "eLIGA",
            newOnes[0].content,
            newOnes[0].tournamentId ? `/tournaments/${newOnes[0].tournamentId}` : "/"
          );
        } else {
          await showOSNotification("eLIGA", `${newOnes.length} nouvelles notifications`);
        }
      }

      if (notifs.length > 0) {
        const newId = String(notifs[0].id);
        lastSeenIdRef.current = newId;
        localStorage.setItem(LAST_SEEN_KEY, newId);
        syncCursorToSW(newId);
      }
    } catch {}
  }, [user]);

  // Connect SSE + start fallback poll
  useEffect(() => {
    if (!user || !isSupported) return;
    if (Notification.permission !== "granted") return;

    lastSeenIdRef.current = localStorage.getItem(LAST_SEEN_KEY);

    // ── SSE connection ──────────────────────────────────────────────────────
    let sseRetryTimer: ReturnType<typeof setTimeout> | null = null;

    function connectSSE() {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }

      const es = new EventSource("/api/notifications/stream", { withCredentials: true });
      sseRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "notification" && data.notification) {
            handleNewNotification(data.notification);
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        sseRef.current = null;
        // Reconnect after 5s
        sseRetryTimer = setTimeout(connectSSE, 5_000);
      };
    }

    connectSSE();

    // Register push subscription (in case user already granted permission in a previous session)
    subscribeToPush();

    // ── Fallback polling (catches anything SSE missed) ──────────────────────
    timerRef.current = setInterval(() => {
      if (!document.hidden) poll();
    }, POLL_INTERVAL_MS);

    // Immediate poll + SW check on visibility restore
    const onVisible = () => {
      if (!document.hidden) {
        poll();
        askSWToCheckNow();
        // Reconnect SSE if it dropped while hidden
        if (!sseRef.current || sseRef.current.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Listen for PLAY_SOUND from Service Worker (background wakeup)
    const onSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "PLAY_SOUND") {
        playNotificationSound();
      }
    };
    navigator.serviceWorker.addEventListener("message", onSWMessage);

    registerPeriodicSync();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sseRetryTimer) clearTimeout(sseRetryTimer);
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      navigator.serviceWorker.removeEventListener("message", onSWMessage);
    };
  }, [user, isSupported, permission, poll, handleNewNotification]);

  const disable = useCallback(() => {
    setIsEnabled(false);
    updateBadge(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    unsubscribeFromPush();
  }, []);

  return {
    isSupported,
    permission,
    isEnabled,
    isRequesting,
    requestPermission,
    disable,
  };
}
