import { describe, it, expect } from "vitest";
import {
  exitedNowUpDisplayState,
  initialNowUpDisplayState,
  nextNowUpDisplayState,
  type NowUpDisplayState,
} from "../now-up-overlay-state";

const alice = { nickname: "Alice", avatarUrl: null };
const bob = { nickname: "Bob", avatarUrl: null };

const idle: NowUpDisplayState = { displayedSinger: null, isExiting: false };
const showing = (singer: NowUpDisplayState["displayedSinger"]): NowUpDisplayState => ({
  displayedSinger: singer,
  isExiting: false,
});
const exiting = (singer: NowUpDisplayState["displayedSinger"]): NowUpDisplayState => ({
  displayedSinger: singer,
  isExiting: true,
});

describe("initialNowUpDisplayState", () => {
  it("seeds displayedSinger from the initial singer prop, not exiting", () => {
    expect(initialNowUpDisplayState(alice)).toEqual(showing(alice));
    expect(initialNowUpDisplayState(null)).toEqual(idle);
  });
});

describe("nextNowUpDisplayState", () => {
  it("shows a new singer immediately from idle", () => {
    const { next, startExit } = nextNowUpDisplayState(idle, alice);
    expect(next).toEqual(showing(alice));
    expect(startExit).toBe(false);
  });

  it("replaces the displayed singer instantly on a direct singer -> different singer edge", () => {
    const { next, startExit } = nextNowUpDisplayState(showing(alice), bob);
    expect(next).toEqual(showing(bob));
    expect(startExit).toBe(false);
  });

  it("cancels an in-progress exit and shows the new singer when one arrives mid-exit", () => {
    const { next, startExit } = nextNowUpDisplayState(exiting(alice), bob);
    expect(next).toEqual(showing(bob));
    expect(startExit).toBe(false);
  });

  it("starts the exit animation when singer goes null while something is displayed", () => {
    const { next, startExit } = nextNowUpDisplayState(showing(alice), null);
    expect(next).toEqual(exiting(alice));
    expect(startExit).toBe(true);
  });

  it("is a no-op when singer is null and nothing is displayed", () => {
    const { next, startExit } = nextNowUpDisplayState(idle, null);
    expect(next).toBe(idle);
    expect(startExit).toBe(false);
  });

  it("re-requests an exit-timer restart if singer stays null while already exiting", () => {
    // Mirrors the effect re-running (e.g. a parent re-render) while the
    // exit animation is still in flight — the transition should keep
    // asking the caller to (re)start its fallback timer rather than
    // silently dropping the exit.
    const { next, startExit } = nextNowUpDisplayState(exiting(alice), null);
    expect(next).toEqual(exiting(alice));
    expect(startExit).toBe(true);
  });
});

describe("exitedNowUpDisplayState", () => {
  it("clears the displayed singer and the exiting flag", () => {
    expect(exitedNowUpDisplayState).toEqual(idle);
  });
});
