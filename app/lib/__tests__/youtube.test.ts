import { describe, it, expect } from "vitest";
import {
  normalizeSearchQuery,
  withKaraokeBias,
  parseYouTubeUrl,
  parseIsoDuration,
} from "../youtube";

describe("normalizeSearchQuery", () => {
  it("lowercases", () => {
    expect(normalizeSearchQuery("Never Gonna Give")).toBe(
      "never gonna give"
    );
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeSearchQuery("  never gonna give  ")).toBe(
      "never gonna give"
    );
  });

  it("collapses internal whitespace", () => {
    expect(normalizeSearchQuery("never   gonna\tgive")).toBe(
      "never gonna give"
    );
  });
});

describe("withKaraokeBias", () => {
  it("appends karaoke when absent", () => {
    expect(withKaraokeBias("never gonna give you up")).toBe(
      "never gonna give you up karaoke"
    );
  });

  it("does not duplicate karaoke when already present (case-insensitive)", () => {
    expect(withKaraokeBias("never gonna give you up Karaoke Version")).toBe(
      "never gonna give you up Karaoke Version"
    );
  });
});

describe("parseYouTubeUrl", () => {
  it("extracts the id from a watch URL", () => {
    expect(
      parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts the id from a watch URL with extra query params", () => {
    expect(
      parseYouTubeUrl(
        "https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=30s"
      )
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts the id from a youtu.be short link", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts the id from a shorts URL", () => {
    expect(
      parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts the id from an embed URL", () => {
    expect(
      parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  it("handles an m. subdomain", () => {
    expect(
      parseYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  it("rejects a non-YouTube domain", () => {
    expect(
      parseYouTubeUrl("https://vimeo.com/watch?v=dQw4w9WgXcQ")
    ).toBeNull();
  });

  it("rejects a malformed URL", () => {
    expect(parseYouTubeUrl("not a url")).toBeNull();
  });

  it("rejects a watch URL missing v=", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch")).toBeNull();
  });

  it("rejects an invalid video id length", () => {
    expect(
      parseYouTubeUrl("https://www.youtube.com/watch?v=short")
    ).toBeNull();
  });
});

describe("parseIsoDuration", () => {
  it("parses minutes and seconds", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(4 * 60 + 13);
  });

  it("parses hours, minutes, and seconds", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3600 + 120 + 3);
  });

  it("parses seconds only", () => {
    expect(parseIsoDuration("PT45S")).toBe(45);
  });

  it("parses hours only", () => {
    expect(parseIsoDuration("PT2H")).toBe(7200);
  });

  it("returns null for a non-duration string", () => {
    expect(parseIsoDuration("not a duration")).toBeNull();
  });

  it("returns null for a bare P with no components", () => {
    expect(parseIsoDuration("P")).toBeNull();
  });
});
