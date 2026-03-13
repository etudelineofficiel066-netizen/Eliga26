import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const STORAGE_KEY = "eliga-push-permission-asked";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(Array.from(rawData).map(c => c.charCodeAt(0)));
}

export type PushPermissionStatus = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermissionStatus>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSupported =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  useEffect(() => {
    if (!isSupported) { setPermission("unsupported"); return; }
    setPermission(Notification.permission as PushPermissionStatus);

    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription()
    ).then(sub => setIsSubscribed(!!sub)).catch(() => {});
  }, [isSupported]);

  // Update badge when app is open too
  useEffect(() => {
    if (!user) return;
    const handleBadge = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
        const data = await res.json();
        if ("setAppBadge" in navigator) {
          if (data.count > 0) (navigator as any).setAppBadge(data.count);
          else (navigator as any).clearAppBadge();
        }
      } catch {}
    };
    handleBadge();
    const interval = setInterval(handleBadge, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle navigation messages from service worker (notification click)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "NAVIGATE" && event.data.url) {
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupported || !user) return { ok: false, error: "non_supporté" };
    setIsLoading(true);
    try {
      // Fetch VAPID public key
      const keyRes = await fetch("/api/push/vapid-key");
      const { key } = await keyRes.json();
      if (!key) return { ok: false, error: "Clé serveur manquante. Contactez l'administrateur." };

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermissionStatus);
      if (perm !== "granted") return { ok: false, error: "refusé" };

      // Wait for SW to be ready AND controlling
      const reg = await navigator.serviceWorker.ready;

      // If no controller yet, wait for it (up to 3 seconds)
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000);
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
      }

      // Subscribe via SW
      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      } catch (subErr: any) {
        console.warn("[Push] pushManager.subscribe error:", subErr);
        return { ok: false, error: subErr?.message || "Échec de la souscription push (navigateur)." };
      }

      // Save to server
      await apiRequest("POST", "/api/push/subscribe", sub.toJSON());
      setIsSubscribed(true);
      localStorage.setItem(STORAGE_KEY, "granted");
      return { ok: true };
    } catch (err: any) {
      console.warn("[Push] Subscribe error:", err);
      return { ok: false, error: err?.message || "Erreur inconnue." };
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiRequest("DELETE", "/api/push/unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
