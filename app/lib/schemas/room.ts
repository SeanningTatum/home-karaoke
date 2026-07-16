import { Schema } from "effect";
import { ROOM_CODE_ALPHABET } from "@/lib/room-code";

// Mirrors the exact format produced by `generateRoomCode` in
// app/lib/room-code.ts: 6 chars from the unambiguous alphabet, hyphen
// after the 3rd -- e.g. "KQ7-3FP".
const ROOM_CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{3}-[${ROOM_CODE_ALPHABET}]{3}$`
);

export const RoomCode = Schema.String.pipe(
  Schema.pattern(ROOM_CODE_PATTERN, {
    identifier: "RoomCode",
    message: () => "Room code must look like KQ7-3FP",
  })
);
export type RoomCode = typeof RoomCode.Type;

export const CreateRoomInput = Schema.Struct({
  allowGuestReorder: Schema.optional(Schema.Boolean),
});
export type CreateRoomInput = typeof CreateRoomInput.Type;

export const GetRoomByCodeInput = Schema.Struct({
  code: RoomCode,
});
export type GetRoomByCodeInput = typeof GetRoomByCodeInput.Type;

export const CloseRoomInput = Schema.Struct({
  roomId: Schema.String,
});
export type CloseRoomInput = typeof CloseRoomInput.Type;

export const UpdateGuestReorderInput = Schema.Struct({
  roomId: Schema.String,
  allowGuestReorder: Schema.Boolean,
});
export type UpdateGuestReorderInput = typeof UpdateGuestReorderInput.Type;

// Persists a played (or skipped) song to `room_song` history — see
// `SongRepository.recordRoomSong` + `markPlayed`. Called by the host client
// right before it sends `playback.videoEnded` / `playback.skip` over the
// room WebSocket, using the `currentItem` it already has in local state.
export const RecordPlayedInput = Schema.Struct({
  roomId: Schema.String,
  videoId: Schema.String,
  singerNickname: Schema.String,
  addedByUserId: Schema.optional(Schema.String),
  // The currently-playing queue item's id, reused as the room_song row id
  // so two dual-screen record calls for the same performance collide on the
  // primary key and the second no-ops (idempotent history). Optional: when
  // absent a fresh id is generated (single-recorder path).
  queueItemId: Schema.optional(Schema.String),
});
export type RecordPlayedInput = typeof RecordPlayedInput.Type;

// Control characters (C0 controls 0x00-0x1F plus DEL 0x7F) disallowed --
// covers stray pastes of non-printable bytes into a nickname field.
const CONTROL_CHAR_CODES = new Set<number>();
for (let code = 0x00; code <= 0x1f; code++) CONTROL_CHAR_CODES.add(code);
CONTROL_CHAR_CODES.add(0x7f);

const hasNoControlChars = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    if (CONTROL_CHAR_CODES.has(value.charCodeAt(i))) return false;
  }
  return true;
};

export const Nickname = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(24),
  Schema.trimmed(),
  Schema.filter(hasNoControlChars, {
    identifier: "Nickname",
    message: () => "Nickname must not contain control characters",
  })
);
export type Nickname = typeof Nickname.Type;

// Form wrapper for the /join/:code nickname step (RHF + effectResolver
// needs a Struct, not a bare String schema).
export const JoinNicknameInput = Schema.Struct({
  nickname: Nickname,
});
export type JoinNicknameInput = typeof JoinNicknameInput.Type;
