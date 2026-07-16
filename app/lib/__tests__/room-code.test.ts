import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  normalizeRoomCodeInput,
  isCompleteRoomCode,
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

describe("normalizeRoomCodeInput", () => {
  it("uppercases lowercase input", () => {
    expect(normalizeRoomCodeInput("kq7")).toBe("KQ7");
  });

  it("strips characters outside the unambiguous alphabet, including 0/O/1/I/L", () => {
    expect(normalizeRoomCodeInput("k0O1IL q7")).toBe("KQ7");
  });

  it("inserts the group hyphen once a 4th character is typed", () => {
    expect(normalizeRoomCodeInput("KQ7")).toBe("KQ7");
    expect(normalizeRoomCodeInput("KQ73")).toBe("KQ7-3");
  });

  it("passes through an already-hyphenated code unchanged (hyphen is stripped and reinserted)", () => {
    expect(normalizeRoomCodeInput("KQ7-3FP")).toBe("KQ7-3FP");
  });

  it("caps at 6 alphabet characters, ignoring anything typed past that", () => {
    expect(normalizeRoomCodeInput("KQ73FPXYZ")).toBe("KQ7-3FP");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeRoomCodeInput("")).toBe("");
  });
});

describe("isCompleteRoomCode", () => {
  it("accepts a well-formed code", () => {
    expect(isCompleteRoomCode("KQ7-3FP")).toBe(true);
  });

  it("rejects an incomplete code", () => {
    expect(isCompleteRoomCode("KQ7-3")).toBe(false);
    expect(isCompleteRoomCode("KQ7")).toBe(false);
    expect(isCompleteRoomCode("")).toBe(false);
  });

  it("rejects a code missing the hyphen", () => {
    expect(isCompleteRoomCode("KQ73FP")).toBe(false);
  });

  it("rejects a code containing ambiguous characters", () => {
    expect(isCompleteRoomCode("KQ0-3FP")).toBe(false);
  });

  it("accepts every code `generateRoomCode` produces", () => {
    for (let i = 0; i < 20; i++) {
      expect(isCompleteRoomCode(generateRoomCode())).toBe(true);
    }
  });
});
