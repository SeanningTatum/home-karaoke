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
  // Absent key decodes to null so old hibernated DO state and old clients
  // (which never wrote this field) still parse.
  singerAvatarUrl: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
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
  // Absent key decodes to null so old hibernated DO state and old clients
  // (which never wrote this field) still parse.
  avatarUrl: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  role: Role,
});
export type RosterEntry = typeof RosterEntry.Type;

export const RoomSettings = Schema.Struct({
  allowGuestReorder: Schema.Boolean,
});
export type RoomSettings = typeof RoomSettings.Type;

// --- Reactions ---------------------------------------------------------------

/**
 * The fixed emoji palette guests can react with (human-approved, final).
 * Order is load-bearing: it's the stable tiebreak for equal-count entries in
 * a recap breakdown (see `app/lib/reactions.ts`).
 */
export const REACTION_EMOJIS = ["👏", "🔥", "❤️", "😭", "🤩", "🎉"] as const;

export const ReactionEmoji = Schema.Literal(...REACTION_EMOJIS);
export type ReactionEmoji = typeof ReactionEmoji.Type;

/**
 * Upper bound on a single `reaction.send` count. Guests batch taps client-side
 * (~300ms) and send one message per batch; both the schema below and the
 * reducer (`clampReactionCount`) clamp to this so a hand-crafted message can't
 * inflate the tally. No DO-side rate throttle in v1 — this clamp plus the
 * 40-particle DOM cap is the whole rate-limiting story.
 */
export const MAX_REACTION_BATCH = 20;

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
  // Id of the queue item the sender believes is currently playing. The DO
  // ignores the advance if it no longer matches `currentItem` — prevents a
  // second dual-screen skip/videoEnded from advancing the queue twice and
  // silently dropping a song. Optional for backward-compatible clients.
  currentItemId: Schema.optional(Schema.String),
});
export type PlaybackSkipMessage = typeof PlaybackSkipMessage.Type;

export const PlaybackSetVolumeMessage = Schema.Struct({
  type: Schema.Literal("playback.setVolume"),
  volume: Schema.Number.pipe(Schema.between(0, 100)),
});
export type PlaybackSetVolumeMessage = typeof PlaybackSetVolumeMessage.Type;

export const PlaybackVideoEndedMessage = Schema.Struct({
  type: Schema.Literal("playback.videoEnded"),
  // See PlaybackSkipMessage.currentItemId — same idempotency guard so a
  // natural end + a simultaneous remote skip can't double-advance.
  currentItemId: Schema.optional(Schema.String),
});
export type PlaybackVideoEndedMessage = typeof PlaybackVideoEndedMessage.Type;

export const RoomSetGuestReorderMessage = Schema.Struct({
  type: Schema.Literal("room.setGuestReorder"),
  allowed: Schema.Boolean,
});
export type RoomSetGuestReorderMessage = typeof RoomSetGuestReorderMessage.Type;

export const ReactionSendMessage = Schema.Struct({
  type: Schema.Literal("reaction.send"),
  emoji: ReactionEmoji,
  // Number of taps in this batch. Optional (defaults to 1 in the reducer) —
  // same backward-compatible-optional-field shape as `playback.skip`'s
  // `currentItemId`. Rejected outside [1, MAX_REACTION_BATCH]; the reducer
  // clamps again defensively.
  count: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.between(1, MAX_REACTION_BATCH))
  ),
});
export type ReactionSendMessage = typeof ReactionSendMessage.Type;

export const ClientMessage = Schema.Union(
  QueueAddMessage,
  QueueRemoveMessage,
  QueueReorderMessage,
  PlaybackPlayMessage,
  PlaybackPauseMessage,
  PlaybackSkipMessage,
  PlaybackSetVolumeMessage,
  PlaybackVideoEndedMessage,
  RoomSetGuestReorderMessage,
  ReactionSendMessage
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

// Terminal broadcast: the room is over (host ended it via `room.close`, or a
// future server-side close path). Clients should stop reconnecting — the WS
// upgrade route rejects closed rooms with 409 anyway — and re-resolve the
// room via their loader to render the closed state.
export const RoomClosedMessage = Schema.Struct({
  type: Schema.Literal("room.closed"),
});
export type RoomClosedMessage = typeof RoomClosedMessage.Type;

export const ErrorMessage = Schema.Struct({
  type: Schema.Literal("error"),
  code: Schema.String,
  message: Schema.String,
});
export type ErrorMessage = typeof ErrorMessage.Type;

// A single guest's reaction batch, fanned out to every socket (including the
// reactor's own phone, so their fly-up matches the TV). `count` is already
// clamped server-side — clients render it as-is.
export const ReactionBurstMessage = Schema.Struct({
  type: Schema.Literal("reaction.burst"),
  emoji: ReactionEmoji,
  count: Schema.Number,
});
export type ReactionBurstMessage = typeof ReactionBurstMessage.Type;

// End-of-song crowd recap (TV-only). Broadcast BEFORE the `playback.updated`
// that advances to the next singer, so the TV can defer its "You're up" card
// until after the recap has shown. `total` and `breakdown` are computed from
// the tally of the song that just finished.
export const ReactionRecapMessage = Schema.Struct({
  type: Schema.Literal("reaction.recap"),
  singerNickname: Schema.String,
  total: Schema.Number,
  breakdown: Schema.Array(
    Schema.Struct({ emoji: ReactionEmoji, count: Schema.Number })
  ),
});
export type ReactionRecapMessage = typeof ReactionRecapMessage.Type;

export const ServerMessage = Schema.Union(
  RoomStateMessage,
  QueueUpdatedMessage,
  PlaybackUpdatedMessage,
  RosterUpdatedMessage,
  RoomClosedMessage,
  ErrorMessage,
  ReactionBurstMessage,
  ReactionRecapMessage
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
