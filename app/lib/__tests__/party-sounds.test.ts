import { describe, it, expect, vi } from "vitest";
import {
  createPartySounds,
  playBlip,
  playJingle,
  JOIN_SOUND,
  ADD_SOUND,
  FANFARE_SOUND,
  POP_GAIN_PEAK,
  POP_ATTACK_MS,
  MAX_GAIN_PEAK,
  FANFARE_ACCENT_GAIN_PEAK,
  type AudioContextLike,
  type JingleSpec,
} from "../party-sounds";

// Minimal fake satisfying `AudioContextLike` — deliberately not a deep mock
// of the whole WebAudio API, just enough surface to assert the envelope and
// branching logic without a real AudioContext (unavailable in the `node`
// vitest environment anyway). Every `createOscillator`/`createGain` call
// returns a FRESH object (tracked in `oscillators`/`gains`, in creation
// order) rather than one shared instance, because a jingle schedules one
// oscillator/gain pair per note.
function createFakeContext(state: AudioContextLike["state"] = "running") {
  const oscillators: Array<{
    type: OscillatorType;
    frequency: { value: number };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  const gains: Array<{
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  }> = [];

  const context: AudioContextLike = {
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: "sine" as OscillatorType,
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }) as unknown as AudioContextLike["createOscillator"],
    createGain: vi.fn(() => {
      const gainParam = {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      };
      const gainNode = { gain: gainParam, connect: vi.fn() };
      gains.push(gainNode);
      return gainNode;
    }) as unknown as AudioContextLike["createGain"],
    currentTime: 1.5,
    destination: {} as AudioContextLike["destination"],
    state,
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  return { context, oscillators, gains };
}

/** Total span of a jingle, in ms — the last note's `startMs + durationMs`. */
function jingleSpanMs(jingle: JingleSpec): number {
  return Math.max(...jingle.map((note) => note.startMs + note.durationMs));
}

describe("sound envelope constants", () => {
  it("keeps the default peak gain loud enough to notice but under the ceiling", () => {
    expect(POP_GAIN_PEAK).toBeGreaterThanOrEqual(0.2);
    expect(POP_GAIN_PEAK).toBeLessThanOrEqual(0.25);
    expect(POP_GAIN_PEAK).toBeLessThanOrEqual(MAX_GAIN_PEAK);
  });

  it("keeps every gain ceiling well under clipping (1.0)", () => {
    expect(MAX_GAIN_PEAK).toBeLessThan(1);
    expect(FANFARE_ACCENT_GAIN_PEAK).toBeLessThanOrEqual(MAX_GAIN_PEAK);
  });

  it("has a short attack relative to every jingle's shortest note", () => {
    const allNotes = [...JOIN_SOUND, ...ADD_SOUND, ...FANFARE_SOUND];
    expect(POP_ATTACK_MS).toBeGreaterThan(0);
    for (const note of allNotes) {
      expect(POP_ATTACK_MS).toBeLessThan(note.durationMs);
    }
  });

  it("never lets a note's gainPeak override exceed MAX_GAIN_PEAK", () => {
    const allNotes = [...JOIN_SOUND, ...ADD_SOUND, ...FANFARE_SOUND];
    for (const note of allNotes) {
      expect(note.gainPeak ?? POP_GAIN_PEAK).toBeLessThanOrEqual(MAX_GAIN_PEAK);
    }
  });
});

describe("JOIN_SOUND / ADD_SOUND jingle shapes", () => {
  it("JOIN_SOUND is a 3-note ascending arpeggio, ~250-350ms total", () => {
    expect(JOIN_SOUND).toHaveLength(3);
    const frequencies = JOIN_SOUND.map((note) => note.frequency);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => a - b));
    expect(new Set(frequencies).size).toBe(3);
    expect(jingleSpanMs(JOIN_SOUND)).toBeGreaterThanOrEqual(250);
    expect(jingleSpanMs(JOIN_SOUND)).toBeLessThanOrEqual(350);
  });

  it("ADD_SOUND is a 2-3 note rising jingle, distinct from JOIN_SOUND", () => {
    expect(ADD_SOUND.length).toBeGreaterThanOrEqual(2);
    expect(ADD_SOUND.length).toBeLessThanOrEqual(3);
    const frequencies = ADD_SOUND.map((note) => note.frequency);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => a - b));

    // Distinct from JOIN_SOUND — different timbre and different notes, so
    // the ear can tell them apart even before registering the rhythm.
    expect(ADD_SOUND[0].type).not.toBe(JOIN_SOUND[0].type);
    expect(ADD_SOUND.map((n) => n.frequency)).not.toEqual(JOIN_SOUND.map((n) => n.frequency));
  });
});

