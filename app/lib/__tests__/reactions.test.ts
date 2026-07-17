import { describe, it, expect } from "vitest";
import {
  applyReactionTally,
  capParticles,
  clampReactionCount,
  EMPTY_TALLY,
  makeParticle,
  MAX_ACTIVE_PARTICLES,
  tallyBreakdown,
  tallyTotal,
  type ReactionParticle,
} from "../reactions";
import { MAX_REACTION_BATCH } from "@/lib/schemas/room-ws";

describe("clampReactionCount", () => {
  it("defaults to 1 for undefined", () => {
    expect(clampReactionCount()).toBe(1);
    expect(clampReactionCount(undefined)).toBe(1);
  });

  it("clamps a below-range count up to 1", () => {
    expect(clampReactionCount(0)).toBe(1);
    expect(clampReactionCount(-5)).toBe(1);
  });

  it("clamps an above-range count down to MAX_REACTION_BATCH", () => {
    expect(clampReactionCount(MAX_REACTION_BATCH + 1)).toBe(MAX_REACTION_BATCH);
    expect(clampReactionCount(999)).toBe(MAX_REACTION_BATCH);
  });

  it("floors a non-integer count", () => {
    expect(clampReactionCount(5.7)).toBe(5);
    expect(clampReactionCount(1.9)).toBe(1);
  });

  it("returns 1 for a non-finite count", () => {
    expect(clampReactionCount(Number.NaN)).toBe(1);
    expect(clampReactionCount(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("applyReactionTally / tallyTotal", () => {
  it("adds a clamped count to a fresh emoji", () => {
    const tally = applyReactionTally(EMPTY_TALLY, "🔥", 3);
    expect(tally["🔥"]).toBe(3);
  });

  it("accumulates onto an existing emoji", () => {
    const once = applyReactionTally(EMPTY_TALLY, "❤️", 2);
    const twice = applyReactionTally(once, "❤️", 4);
    expect(twice["❤️"]).toBe(6);
  });

  it("clamps the count as it applies", () => {
    const tally = applyReactionTally(EMPTY_TALLY, "🎉", 999);
    expect(tally["🎉"]).toBe(MAX_REACTION_BATCH);
  });

  it("defaults a missing count to 1", () => {
    const tally = applyReactionTally(EMPTY_TALLY, "👏");
    expect(tally["👏"]).toBe(1);
  });

  it("does not mutate the input tally", () => {
    const before = applyReactionTally(EMPTY_TALLY, "🔥", 1);
    applyReactionTally(before, "🔥", 1);
    expect(before["🔥"]).toBe(1);
  });

  it("tallyTotal sums every emoji", () => {
    const tally = applyReactionTally(
      applyReactionTally(EMPTY_TALLY, "🔥", 3),
      "❤️",
      2
    );
    expect(tallyTotal(tally)).toBe(5);
    expect(tallyTotal(EMPTY_TALLY)).toBe(0);
  });
});

describe("tallyBreakdown", () => {
  it("sorts by count descending and omits zero-count emoji", () => {
    // 😭 highest, then 🔥, then 👏 — ❤️/🤩/🎉 absent.
    const tally = { "👏": 1, "🔥": 4, "😭": 9 } as const;
    expect(tallyBreakdown(tally)).toEqual([
      { emoji: "😭", count: 9 },
      { emoji: "🔥", count: 4 },
      { emoji: "👏", count: 1 },
    ]);
  });

  it("breaks ties by palette order (👏 🔥 ❤️ 😭 🤩 🎉)", () => {
    const tally = { "🎉": 2, "👏": 2, "🔥": 2 } as const;
    expect(tallyBreakdown(tally).map((e) => e.emoji)).toEqual([
      "👏",
      "🔥",
      "🎉",
    ]);
  });

  it("returns an empty array for an empty tally", () => {
    expect(tallyBreakdown(EMPTY_TALLY)).toEqual([]);
  });
});

describe("makeParticle", () => {
  it("is deterministic under an injected rng", () => {
    // Stub rng returns 0.5 on every call → dead-center values.
    const half = makeParticle("🔥", () => 0.5, "p1");
    expect(half).toEqual({
      id: "p1",
      emoji: "🔥",
      leftPct: 50,
      driftPx: 0,
      durationMs: 3250,
      rotateDeg: 0,
    });
  });

  it("keeps every field within its documented range", () => {
    const low = makeParticle("❤️", () => 0, "lo");
    expect(low.leftPct).toBe(5);
    expect(low.driftPx).toBe(-60);
    expect(low.durationMs).toBe(2500);
    expect(low.rotateDeg).toBe(-20);

    // rng just under 1 → upper bounds (exclusive).
    const high = makeParticle("🎉", () => 0.999999, "hi");
    expect(high.leftPct).toBeGreaterThan(94);
    expect(high.leftPct).toBeLessThan(95);
    expect(high.driftPx).toBeLessThan(60);
    expect(high.driftPx).toBeGreaterThan(59);
    expect(high.durationMs).toBeLessThan(4000);
    expect(high.durationMs).toBeGreaterThan(3999);
    expect(high.rotateDeg).toBeLessThan(20);
    expect(high.rotateDeg).toBeGreaterThan(19);
  });
});

describe("capParticles", () => {
  const particle = (id: string): ReactionParticle => ({
    id,
    emoji: "🔥",
    leftPct: 50,
    driftPx: 0,
    durationMs: 3000,
    rotateDeg: 0,
  });

  it("appends incoming when under the cap", () => {
    const result = capParticles([particle("a")], [particle("b")], 40);
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("keeps only the newest `cap` particles, dropping the oldest", () => {
    const current = [particle("a"), particle("b"), particle("c")];
    const incoming = [particle("d"), particle("e")];
    const result = capParticles(current, incoming, 3);
    expect(result.map((p) => p.id)).toEqual(["c", "d", "e"]);
  });

  it("never exceeds MAX_ACTIVE_PARTICLES", () => {
    const current = Array.from({ length: 40 }, (_, i) => particle(`c${i}`));
    const incoming = Array.from({ length: 10 }, (_, i) => particle(`i${i}`));
    const result = capParticles(current, incoming, MAX_ACTIVE_PARTICLES);
    expect(result).toHaveLength(MAX_ACTIVE_PARTICLES);
    expect(result[result.length - 1].id).toBe("i9");
  });
});
