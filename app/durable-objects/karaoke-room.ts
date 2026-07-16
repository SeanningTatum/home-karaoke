// Cloudflare Durable Object — one instance per room, addressed by room id
// (see `app/routes/api/room.$code.ws.ts` for how the stub is resolved).
//
// This is a Workers runtime boundary, same class as `workers/app.ts` — per
// `.brain/codebase/effect-ts.md` / the Phase-2 task brief, it stays plain,
// deterministic TypeScript rather than forcing an Effect runtime into the
// Hibernation API's callback shape. All state-transition logic is pure and
// lives in `app/lib/room-state.ts` (unit-tested there); this class only
// resolves side effects — WebSocket accept/send, storage, ids, the clock —
// and calls straight into it. No `throw` escapes this class: `ws.send` /
// storage calls are wrapped in `try`/`catch` purely to avoid one dead peer
// crashing a broadcast loop for everyone else, which is the DO-boundary
// equivalent of the HTTP-boundary `Exit.match` pattern used elsewhere.
import { DurableObject } from "cloudflare:workers";
import { Either } from "effect";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import {
  decodeClientMessage,
  encodeServerMessage,
  type ClientMessage,
  type Role,
  type ServerMessage,
} from "@/lib/schemas/room-ws";
import {
  addToRoster,
  applyClientMessage,
  broadcastsForMessage,
  canPerform,
  createInitialRoomState,
  forbiddenError,
  removeFromRoster,
  roomStateSnapshot,
  rosterUpdated,
  setGuestReorder,
  type RoomLiveState,
} from "@/lib/room-state";

const STATE_STORAGE_KEY = "room-live-state";
const ROOM_ID_STORAGE_KEY = "room-id";
const HEARTBEAT_PING = "ping";
const HEARTBEAT_PONG = "pong";
// Sliding idle-close window (Phase 5) — re-armed on every WS connect and
// every message. If the alarm fires with no sockets connected, the room is
// considered abandoned: the D1 row is marked closed and the DO's live
// state is cleared. If sockets are still connected when it fires, it's
// just re-armed rather than closing an active room.
const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

export interface SessionAttachment {
  readonly userId: string;
  readonly nickname: string;
  readonly role: Role;
}

const isSessionAttachment = (value: unknown): value is SessionAttachment =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).userId === "string" &&
  typeof (value as Record<string, unknown>).nickname === "string" &&
  ((value as Record<string, unknown>).role === "host" ||
    (value as Record<string, unknown>).role === "guest");

export class KaraokeRoom extends DurableObject<Env> {
  private liveState: RoomLiveState;
  private readonly sessions = new Map<WebSocket, SessionAttachment>();
  // True once `liveState` has ever been hydrated from storage (a real prior
  // connect persisted it) — distinguishes a genuinely fresh DO (never
  // persisted; settings should seed from D1 via the `x-allow-guest-reorder`
  // header) from one that's simply been evicted and is reloading its own
  // prior state.
  private hydratedFromStorage = false;
  // The D1 `room.id` this DO instance backs — persisted so `alarm()` (which
  // runs with no inbound request/headers) knows which row to close on idle
  // timeout.
  private roomId: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.liveState = createInitialRoomState({ allowGuestReorder: false });

