import { describe, it, expect, vi } from "vitest";
import {
  createPartySounds,
  playBlip,
  JOIN_SOUND,
  ADD_SOUND,
  POP_GAIN_PEAK,
  POP_ATTACK_MS,
  type AudioContextLike,
} from "../party-sounds";

// Minimal fake satisfying `AudioContextLike` — deliberately not a deep mock
// of the whole WebAudio API, just enough surface to assert the envelope and
// branching logic without a real AudioContext (unavailable in the `node`
// vitest environment anyway).
function createFakeContext(state: AudioContextLike["state"] = "running") {
  const oscillator = {
    type: "sine" as OscillatorType,
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gainParam = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  const gainNode = { gain: gainParam, connect: vi.fn() };
  const context: AudioContextLike = {
    createOscillator: vi.fn(() => oscillator) as unknown as AudioContextLike["createOscillator"],
    createGain: vi.fn(() => gainNode) as unknown as AudioContextLike["createGain"],
    currentTime: 1.5,
    destination: {} as AudioContextLike["destination"],
    state,
    resume: vi.fn(() => Promise.resolve()),
  };
  return { context, oscillator, gainNode, gainParam };
}

describe("sound envelope constants", () => {
  it("keeps both blips short (per design.md §7 — tiny, non-intrusive pops)", () => {
    expect(JOIN_SOUND.durationMs).toBeGreaterThanOrEqual(80);
    expect(JOIN_SOUND.durationMs).toBeLessThanOrEqual(150);
    expect(ADD_SOUND.durationMs).toBeGreaterThanOrEqual(80);
    expect(ADD_SOUND.durationMs).toBeLessThanOrEqual(150);
  });

  it("uses distinct, audible frequencies for join vs add", () => {
    expect(JOIN_SOUND.frequency).toBeGreaterThan(0);
    expect(ADD_SOUND.frequency).toBeGreaterThan(0);
    expect(JOIN_SOUND.frequency).not.toBe(ADD_SOUND.frequency);
  });

  it("keeps the peak gain quiet", () => {
    expect(POP_GAIN_PEAK).toBeGreaterThan(0);
    expect(POP_GAIN_PEAK).toBeLessThanOrEqual(0.2);
  });

  it("has a short attack relative to the blip duration", () => {
    expect(POP_ATTACK_MS).toBeGreaterThan(0);
    expect(POP_ATTACK_MS).toBeLessThan(JOIN_SOUND.durationMs);
    expect(POP_ATTACK_MS).toBeLessThan(ADD_SOUND.durationMs);
  });
});

describe("playBlip", () => {
  it("configures the oscillator with the spec's type and frequency", () => {
    const { context, oscillator } = createFakeContext();
    playBlip(context, JOIN_SOUND);
    expect(oscillator.type).toBe(JOIN_SOUND.type);
    expect(oscillator.frequency.value).toBe(JOIN_SOUND.frequency);
  });

  it("schedules a zero -> peak -> near-zero gain envelope", () => {
    const { context, gainParam } = createFakeContext();
    playBlip(context, ADD_SOUND);
    expect(gainParam.setValueAtTime).toHaveBeenCalledWith(0, context.currentTime);
    expect(gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(
      POP_GAIN_PEAK,
      context.currentTime + POP_ATTACK_MS / 1000
    );
    expect(gainParam.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.0001,
      context.currentTime + ADD_SOUND.durationMs / 1000
    );
  });

  it("connects oscillator -> gain -> destination and starts/stops it", () => {
    const { context, oscillator, gainNode } = createFakeContext();
    playBlip(context, JOIN_SOUND);
    expect(oscillator.connect).toHaveBeenCalledWith(gainNode);
    expect(gainNode.connect).toHaveBeenCalledWith(context.destination);
    expect(oscillator.start).toHaveBeenCalledWith(context.currentTime);
    expect(oscillator.stop).toHaveBeenCalled();
  });

  it("resumes a suspended context via a rejected-promise handler, not try/catch", () => {
    const { context } = createFakeContext("suspended");
    expect(() => playBlip(context, JOIN_SOUND)).not.toThrow();
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("does not resume a context that is already running", () => {
    const { context } = createFakeContext("running");
    playBlip(context, JOIN_SOUND);
    expect(context.resume).not.toHaveBeenCalled();
  });
});

describe("createPartySounds", () => {
  it("never creates an AudioContext while muted", () => {
    const createAudioContext = vi.fn();
    const sounds = createPartySounds(() => true, createAudioContext);
    sounds.playJoin();
    sounds.playAdd();
    expect(createAudioContext).not.toHaveBeenCalled();
  });

  it("creates the context lazily on the first unmuted play and reuses it", () => {
    const { context } = createFakeContext();
    const createAudioContext = vi.fn(() => context);
    const sounds = createPartySounds(() => false, createAudioContext);
    sounds.playJoin();
    sounds.playAdd();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
  });

  it("re-reads getMuted on every call, no stale caching", () => {
    let muted = true;
    const { context, oscillator } = createFakeContext();
    const createAudioContext = vi.fn(() => context);
    const sounds = createPartySounds(() => muted, createAudioContext);

    sounds.playJoin();
    expect(createAudioContext).not.toHaveBeenCalled();

    muted = false;
    sounds.playJoin();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
    expect(oscillator.start).toHaveBeenCalledTimes(1);
  });

  it("no-ops silently when the environment provides no AudioContext", () => {
    const sounds = createPartySounds(() => false, () => null);
    expect(() => sounds.playAdd()).not.toThrow();
  });
});
