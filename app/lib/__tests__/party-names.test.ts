import { describe, it, expect } from "vitest";
import {
  randomPartyName,
  PARTY_NAME_ADJECTIVES,
  PARTY_NAME_NOUNS,
} from "../party-names";

describe("randomPartyName", () => {
  it("returns 'Adjective Noun' picked from the curated lists using an injected random", () => {
    // random() always returns 0 -> first adjective, first noun.
    expect(randomPartyName(() => 0)).toBe(
      `${PARTY_NAME_ADJECTIVES[0]} ${PARTY_NAME_NOUNS[0]}`
    );
  });

  it("picks the last entries when random() approaches 1", () => {
    const lastAdjective = PARTY_NAME_ADJECTIVES[PARTY_NAME_ADJECTIVES.length - 1];
    const lastNoun = PARTY_NAME_NOUNS[PARTY_NAME_NOUNS.length - 1];
    expect(randomPartyName(() => 0.9999)).toBe(`${lastAdjective} ${lastNoun}`);
  });

  it("is deterministic for a fixed random source", () => {
    const fixed = () => 0.5;
    expect(randomPartyName(fixed)).toBe(randomPartyName(fixed));
  });

  it("defaults to Math.random when no source is given", () => {
    const name = randomPartyName();
    const [adjective, noun] = name.split(" ");
    expect(PARTY_NAME_ADJECTIVES).toContain(adjective);
    expect(PARTY_NAME_NOUNS).toContain(noun);
  });

  it("has at least 24 combos available (24 adjectives x 24 nouns)", () => {
    expect(PARTY_NAME_ADJECTIVES.length).toBeGreaterThanOrEqual(24);
    expect(PARTY_NAME_NOUNS.length).toBeGreaterThanOrEqual(24);
  });
});
