import { describe, it, expect } from "vitest";
import {
  beginReactionRecapExit,
  exitedReactionRecapDisplayState,
  initialReactionRecapDisplayState,
  nextReactionRecapDisplayState,
  type ReactionRecapDisplayState,
  type ReactionRecapPayload,
} from "../reaction-recap-state";

const aliceRecap: ReactionRecapPayload = {
  singerNickname: "Alice",
  total: 12,
  breakdown: [
    { emoji: "👏", count: 8 },
    { emoji: "🔥", count: 4 },
  ],
};
const bobRecap: ReactionRecapPayload = {
  singerNickname: "Bob",
  total: 3,
  breakdown: [{ emoji: "❤️", count: 3 }],
};

const idle: ReactionRecapDisplayState = {
  displayedRecap: null,
  isExiting: false,
};
const showing = (
  recap: ReactionRecapDisplayState["displayedRecap"]
): ReactionRecapDisplayState => ({ displayedRecap: recap, isExiting: false });
const exiting = (
  recap: ReactionRecapDisplayState["displayedRecap"]
): ReactionRecapDisplayState => ({ displayedRecap: recap, isExiting: true });

describe("initialReactionRecapDisplayState", () => {
  it("seeds displayedRecap from the initial recap prop, not exiting", () => {
    expect(initialReactionRecapDisplayState(aliceRecap)).toEqual(
      showing(aliceRecap)
    );
    expect(initialReactionRecapDisplayState(null)).toEqual(idle);
  });
});

describe("nextReactionRecapDisplayState", () => {
  it("shows a new recap immediately from idle and asks to start the visible timer", () => {
    const { next, startVisibleTimer } = nextReactionRecapDisplayState(
      idle,
      aliceRecap
    );
    expect(next).toEqual(showing(aliceRecap));
    expect(startVisibleTimer).toBe(true);
  });

  it("replaces the displayed recap instantly when a new one arrives mid-visible", () => {
    const { next, startVisibleTimer } = nextReactionRecapDisplayState(
      showing(aliceRecap),
      bobRecap
    );
    expect(next).toEqual(showing(bobRecap));
    expect(startVisibleTimer).toBe(true);
  });

  it("cancels an in-progress exit and shows the new recap when one arrives mid-exit", () => {
    const { next, startVisibleTimer } = nextReactionRecapDisplayState(
      exiting(aliceRecap),
      bobRecap
    );
    expect(next).toEqual(showing(bobRecap));
    expect(startVisibleTimer).toBe(true);
  });

  it("hard-resets with no exit animation when the parent clears recap out of band", () => {
    const { next, startVisibleTimer } = nextReactionRecapDisplayState(
      showing(aliceRecap),
      null
    );
    expect(next).toEqual(exitedReactionRecapDisplayState);
    expect(startVisibleTimer).toBe(false);
  });

  it("is a no-op when recap is null and nothing is displayed", () => {
    const { next, startVisibleTimer } = nextReactionRecapDisplayState(
      idle,
      null
    );
    expect(next).toBe(idle);
    expect(startVisibleTimer).toBe(false);
  });
});

describe("beginReactionRecapExit", () => {
  it("moves a displayed, not-yet-exiting recap into its exit animation", () => {
    expect(beginReactionRecapExit(showing(aliceRecap))).toEqual(
      exiting(aliceRecap)
    );
  });

  it("is a no-op when nothing is displayed", () => {
    expect(beginReactionRecapExit(idle)).toBe(idle);
  });

  it("is a no-op when already exiting (defensive against a duplicate timer fire)", () => {
    const already = exiting(aliceRecap);
    expect(beginReactionRecapExit(already)).toBe(already);
  });
});

describe("exitedReactionRecapDisplayState", () => {
  it("clears the displayed recap and the exiting flag", () => {
    expect(exitedReactionRecapDisplayState).toEqual(idle);
  });
});
