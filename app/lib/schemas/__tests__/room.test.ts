import { describe, it, expect } from "vitest";
import { Schema } from "effect";
import {
  RoomCode,
  CreateRoomInput,
  GetRoomByCodeInput,
  CloseRoomInput,
  UpdateGuestReorderInput,
  RecordPlayedInput,
  Nickname,
  JoinNicknameInput,
} from "../room";

const decode = <A, I>(s: Schema.Schema<A, I>) => Schema.decodeUnknownEither(s);

describe("RoomCode", () => {
  it("accepts a well-formed code", () => {
    expect(decode(RoomCode)("KQ7-3FP")._tag).toBe("Right");
  });

  it("rejects a code with an ambiguous character (0/O/1/I/L)", () => {
    expect(decode(RoomCode)("KQ0-3FP")._tag).toBe("Left");
    expect(decode(RoomCode)("KQO-3FP")._tag).toBe("Left");
    expect(decode(RoomCode)("KQ1-3FP")._tag).toBe("Left");
    expect(decode(RoomCode)("KQI-3FP")._tag).toBe("Left");
    expect(decode(RoomCode)("KQL-3FP")._tag).toBe("Left");
  });

  it("rejects missing hyphen", () => {
    expect(decode(RoomCode)("KQ73FP")._tag).toBe("Left");
  });

  it("rejects wrong length", () => {
    expect(decode(RoomCode)("KQ-3FP")._tag).toBe("Left");
    expect(decode(RoomCode)("KQ77-3FP")._tag).toBe("Left");
  });

  it("rejects lowercase", () => {
    expect(decode(RoomCode)("kq7-3fp")._tag).toBe("Left");
  });
});

describe("CreateRoomInput", () => {
  it("accepts empty input (allowGuestReorder optional)", () => {
    expect(decode(CreateRoomInput)({})._tag).toBe("Right");
  });

  it("accepts allowGuestReorder: true", () => {
    expect(decode(CreateRoomInput)({ allowGuestReorder: true })._tag).toBe(
      "Right"
    );
  });

  it("rejects a non-boolean allowGuestReorder", () => {
    expect(decode(CreateRoomInput)({ allowGuestReorder: "yes" })._tag).toBe(
      "Left"
    );
  });
});

describe("GetRoomByCodeInput", () => {
  it("accepts a valid code", () => {
    expect(decode(GetRoomByCodeInput)({ code: "KQ7-3FP" })._tag).toBe(
      "Right"
    );
  });

  it("rejects a malformed code", () => {
    expect(decode(GetRoomByCodeInput)({ code: "not-a-code" })._tag).toBe(
      "Left"
    );
  });
});

describe("CloseRoomInput", () => {
  it("accepts a roomId string", () => {
    expect(decode(CloseRoomInput)({ roomId: "room_1" })._tag).toBe("Right");
  });

  it("rejects a missing roomId", () => {
    expect(decode(CloseRoomInput)({})._tag).toBe("Left");
  });
});

describe("UpdateGuestReorderInput", () => {
  it("accepts a roomId + allowGuestReorder", () => {
    expect(
      decode(UpdateGuestReorderInput)({ roomId: "r1", allowGuestReorder: true })
        ._tag
    ).toBe("Right");
  });

  it("rejects a missing allowGuestReorder", () => {
    expect(decode(UpdateGuestReorderInput)({ roomId: "r1" })._tag).toBe(
      "Left"
    );
  });

  it("rejects a non-boolean allowGuestReorder", () => {
    expect(
      decode(UpdateGuestReorderInput)({ roomId: "r1", allowGuestReorder: "yes" })
        ._tag
    ).toBe("Left");
  });
});

describe("RecordPlayedInput", () => {
  it("accepts the required fields without addedByUserId", () => {
    expect(
      decode(RecordPlayedInput)({
        roomId: "r1",
        videoId: "v1",
        singerNickname: "Alice",
      })._tag
    ).toBe("Right");
  });

  it("accepts an optional addedByUserId", () => {
    expect(
      decode(RecordPlayedInput)({
        roomId: "r1",
        videoId: "v1",
        singerNickname: "Alice",
        addedByUserId: "u1",
      })._tag
    ).toBe("Right");
  });

  it("rejects a missing videoId", () => {
    expect(
      decode(RecordPlayedInput)({ roomId: "r1", singerNickname: "Alice" })
        ._tag
    ).toBe("Left");
  });
});

describe("Nickname", () => {
  it("accepts a normal nickname", () => {
    expect(decode(Nickname)("Alice")._tag).toBe("Right");
  });

  it("accepts exactly 24 chars", () => {
    expect(decode(Nickname)("a".repeat(24))._tag).toBe("Right");
  });

  it("rejects empty string", () => {
    expect(decode(Nickname)("")._tag).toBe("Left");
  });

  it("rejects more than 24 chars", () => {
    expect(decode(Nickname)("a".repeat(25))._tag).toBe("Left");
  });

  it("rejects leading/trailing whitespace (not pre-trimmed)", () => {
    expect(decode(Nickname)(" Alice")._tag).toBe("Left");
    expect(decode(Nickname)("Alice ")._tag).toBe("Left");
  });

  it("rejects strings containing control characters", () => {
    expect(decode(Nickname)("Ali\x00ce")._tag).toBe("Left");
    expect(decode(Nickname)("Alice\x7f")._tag).toBe("Left");
  });
});

describe("JoinNicknameInput", () => {
  it("accepts a valid nickname wrapped in the form struct", () => {
    expect(decode(JoinNicknameInput)({ nickname: "Alice" })._tag).toBe(
      "Right"
    );
  });

  it("rejects an empty nickname", () => {
    expect(decode(JoinNicknameInput)({ nickname: "" })._tag).toBe("Left");
  });

  it("rejects a missing nickname field", () => {
    expect(decode(JoinNicknameInput)({})._tag).toBe("Left");
  });
});
