import { useEffect, useRef, useCallback } from "react";

export type Reaction = { emoji: string; count: number; userIds: string[] };

export type WsEvent =
  | { type: "message"; message: any }
  | { type: "message_sent"; message: any }
  | { type: "typing"; userId: string; isTyping: boolean }
  | { type: "read"; receiverId: string }
  | { type: "reaction"; messageId: string; userId: string; emoji: string; action: "add" | "remove" }
  | { type: "message_deleted"; messageId: string };

export function useWebSocket(onEvent: (event: WsEvent) => void, enabled = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connectWS = useCallback(async () => {
    if (!isMountedRef.current || !enabled) return;
    try {
      const res = await fetch("/api/auth/ws-token");
      if (!res.ok || !isMountedRef.current) return;
      const { token } = await res.json();
      if (!isMountedRef.current) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WsEvent;
          onEventRef.current(event);
        } catch {}
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (isMountedRef.current) {
          setTimeout(connectWS, 3000);
        }
      };

      ws.onerror = () => ws.close();

      wsRef.current = ws;
    } catch {}
  }, [enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) connectWS();
    return () => {
      isMountedRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connectWS, enabled]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
