import { describe, it, expect } from "vitest";
import { buildJoinUrl } from "../room-urls";

describe("buildJoinUrl", () => {
  it("builds an absolute join URL from an origin and a room code", () => {
    expect(buildJoinUrl("https://example.com", "KQ7-3FP")).toBe(
      "https://example.com/join/KQ7-3FP"
    );
  });

  it("strips a trailing slash from the origin before joining", () => {
    expect(buildJoinUrl("https://example.com/", "KQ7-3FP")).toBe(
      "https://example.com/join/KQ7-3FP"
    );
  });

  it("URL-encodes special characters in the code", () => {
    expect(buildJoinUrl("https://example.com", "AB C/D")).toBe(
      "https://example.com/join/AB%20C%2FD"
    );
  });

  it("preserves a non-default port on the origin", () => {
    expect(buildJoinUrl("http://localhost:5173", "KQ7-3FP")).toBe(
      "http://localhost:5173/join/KQ7-3FP"
    );
  });
});