    // Heartbeats answered by the runtime without waking this DO.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(HEARTBEAT_PING, HEARTBEAT_PONG)
    );

    // Rebuild the session map from hibernated sockets — the DO's JS state
    // (including `this.sessions`) is gone after eviction, but the sockets
    // themselves and their attachments survive.
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (isSessionAttachment(attachment)) {
        this.sessions.set(ws, attachment);
      }
    }

    // Load persisted room state before handling any request. Blocks
    // concurrent request handling until it resolves, per the standard DO
    // hydration pattern.
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<RoomLiveState>(
        STATE_STORAGE_KEY
      );
      if (stored) {
        this.liveState = stored;
        this.hydratedFromStorage = true;
      }
      const storedRoomId = await this.ctx.storage.get<string>(
        ROOM_ID_STORAGE_KEY
      );
      if (storedRoomId) this.roomId = storedRoomId;
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const userId = request.headers.get("x-user-id");
    const nickname = request.headers.get("x-nickname");
    const role = request.headers.get("x-role");
    if (!userId || !nickname || (role !== "host" && role !== "guest")) {
      return new Response("Missing or invalid identity headers", {
        status: 400,
      });
    }

    // Remember which D1 row this DO backs (for `alarm()`) — cheap to
    // re-write on every connect since it's a no-op after the first.
    const roomIdHeader = request.headers.get("x-room-id");
    if (roomIdHeader && this.roomId !== roomIdHeader) {
      this.roomId = roomIdHeader;
      await this.ctx.storage.put(ROOM_ID_STORAGE_KEY, roomIdHeader);
    }

    // Seed live settings from D1 on a genuinely fresh DO (never persisted
    // any state yet) — keeps a reopened room's live `allowGuestReorder`
    // consistent with the D1 flag instead of always defaulting to false.
    // Once hydrated (from storage OR from this seed), later connects never
    // re-apply the header — the DO's own live state is authoritative from
    // then on (a host may have since toggled it via `room.setGuestReorder`).
    const allowGuestReorderHeader = request.headers.get(
      "x-allow-guest-reorder"
    );
    if (!this.hydratedFromStorage && allowGuestReorderHeader !== null) {
      this.liveState = setGuestReorder(
        this.liveState,
        allowGuestReorderHeader === "true"
      );
      this.hydratedFromStorage = true;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const attachment: SessionAttachment = { userId, nickname, role };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);
    this.sessions.set(server, attachment);

    this.liveState = addToRoster(this.liveState, {
      userId,
      nickname,
      role,
    });
    await this.persist();
    await this.armIdleAlarm();

    this.send(server, roomStateSnapshot(this.liveState));
    this.broadcast(rosterUpdated(this.liveState), server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    await this.armIdleAlarm();

    const session = this.sessionFor(ws);
    if (!session) {
      this.send(ws, {
        type: "error",
        code: "UNAUTHORIZED",
        message: "No session attached to this connection",
      });
      return;
    }

    if (typeof message !== "string") {
      this.send(ws, {
        type: "error",
        code: "UNSUPPORTED_MESSAGE",
        message: "Binary messages are not supported",
      });
      return;
    }

    const decoded = decodeClientMessage(message);
    if (Either.isLeft(decoded)) {
      this.send(ws, {
        type: "error",
        code: "PARSE_ERROR",
        message: "Could not parse message",
      });
      return;
    }
    const clientMessage: ClientMessage = decoded.right;

    if (
      !canPerform(clientMessage, {
        userId: session.userId,
        role: session.role,
        state: this.liveState,
      })
    ) {
      this.send(ws, forbiddenError(clientMessage));
      return;
    }

    this.liveState = applyClientMessage(this.liveState, clientMessage, {
      userId: session.userId,
      nickname: session.nickname,
      role: session.role,
      newQueueItemId: crypto.randomUUID(),
      now: Date.now(),
    });
    await this.persist();

    for (const outgoing of broadcastsForMessage(clientMessage, this.liveState)) {
      this.broadcast(outgoing);
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): Promise<void> {
    await this.disconnect(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("karaoke-room: websocket error", error);
    await this.disconnect(ws);
  }

  /**
   * Fires ~`IDLE_TIMEOUT_MS` after the last WS connect/message (the alarm
   * is a single sliding timer per DO — every `armIdleAlarm()` call
   * overwrites it). If nobody is connected when it fires, the room is
   * treated as abandoned: the D1 row is marked closed and this DO's live
   * state is cleared. Otherwise it's just re-armed for another window.
   */
  async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    if (sockets.length > 0) {
      await this.armIdleAlarm();
      return;
    }

    if (this.roomId) {
      await this.closeRoomInD1(this.roomId);
    }

    await this.ctx.storage.deleteAll();
    this.liveState = createInitialRoomState({ allowGuestReorder: false });
    this.hydratedFromStorage = false;
    this.roomId = null;
    this.sessions.clear();
  }

  private async armIdleAlarm(): Promise<void> {
    try {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_TIMEOUT_MS);
    } catch (error) {
      console.error("karaoke-room: failed to arm idle alarm", error);
    }
  }

  /**
   * Runtime-boundary allowance (`.brain/codebase/effect-ts.md` — this class
   * stays plain TS, not Effect): the DO runs in the same Worker script with
   * the same `env`, so it constructs Drizzle over `env.DATABASE` directly
   * rather than going through the `Database` Effect service / repository
   * layer. Kept to a single, obvious update; failures are logged, never
   * thrown — this is a best-effort cleanup on an idle timeout, not a path a
   * caller is waiting on.
   */
  private async closeRoomInD1(roomId: string): Promise<void> {
    try {
      const db = drizzleD1(this.env.DATABASE, { schema });
      await db
        .update(schema.room)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(schema.room.id, roomId));
    } catch (error) {
      console.error(
        "karaoke-room: failed to close room in D1 on idle timeout",
        error
      );
    }
  }

  private async disconnect(ws: WebSocket): Promise<void> {
    const session = this.sessionFor(ws);
    this.sessions.delete(ws);
    if (!session) return;

    this.liveState = removeFromRoster(this.liveState, session.userId);
    await this.persist();
    this.broadcast(rosterUpdated(this.liveState));
  }

  private sessionFor(ws: WebSocket): SessionAttachment | undefined {
    const cached = this.sessions.get(ws);
    if (cached) return cached;
    const attachment = ws.deserializeAttachment();
    if (isSessionAttachment(attachment)) {
      this.sessions.set(ws, attachment);
      return attachment;
    }
    return undefined;
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put(STATE_STORAGE_KEY, this.liveState);
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(encodeServerMessage(message));
    } catch (error) {
      console.error("karaoke-room: failed to send to a socket", error);
    }
  }

  /** Broadcasts to every connected socket, optionally excluding one. */
  private broadcast(message: ServerMessage, exclude?: WebSocket): void {
    const encoded = encodeServerMessage(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      try {
        ws.send(encoded);
      } catch (error) {
        console.error("karaoke-room: failed to broadcast to a socket", error);
      }
    }
  }
}