describe("FANFARE_SOUND jingle shape", () => {
  it("is a 4-6 note flourish spanning ~0.8-1.2s", () => {
    expect(FANFARE_SOUND.length).toBeGreaterThanOrEqual(4);
    expect(FANFARE_SOUND.length).toBeLessThanOrEqual(6);
    const spanMs = jingleSpanMs(FANFARE_SOUND);
    expect(spanMs).toBeGreaterThanOrEqual(800);
    expect(spanMs).toBeLessThanOrEqual(1200);
  });

  it("ends in a held finale chord — at least two notes sharing a startMs", () => {
    const startMsCounts = new Map<number, number>();
    for (const note of FANFARE_SOUND) {
      startMsCounts.set(note.startMs, (startMsCounts.get(note.startMs) ?? 0) + 1);
    }
    const chordSizes = [...startMsCounts.values()];
    expect(Math.max(...chordSizes)).toBeGreaterThanOrEqual(2);
  });

  it("finale chord notes use the louder FANFARE_ACCENT_GAIN_PEAK", () => {
    const finaleNotes = FANFARE_SOUND.filter((note) => note.gainPeak !== undefined);
    expect(finaleNotes.length).toBeGreaterThanOrEqual(2);
    for (const note of finaleNotes) {
      expect(note.gainPeak).toBe(FANFARE_ACCENT_GAIN_PEAK);
    }
    expect(FANFARE_ACCENT_GAIN_PEAK).toBeGreaterThan(POP_GAIN_PEAK);
  });
});

describe("playBlip", () => {
  it("configures the oscillator with the note's type and frequency", () => {
    const { context, oscillators } = createFakeContext();
    playBlip(context, JOIN_SOUND[0]);
    expect(oscillators[0].type).toBe(JOIN_SOUND[0].type);
    expect(oscillators[0].frequency.value).toBe(JOIN_SOUND[0].frequency);
  });

  it("schedules a zero -> peak -> near-zero gain envelope offset by startMs", () => {
    const { context, gains } = createFakeContext();
    const note = ADD_SOUND[1];
    playBlip(context, note, context.currentTime);
    const noteStart = context.currentTime + note.startMs / 1000;
    expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0, noteStart);
    expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      POP_GAIN_PEAK,
      noteStart + POP_ATTACK_MS / 1000
    );
    expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.0001,
      noteStart + note.durationMs / 1000
    );
  });

  it("uses a note's gainPeak override instead of POP_GAIN_PEAK when present", () => {
    const { context, gains } = createFakeContext();
    const accentNote = FANFARE_SOUND.find((note) => note.gainPeak !== undefined)!;
    playBlip(context, accentNote);
    expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      accentNote.gainPeak,
      expect.any(Number)
    );
  });

  it("defaults `baseTime` to context.currentTime when omitted", () => {
    const { context, gains } = createFakeContext();
    playBlip(context, JOIN_SOUND[0]);
    expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0, context.currentTime);
  });

  it("connects oscillator -> gain -> destination and starts/stops it", () => {
    const { context, oscillators, gains } = createFakeContext();
    playBlip(context, JOIN_SOUND[0]);
    expect(oscillators[0].connect).toHaveBeenCalledWith(gains[0]);
    expect(gains[0].connect).toHaveBeenCalledWith(context.destination);
    expect(oscillators[0].start).toHaveBeenCalledWith(context.currentTime);
    expect(oscillators[0].stop).toHaveBeenCalled();
  });

  it("resumes a suspended context via a rejected-promise handler, not try/catch", () => {
    const { context } = createFakeContext("suspended");
    expect(() => playBlip(context, JOIN_SOUND[0])).not.toThrow();
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("does not resume a context that is already running", () => {
    const { context } = createFakeContext("running");
    playBlip(context, JOIN_SOUND[0]);
    expect(context.resume).not.toHaveBeenCalled();
  });
});

