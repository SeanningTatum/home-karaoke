import { describe, it, expect } from "vitest";
import { cleanSongTitle, formatDuration, normalizeForMatch } from "../song-title";

describe("normalizeForMatch", () => {
  it("reduces a channel name to comparable letters", () => {
    expect(normalizeForMatch("Rick Astley")).toBe("rickastley");
    expect(normalizeForMatch("KaraFun Karaoke")).toBe("karafun");
    expect(normalizeForMatch("officialpsy")).toBe("psy");
    expect(normalizeForMatch("Atomic Karaoke... ")).toBe("atomic");
  });
});

describe("cleanSongTitle — real titles from the song table", () => {
  // Karaoke-channel convention: "Song - Artist", with pipe-delimited cruft.
  it("keeps the song primary when the left side is NOT the channel", () => {
    const result = cleanSongTitle(
      "Teenage Dirtbag - Wheatus | Karaoke Version | KaraFun",
      "KaraFun Karaoke"
    );
    expect(result.song).toBe("Teenage Dirtbag");
    expect(result.artist).toBe("Wheatus");
    expect(result.raw).toBe(
      "Teenage Dirtbag - Wheatus | Karaoke Version | KaraFun"
    );
  });

  // Official-channel convention: "Artist - Song" — the channel field is what
  // tells these two cases apart.
  it("flips to artist-first when the left side matches the channel", () => {
    expect(cleanSongTitle("Darude - Sandstorm", "Darude")).toMatchObject({
      song: "Sandstorm",
      artist: "Darude",
    });
  });

  it("matches a channel that decorates the artist name", () => {
    // "officialpsy" normalizes to "psy", which matches the left segment.
    const result = cleanSongTitle(
      "PSY - GANGNAM STYLE(강남스타일) M/V",
      "officialpsy"
    );
    expect(result.song).toBe("GANGNAM STYLE(강남스타일)");
    expect(result.artist).toBe("PSY");
  });

  it("strips noise brackets and collapses double spaces", () => {
    const result = cleanSongTitle(
      "DANCING QUEEN -  ABBA (HD Karaoke)",
      "Atomic Karaoke... "
    );
    expect(result.song).toBe("DANCING QUEEN");
    expect(result.artist).toBe("ABBA");
  });

  it("strips stacked quality/version brackets", () => {
    const result = cleanSongTitle(
      "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
      "Rick Astley"
    );
    expect(result.song).toBe("Never Gonna Give You Up");
    expect(result.artist).toBe("Rick Astley");
  });

  it("returns a bare title unchanged with no artist", () => {
    expect(cleanSongTitle("Bohemian Rhapsody", "Queen Official")).toEqual({
      song: "Bohemian Rhapsody",
      artist: null,
      raw: "Bohemian Rhapsody",
    });
  });

  it("keeps a medley's real content while dropping the noise word", () => {
    // Both pipe segments carry content, so neither is dropped — only the
    // bare word "Karaoke" goes.
    const result = cleanSongTitle(
      "Tom Jones MEDLEY Karaoke | You're My World, I Who Have Nothing, Delilah",
      "ConesStudio Karaoke"
    );
    expect(result.song).toBe(
      "Tom Jones MEDLEY | You're My World, I Who Have Nothing, Delilah"
    );
    expect(result.artist).toBeNull();
  });

  it("handles a parenthesised noise tag with no artist half", () => {
    const result = cleanSongTitle(
      "80s BEST FEMALE LOVE SONG MEDLEY (Karaoke)  All This Time, Eternal Flame",
      "Amaze Sing Karaoke Channel"
    );
    expect(result.song).toBe(
      "80s BEST FEMALE LOVE SONG MEDLEY All This Time, Eternal Flame"
    );
    expect(result.artist).toBeNull();
  });
});

describe("cleanSongTitle — edge cases", () => {
  it("never splits a hyphenated word", () => {
    expect(cleanSongTitle("Spider-Man Theme", "Some Channel")).toMatchObject({
      song: "Spider-Man Theme",
      artist: null,
    });
  });

  it("splits on an en dash and an em dash too", () => {
    expect(cleanSongTitle("Adele – Hello", "Adele")).toMatchObject({
      song: "Hello",
      artist: "Adele",
    });
    expect(cleanSongTitle("Toto — Africa", "Legacy Recordings")).toMatchObject({
      song: "Toto",
      artist: "Africa",
    });
  });

  it("treats a stray leading dash as punctuation, not a credit", () => {
    expect(cleanSongTitle("- Sandstorm", "Darude")).toMatchObject({
      song: "Sandstorm",
      artist: null,
    });
  });

  it("falls back to the raw title when cleaning would empty it", () => {
    expect(cleanSongTitle("(Official Video) [HD]", "Whatever")).toEqual({
      song: "(Official Video) [HD]",
      artist: null,
      raw: "(Official Video) [HD]",
    });
  });

  it("works with no channel supplied — karaoke convention wins", () => {
    expect(cleanSongTitle("Teenage Dirtbag - Wheatus")).toMatchObject({
      song: "Teenage Dirtbag",
      artist: "Wheatus",
    });
  });

  it("keeps meaningful bracket contents", () => {
    const result = cleanSongTitle("Fix You (Live at Glastonbury)", "Coldplay");
    expect(result.song).toBe("Fix You (Live at Glastonbury)");
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds with a padded seconds field", () => {
    expect(formatDuration(137)).toBe("2:17");
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(60)).toBe("1:00");
  });

  it("includes hours only when needed", () => {
    expect(formatDuration(3849)).toBe("1:04:09");
  });

  it("clamps negatives and non-finite input to zero", () => {
    expect(formatDuration(-5)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
