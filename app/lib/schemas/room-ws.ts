import { Either, Schema } from "effect";
import type { ParseError } from "effect/ParseResult";

// Wire protocol for the KaraokeRoom Durable Object WebSocket (Phase 2).
// Every message is a plain JSON object discriminated by a `type` literal —
// deliberately not Effect's `_tag` convention, since these cross the wire
// and get hand-inspected in browser devtools.

// --- Shared domain shapes -------------------------------------------------

export const QueueItem = Schema.Struct({
  id: Schema.String,
  videoId: Schema.String,
  title: Schema.String,
  channel: Schema.String,
  thumbnailUrl: Schema.String,
  singerNickname: Schema.String,
  addedByUserId: Schema.NullOr(Schema.String),
  addedAt: Schema.Number,
});
export type QueueItem = typeof QueueItem.Type;

export const PlaybackStatus = Schema.Literal("idle", "playing", "paused");
export type PlaybackStatus = typeof PlaybackStatus.Type;

export const PlaybackState = Schema.Struct({
  status: PlaybackStatus,
  currentItem: Schema.NullOr(QueueItem),
  volume: Schema.Number.pipe(Schema.between(0, 100)),
});
export type PlaybackState = typeof PlaybackState.Type;

export const Role = Schema.Literal("host", "guest");
export type Role = typeof Role.Type;

export const RosterEntry = Schema.Struct({
  userId: Schema.String,
  nickname: Schema.String,
  role: Role,
});
export type RosterEntry = typeof RosterEntry.Type;

export const RoomSettings = Schema.Struct({
  allowGuestReorder: Schema.Boolean,
});
export type RoomSettings = typeof RoomSettings.Type;

// --- Client -> server messages ---------------------------------------------

export const QueueAddMessage = Schema.Struct({
  type: Schema.Literal("queue.add"),
  videoId: Schema.String,
  title: Schema.String,
  channel: Schema.String,
  thumbnailUrl: Schema.String,
});
export type QueueAddMessage = typeof QueueAddMessage.Type;

export const QueueRemoveMessage = Schema.Struct({
  type: Schema.Literal("queue.remove"),
  queueItemId: Schema.String,
});
export type QueueRemoveMessage = typeof QueueRemoveMessage.Type;

export const QueueReorderMessage = Schema.Struct({
  type: Schema.Literal("queue.reorder"),
  queueItemId: Schema.String,
  toIndex: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
});
export type QueueReorderMessage = typeof QueueReorderMessage.Type;

export const PlaybackPlayMessage = Schema.Struct({
  type: Schema.Literal("playback.play"),
});
export type PlaybackPlayMessage = typeof PlaybackPlayMessage.Type;

export const PlaybackPauseMessage = Schema.Struct({
  type: Schema.Literal("playback.pause"),
});
export type PlaybackPauseMessage = typeof PlaybackPauseMessage.Type;

export const PlaybackSkipMessage = Schema.Struct({
  type: Schema.Literal("playback.skip"),
});
export type PlaybackSkipMessage = typeof PlaybackSkipMessage.Type;

export const PlaybackSetVolumeMessage = Schema.Struct({
  type: Schema.Literal("playback.setVolume"),
  volume: Schema.Number.pipe(Schema.between(0, 100)),
});
export type PlaybackSetVolumeMessage = typeof PlaybackSetVolumeMessage.Type;

export const PlaybackVideoEndedMessage = Schema.Struct({
  type: Schema.Literal("playback.videoEnded"),
});
export type PlaybackVideoEndedMessage = typeof PlaybackVideoEndedMessage.Type;

export const RoomSetGuestReorderMessage = Schema.Struct({
  type: Schema.Literal("room.setGuestReorder"),
  allowed: Schema.Boolean,
});
export type RoomSetGuestReorderMessage = typeof RoomSetGuestReorderMessage.Type;

export const ClientMessage = Schema.Union(
  QueueAddMessage,
  QueueRemoveMessage,
  QueueReorderMessage,
  PlaybackPlayMessage,
  PlaybackPauseMessage,
  PlaybackSkipMessage,
  PlaybackSetVolumeMessage,
  PlaybackVideoEndedMessage,
  RoomSetGuestReorderMessage
);
export type ClientMessage = typeof ClientMessage.Type;

// --- Server -> client messages ----------------------------------------------

export const RoomStateMessage = Schema.Struct({
  type: Schema.Literal("room.state"),
  queue: Schema.Array(QueueItem),
  playback: PlaybackState,
  roster: Schema.Array(RosterEntry),
  settings: RoomSettings,
});
export type RoomStateMessage = typeof RoomStateMessage.Type;

export const QueueUpdatedMessage = Schema.Struct({
  type: Schema.Literal("queue.updated"),
  queue: Schema.Array(QueueItem),
});
export type QueueUpdatedMessage = typeof QueueUpdatedMessage.Type;

export const PlaybackUpdatedMessage = Schema.Struct({
  type: Schema.Literal("playback.updated"),
  playback: PlaybackState,
});
export type PlaybackUpdatedMessage = typeof PlaybackUpdatedMessage.Type;

export const RosterUpdatedMessage = Schema.Struct({
  type: Schema.Literal("roster.updated"),
  roster: Schema.Array(RosterEntry),
});
export type RosterUpdatedMessage = typeof RosterUpdatedMessage.Type;

export const ErrorMessage = Schema.Struct({
  type: Schema.Literal("error"),
  code: Schema.String,
  message: Schema.String,
});
export type ErrorMessage = typeof ErrorMessage.Type;

export const ServerMessage = Schema.Union(
  RoomStateMessage,
  QueueUpdatedMessage,
  PlaybackUpdatedMessage,
  RosterUpdatedMessage,
  ErrorMessage
);
export type ServerMessage = typeof ServerMessage.Type;

// --- Encode / decode helpers -------------------------------------------------
//
// These run at a non-Effect boundary (inside the plain-TS Durable Object and
// inside the client-side React hook), so they return `Either` rather than an
// `Effect` — callers there aren't running inside a fiber. `JSON.parse` can
// throw synchronously; `Either.try` captures that without leaking a raw
// `throw` to the caller.

export type DecodeMessageError =
  | { readonly _tag: "JsonParseError"; readonly cause: unknown }
  | { readonly _tag: "SchemaParseError"; readonly cause: ParseError };

const jsonParse = (raw: string): Either.Either<unknown, DecodeMessageError> =>
  Either.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) => ({ _tag: "JsonParseError" as const, cause }),
  });

export const decodeClientMessage = (
  raw: string
): Either.Either<ClientMessage, DecodeMessageError> =>
  jsonParse(raw).pipe(
    Either.flatMap((parsed) =>
      Schema.decodeUnknownEither(ClientMessage)(parsed).pipe(
        Either.mapLeft((cause) => ({ _tag: "SchemaParseError" as const, cause }))
      )
    )
  );

export const decodeServerMessage = (
  raw: string
): Either.Either<ServerMessage, DecodeMessageError> =>
  jsonParse(raw).pipe(
    Either.flatMap((parsed) =>
      Schema.decodeUnknownEither(ServerMessage)(parsed).pipe(
        Either.mapLeft((cause) => ({ _tag: "SchemaParseError" as const, cause }))
      )
    )
  );

// Encoding is just `JSON.stringify` — both unions are plain literal/string/
// number/boolean structs with no transformations, so the wire shape already
// matches the encoded shape. Typed input keeps callers from serializing
// something outside the protocol.
export const encodeClientMessage = (message: ClientMessage): string =>
  JSON.stringify(message);

export const encodeServerMessage = (message: ServerMessage): string =>
  JSON.stringify(message);
