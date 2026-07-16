import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  ROOM_CODE_ALPHABET,
  type RandomSource,
} from "../room-code";

const CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{3}-[${ROOM_CODE_ALPHABET}]{3}$`
);

describe("generateRoomCode", () => {
  it("produces a code matching the XXX-XXX unambiguous-alphabet format", () => {
    const code = generateRoomCode();
    expect(code).toMatch(CODE_PATTERN);
  });

  it("never includes ambiguous characters (0, O, 1, I, L)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it("is deterministic given an injected random source", () => {
    const fixedSource: RandomSource = (byteCount) =>
      new Uint8Array(byteCount).fill(0);
    const code = generateRoomCode(fixedSource);
    // byte 0 % 31 === 0 → first alphabet char, repeated six times
    const expectedChar = ROOM_CODE_ALPHABET[0];
    expect(code).toBe(
      `${expectedChar}${expectedChar}${expectedChar}-${expectedChar}${expectedChar}${expectedChar}`
    );
  });

  it("varies output as the injected random source varies", () => {
    let call = 0;
    const sequences = [
      Uint8Array.from([0, 1, 2, 3, 4, 5]),
      Uint8Array.from([5, 4, 3, 2, 1, 0]),
    ];
    const source: RandomSource = () => sequences[call++];
    const first = generateRoomCode(source);
    const second = generateRoomCode(source);
    expect(first).not.toBe(second);
  });

  it("uses the Workers-safe default source (crypto.getRandomValues) without throwing", () => {
    expect(() => generateRoomCode()).not.toThrow();
  });
});
