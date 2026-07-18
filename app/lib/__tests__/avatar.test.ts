import { describe, it, expect } from "vitest";
import {
  MAX_AVATAR_BYTES,
  MAX_RAW_AVATAR_BYTES,
  ALLOWED_AVATAR_TYPES,
  isAllowedAvatarType,
  isWithinAvatarSize,
  isWithinRawAvatarSize,
  avatarKey,
  avatarImageUrl,
} from "../avatar";

describe("isAllowedAvatarType", () => {
  it.each([...ALLOWED_AVATAR_TYPES])("allows %s", (type) => {
    expect(isAllowedAvatarType(type)).toBe(true);
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", "text/plain", ""])(
    "denies %s",
    (type) => {
      expect(isAllowedAvatarType(type)).toBe(false);
    }
  );
});

describe("isWithinAvatarSize", () => {
  it("allows a file exactly at the cap", () => {
    expect(isWithinAvatarSize(MAX_AVATAR_BYTES)).toBe(true);
  });

  it("rejects a file one byte over the cap", () => {
    expect(isWithinAvatarSize(MAX_AVATAR_BYTES + 1)).toBe(false);
  });

  it("allows a small file", () => {
    expect(isWithinAvatarSize(1)).toBe(true);
  });
});

describe("isWithinRawAvatarSize", () => {
  it("allows a file exactly at the raw cap", () => {
    expect(isWithinRawAvatarSize(MAX_RAW_AVATAR_BYTES)).toBe(true);
  });

  it("rejects a file one byte over the raw cap", () => {
    expect(isWithinRawAvatarSize(MAX_RAW_AVATAR_BYTES + 1)).toBe(false);
  });

  it("allows a typical phone photo well above the upload cap", () => {
    expect(isWithinRawAvatarSize(8 * 1024 * 1024)).toBe(true);
  });
});

describe("avatarKey", () => {
  it("builds the R2 object key from the userId", () => {
    expect(avatarKey("user-123")).toBe("avatars/user-123");
  });
});

describe("avatarImageUrl", () => {
  it("builds the versioned public URL", () => {
    expect(avatarImageUrl("user-123", 5)).toBe("/api/avatar/user-123?v=5");
  });
});