describe("playJingle", () => {
  it("schedules one oscillator/gain pair per note, in order", () => {
    const { context, oscillators } = createFakeContext();
    playJingle(context, JOIN_SOUND);
    expect(oscillators).toHaveLength(JOIN_SOUND.length);
    JOIN_SOUND.forEach((note, i) => {
      expect(oscillators[i].type).toBe(note.type);
      expect(oscillators[i].frequency.value).toBe(note.frequency);
    });
  });

  it("schedules every note's envelope relative to one shared currentTime snapshot", () => {
    const { context, gains } = createFakeContext();
    playJingle(context, ADD_SOUND);
    ADD_SOUND.forEach((note, i) => {
      const expectedStart = context.currentTime + note.startMs / 1000;
      expect(gains[i].gain.setValueAtTime).toHaveBeenCalledWith(0, expectedStart);
    });
  });

  it("schedules overlapping notes (a chord) as separate oscillator/gain pairs", () => {
    const { context, oscillators, gains } = createFakeContext();
    playJingle(context, FANFARE_SOUND);
    expect(oscillators).toHaveLength(FANFARE_SOUND.length);
    expect(gains).toHaveLength(FANFARE_SOUND.length);
    // The finale's two notes share a startMs but each got its own gain node,
    // so neither note's envelope clobbers the other's.
    const finaleIndices = FANFARE_SOUND.reduce<number[]>((acc, note, i) => {
      if (note.gainPeak !== undefined) acc.push(i);
      return acc;
    }, []);
    expect(finaleIndices.length).toBeGreaterThanOrEqual(2);
    expect(gains[finaleIndices[0]]).not.toBe(gains[finaleIndices[1]]);
  });
});

describe("createPartySounds", () => {
  it("never creates an AudioContext while muted", () => {
    const createAudioContext = vi.fn();
    const sounds = createPartySounds(() => true, createAudioContext);
    sounds.playJoin();
    sounds.playAdd();
    sounds.playFanfare();
    expect(createAudioContext).not.toHaveBeenCalled();
  });

  it("creates the context lazily on the first unmuted play and reuses it", () => {
    const { context } = createFakeContext();
    const createAudioContext = vi.fn(() => context);
    const sounds = createPartySounds(() => false, createAudioContext);
    sounds.playJoin();
    sounds.playAdd();
    sounds.playFanfare();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
  });

  it("re-reads getMuted on every call, no stale caching", () => {
    let muted = true;
    const { context, oscillators } = createFakeContext();
    const createAudioContext = vi.fn(() => context);
    const sounds = createPartySounds(() => muted, createAudioContext);

    sounds.playJoin();
    expect(createAudioContext).not.toHaveBeenCalled();

    muted = false;
    sounds.playJoin();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
    expect(oscillators).toHaveLength(JOIN_SOUND.length);
  });

  it("no-ops silently when the environment provides no AudioContext", () => {
    const sounds = createPartySounds(() => false, () => null);
    expect(() => sounds.playAdd()).not.toThrow();
    expect(() => sounds.playFanfare()).not.toThrow();
  });

  describe("playFanfare", () => {
    it("schedules the FANFARE_SOUND jingle when unmuted", () => {
      const { context, oscillators } = createFakeContext();
      const sounds = createPartySounds(() => false, () => context);
      sounds.playFanfare();
      expect(oscillators).toHaveLength(FANFARE_SOUND.length);
      FANFARE_SOUND.forEach((note, i) => {
        expect(oscillators[i].frequency.value).toBe(note.frequency);
      });
    });

    it("respects the same mute toggle as playJoin/playAdd", () => {
      const createAudioContext = vi.fn();
      const sounds = createPartySounds(() => true, createAudioContext);
      sounds.playFanfare();
      expect(createAudioContext).not.toHaveBeenCalled();
    });
  });
});

describe("dispose", () => {
  it("closes the context if one was ever created", () => {
    const { context } = createFakeContext();
    const createAudioContext = vi.fn(() => context);
    const sounds = createPartySounds(() => false, createAudioContext);
    sounds.playJoin();
    sounds.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("no-ops when no context was ever created (never unmuted, or no AudioContext support)", () => {
    const createAudioContext = vi.fn();
    const sounds = createPartySounds(() => true, createAudioContext);
    expect(() => sounds.dispose()).not.toThrow();
    expect(createAudioContext).not.toHaveBeenCalled();
  });

  it("is safe to call more than once", () => {
    const { context } = createFakeContext();
    const sounds = createPartySounds(() => false, () => context);
    sounds.playJoin();
    sounds.dispose();
    expect(() => sounds.dispose()).not.toThrow();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
