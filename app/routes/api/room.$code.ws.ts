// WebSocket upgrade boundary for a room's live session. Non-tRPC HTTP
// route — per `.brain/rules/routes.md` "HTTP boundary routes", the Effect
// program builds a `Response` directly via `Effect.catchTags`, run with
// `runPromiseExit` + `Exit.match` rather than `runProcedure`.
import { Effect, Exit, Schema } from "effect";
import { RoomRepository, failIfClosed } from "@/repositories/room";
import { ExternalServiceError, ValidationError } from "@/models/errors/repository";
import { Nickname, RoomCode } from "@/lib/schemas/room";
import type { Route } from "./+types/room.$code.ws";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected a WebSocket upgrade", { status: 426 });
  }

  const code = params.code;
  if (!code) {
    return new Response("Missing room code", { status: 400 });
  }

  const nicknameParam = new URL(request.url).searchParams.get("nickname");

  const program = Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => context.auth.api.getSession({ headers: request.headers }),
      catch: (cause) => new ExternalServiceError({ service: "BetterAuth", cause }),
    });
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const roomCode = yield* Schema.decodeUnknown(RoomCode)(code).pipe(
      Effect.mapError(
        () =>
          new ValidationError({
            entity: "room",
            field: "code",
            message: "Invalid room code",
          })
      )
    );

    const repo = yield* RoomRepository;
    const room = yield* repo.getRoomByCode({ code: roomCode });
    yield* failIfClosed(room);

    const role = session.user.id === room.hostUserId ? "host" : "guest";

    let nickname = session.user.name;
    if (nicknameParam) {
      nickname = yield* Schema.decodeUnknown(Nickname)(nicknameParam).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              entity: "nickname",
              field: "nickname",
              message: "Invalid nickname",
            })
        )
      );
    }

    const env = context.cloudflare.env;
    const stub = env.KARAOKE_ROOM.get(env.KARAOKE_ROOM.idFromName(room.id));

    // Clone the incoming request, adding the identity headers the DO trusts
    // to assign role/nickname — the DO never talks to Better Auth or the
    // repository layer itself. `x-room-id` lets the DO's idle-close alarm
    // know which D1 row to close; `x-allow-guest-reorder` seeds the DO's
    // in-memory settings from D1 on a fresh (never-persisted) DO instance
    // so a reopened room's live state matches the D1 flag.
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set("x-user-id", session.user.id);
    forwardHeaders.set("x-nickname", nickname);
    forwardHeaders.set("x-avatar-url", session.user.image ?? "");
    forwardHeaders.set("x-role", role);
    forwardHeaders.set("x-room-id", room.id);
    forwardHeaders.set("x-allow-guest-reorder", String(room.allowGuestReorder));
    const forwardedRequest = new Request(request.url, {
      method: request.method,
      headers: forwardHeaders,
    });

    return yield* Effect.tryPromise({
      try: () => stub.fetch(forwardedRequest),
      catch: (cause) =>
        new ExternalServiceError({ service: "KaraokeRoomDO", cause }),
    });
  }).pipe(
    Effect.tapErrorCause((cause) => Effect.logError("Room WS upgrade failed", cause)),
    Effect.catchTags({
      RoomNotFoundError: () =>
        Effect.succeed(new Response("Room not found", { status: 404 })),
      RoomClosedError: () =>
        Effect.succeed(new Response("Room is closed", { status: 409 })),
      ValidationError: (e) =>
        Effect.succeed(new Response(e.message, { status: 400 })),
      ExternalServiceError: () =>
        Effect.succeed(
          new Response("Service temporarily unavailable", { status: 503 })
        ),
    })
  );

  const exit = await context.runtime.runPromiseExit(program);
  return Exit.match(exit, {
    onSuccess: (response) => response,
    onFailure: () => new Response("Internal Server Error", { status: 500 }),
  });
}
