import { useCallback, useEffect, useRef, useState } from "react";
import { Either } from "effect";
import {
  decodeServerMessage,
  encodeClientMessage,
  type ClientMessage,
  type PlaybackState,
  type QueueItem,
  type RoomSettings,
  type RosterEntry,
} from "@/lib/schemas/room-ws";

// Frontend glue for the KaraokeRoom Durable Object WebSocket. Deliberately
// thin — protocol validation (decode/encode) lives in
// `app/lib/schemas/room-ws.ts` and is unit-tested there; this hook just
// wires a browser WebSocket to that already-tested layer plus reconnect
// bookkeeping. No app-level test harness for DOM/WebSocket exists yet in
// this repo (see `app/hooks/use-mobile.ts`, also untested) — adding one is
// out of scope for Phase 2.

export type ConnectionStatus =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed";

export interface RoomSocketState {
  readonly queue: readonly QueueItem[];
  readonly playback: PlaybackState | null;
  readonly roster: readonly RosterEntry[];
  readonly settings: RoomSettings | null;
}

const INITIAL_STATE: RoomSocketState = {
  queue: [],
  playback: null,
  roster: [],
  settings: null,
};

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 8000;

const wsUrlFor = (code: string, nickname?: string): string => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const url = new URL(
    `${protocol}://${window.location.host}/api/room/${encodeURIComponent(code)}/ws`
  );
  if (nickname) url.searchParams.set("nickname", nickname);
  return url.toString();
};

export interface UseRoomSocketOptions {
  readonly code: string;
  readonly nickname?: string;
  /** Set false to skip connecting (e.g. before the code is known). */
  readonly enabled?: boolean;
}

export interface UseRoomSocketResult {
  readonly state: RoomSocketState;
  readonly send: (message: ClientMessage) => boolean;
  readonly connectionStatus: ConnectionStatus;
}

export function useRoomSocket({
  code,
  nickname,
  enabled = true,
}: UseRoomSocketOptions): UseRoomSocketResult {
  const [state, setState] = useState<RoomSocketState>(INITIAL_STATE);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(MIN_BACKOFF_MS);

  useEffect(() => {
    // SSR guard — this hook only ever runs client-side, but be explicit.
    if (typeof window === "undefined" || !enabled) return;

    // Per-effect cancellation flag (NOT a shared ref): when `code`/`nickname`
    // change, the old effect's socket `close` event fires asynchronously —
    // after the next effect has already started. A shared ref would have been
    // reset to `false` by then, letting the OLD close handler schedule a
    // reconnect whose closure still captures the stale room code and
    // overwrite `wsRef` with a socket bound to the wrong room. A closure
    // variable belongs to exactly one effect run, so the stale handler
    // always sees its own `cancelled = true`.
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(wsUrlFor(code, nickname));
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        backoffRef.current = MIN_BACKOFF_MS;
        setConnectionStatus("open");
      });

      ws.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        const decoded = decodeServerMessage(event.data);
        if (Either.isLeft(decoded)) return;
        const message = decoded.right;

        setState((prev): RoomSocketState => {
          switch (message.type) {
            // Full snapshot — arrives on connect and on reconnect, so a
            // resync after a dropped connection always lands here.
            case "room.state":
              return {
                queue: message.queue,
                playback: message.playback,
                roster: message.roster,
                settings: message.settings,
              };
            case "queue.updated":
              return { ...prev, queue: message.queue };
            case "playback.updated":
              return { ...prev, playback: message.playback };
            case "roster.updated":
              return { ...prev, roster: message.roster };
            case "error":
              return prev;
          }
        });
      });

      ws.addEventListener("close", () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (cancelled) return;

        setConnectionStatus("reconnecting");
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        reconnectTimer = setTimeout(connect, delay);
      });

      // The browser always follows a socket "error" with "close" — actual
      // reconnect scheduling lives in the close handler above.
      ws.addEventListener("error", () => {});
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      setConnectionStatus("closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, nickname, enabled]);

  const send = useCallback((message: ClientMessage) => {
    const ws = wsRef.current;
    // Returns whether the message actually went out — the socket may be
    // closed (reconnecting). Callers that optimistically mutate need to
    // know a revert `send()` was itself dropped so they can surface it.
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(encodeClientMessage(message));
    return true;
  }, []);

  return { state, send, connectionStatus };
}
