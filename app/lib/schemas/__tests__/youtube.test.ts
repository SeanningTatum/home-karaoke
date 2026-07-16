import { describe, it, expect } from "vitest";
import { Schema } from "effect";
import { YouTubeSearchInput, YouTubeResolveVideoInput } from "../youtube";

const decode = <A, I>(s: Schema.Schema<A, I>) => Schema.decodeUnknownEither(s);

describe("YouTubeSearchInput", () => {
  it("accepts a valid query + roomId", () => {
    expect(
      decode(YouTubeSearchInput)({ query: "never gonna give you up", roomId: "r1" })
        ._tag
    ).toBe("Right");
  });

  it("rejects an empty query", () => {
    expect(decode(YouTubeSearchInput)({ query: "", roomId: "r1" })._tag).toBe(
      "Left"
    );
  });

  it("rejects a query over 200 chars", () => {
    expect(
      decode(YouTubeSearchInput)({ query: "a".repeat(201), roomId: "r1" })
        ._tag
    ).toBe("Left");
  });

  it("rejects a missing roomId", () => {
    expect(decode(YouTubeSearchInput)({ query: "song" })._tag).toBe("Left");
  });
});

describe("YouTubeResolveVideoInput", () => {
  it("accepts videoId alone", () => {
    expect(
      decode(YouTubeResolveVideoInput)({ videoId: "v1", roomId: "r1" })._tag
    ).toBe("Right");
  });

  it("accepts url alone", () => {
    expect(
      decode(YouTubeResolveVideoInput)({
        url: "https://youtu.be/dQw4w9WgXcQ",
        roomId: "r1",
      })._tag
    ).toBe("Right");
  });

  it("accepts an optional searchLogId", () => {
    expect(
      decode(YouTubeResolveVideoInput)({
        videoId: "v1",
        searchLogId: "sl1",
        roomId: "r1",
      })._tag
    ).toBe("Right");
  });

  it("rejects when neither videoId nor url is provided", () => {
    expect(decode(YouTubeResolveVideoInput)({ roomId: "r1" })._tag).toBe(
      "Left"
    );
  });

  it("rejects a missing roomId", () => {
    expect(decode(YouTubeResolveVideoInput)({ videoId: "v1" })._tag).toBe(
      "Left"
    );
  });
});
