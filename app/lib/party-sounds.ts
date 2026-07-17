// WebAudio-synthesized sound effects for the host TV screen (`/room/:code`)
// only — never the guest phone screen. No audio asset files: every sound is
// a short sequence of oscillator "notes", each with its own linear attack +
// exponential decay envelope, synthesized on the fly.
//
// Phase 4 (beta feedback: "current blips too timid, barely noticed") swapped
// the original single-note blips for multi-note jingles and raised the
// default peak gain — see `POP_GAIN_PEAK`'s doc comment. The engine is still
// pure data + a scheduler: every sound is a `JingleSpec` (an ordered list of
// `NoteSpec`s), so new sounds are just new arrays, not new code paths.
//
// The `AudioContext` is created lazily on the first *enabled* play — never
// eagerly — because browsers block audio playback before a user gesture. By
// the time any sound can fire, the host has already clicked "Start the
// party" earlier in the session, so a gesture exists; if the context still
// comes back `"suspended"` (e.g. a stricter browser policy), we call
// `resume()` and attach a `.catch(() => {})` — a rejected-promise handler,
// not try/catch syntax — so a resume failure silently no-ops rather than
// throwing.
//
// `createPartySounds` takes an injectable `createAudioContext` factory (see
// `AudioContextLike` below) purely so tests can exercise the envelope/branch
// logic without mocking the entire WebAudio API — production callers never
// pass the second argument.

export type AudioContextLike = Pick<
  AudioContext,
  | "createOscillator"
  | "createGain"
  | "currentTime"
  | "destination"
  | "state"
  | "resume"
  | "close"
>;

export interface NoteSpec {
  readonly frequency: number;
  readonly type: OscillatorType;
  /** Offset from the jingle's start, in ms, at which this note's own
   * attack/decay envelope begins. Two notes sharing a `startMs` ring
   * simultaneously as a chord — each gets its own oscillator/gain pair, so
   * they never fight over one envelope. */
  readonly startMs: number;
  /** This note's own attack + decay duration, in ms. */
  readonly durationMs: number;
  /** Overrides `POP_GAIN_PEAK` for just this note (e.g. a louder finale
   * accent). Must stay at or under `MAX_GAIN_PEAK`. */
  readonly gainPeak?: number;
}

/** An ordered sequence of notes making up one sound effect. A single-note
 * jingle is just an array of length 1 — there's no separate "blip" type. */
export type JingleSpec = readonly NoteSpec[];

/** Peak gain used by default for every note unless it sets `gainPeak`.
 * Raised from 0.12 (the PR #3-era baseline beta testers reported as "barely
 * noticed") to ~0.24 — punchy enough to register on a TV speaker without
 * clipping. Same attack/decay envelope discipline as before; only the
 * ceiling moved. */
export const POP_GAIN_PEAK = 0.24;

/** Hard ceiling any single note's gain — default or overridden — may reach.
 * Keeps the fanfare's louder finale chord punchy without clipping. */
export const MAX_GAIN_PEAK = 0.3;

/** Gain for the fanfare's held two-note finale chord (see `FANFARE_SOUND`)
 * — louder than the jingle default so the "you're up!" payoff actually
 * lands, while staying under `MAX_GAIN_PEAK`. */
export const FANFARE_ACCENT_GAIN_PEAK = 0.28;

/** Linear attack ramp before the exponential decay, per note. */
export const POP_ATTACK_MS = 8;

/** Guest joins the roster — a bright 3-note ascending major arpeggio
 * (C5-E5-G5, sine), replacing the old single 660Hz blip with an actual
 * "player joined the game" flourish. ~295ms total. */
export const JOIN_SOUND: JingleSpec = [
  { frequency: 523.25, type: "sine", startMs: 0, durationMs: 90 },
  { frequency: 659.25, type: "sine", startMs: 90, durationMs: 90 },
  { frequency: 783.99, type: "sine", startMs: 175, durationMs: 120 },
];

/** Song added to the queue — a 3-note "coin" jingle rising root-fifth-octave
 * (A5-E6-A6), triangle-voiced so it's texturally distinct from `JOIN_SOUND`'s
 * sine tone even before the ear registers the different notes/rhythm.
 * ~270ms total. */
export const ADD_SOUND: JingleSpec = [
  { frequency: 880, type: "triangle", startMs: 0, durationMs: 70 },
  { frequency: 1318.51, type: "triangle", startMs: 55, durationMs: 70 },
  { frequency: 1760, type: "triangle", startMs: 110, durationMs: 160 },
];

/** "You're up!" fanfare — fired once per singer change (see the ref-latched
 * `nowUpSinger` effect in `app/routes/room/$code.tsx`, which owns both the
 * `NowUpOverlay` announcement and this sound so they can never drift apart).
 * A quick square-wave run up a C major triad (C5-E5-G5-C6) into a held
 * two-note finale chord (G5+C6, sawtooth, same `startMs` so they ring
 * together) at the louder `FANFARE_ACCENT_GAIN_PEAK`. ~870ms total. */
export const FANFARE_SOUND: JingleSpec = [
  { frequency: 523.25, type: "square", startMs: 0, durationMs: 100 },
  { frequency: 659.25, type: "square", startMs: 90, durationMs: 100 },
  { frequency: 783.99, type: "square", startMs: 180, durationMs: 100 },
  { frequency: 1046.5, type: "square", startMs: 270, durationMs: 130 },
  {
    frequency: 783.99,
    type: "sawtooth",
    startMs: 420,
    durationMs: 450,
    gainPeak: FANFARE_ACCENT_GAIN_PEAK,
  },
  {
    frequency: 1046.5,
    type: "sawtooth",
    startMs: 420,
    durationMs: 450,
    gainPeak: FANFARE_ACCENT_GAIN_PEAK,
  },
];

export interface PartySounds {
  readonly playJoin: () => void;
  readonly playAdd: () => void;
  /** Celebratory "you're up!" flourish — call exactly when the now-up-singer
   * announcement appears (never as a separate observer of playback state;
   * see the doc comment on `FANFARE_SOUND`). Respects the same mute toggle
   * as `playJoin`/`playAdd`. */
  readonly playFanfare: () => void;
  /**
   * Closes the lazily-created `AudioContext`, if one was ever created — call
   * from the host screen's unmount cleanup. Browsers cap concurrent
   * `AudioContext` instances (Chrome: 6), so without this a host who
   * navigates to the room screen repeatedly in one session (re-opening a
   * room, testing) would leak contexts until GC catches up or the cap hits.
   * Safe to call even if no context was ever created (muted the whole time)
   * or `dispose` is called more than once.
   */
  readonly dispose: () => void;
}

/**
 * Schedules one envelope-shaped oscillator note on `context`, starting at
 * `baseTime + note.startMs` seconds (`baseTime` defaults to
 * `context.currentTime`, i.e. "play this note on its own, right now").
 * Exported for tests and reused by `playJingle` for every note in a
 * sequence — production code only reaches this through `createPartySounds`.
 */
export function playBlip(
  context: AudioContextLike,
  note: NoteSpec,
  baseTime: number = context.currentTime
): void {
  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = note.type;
  oscillator.frequency.value = note.frequency;

  const noteStart = baseTime + note.startMs / 1000;
  const attackSeconds = POP_ATTACK_MS / 1000;
  const durationSeconds = note.durationMs / 1000;
  const peak = note.gainPeak ?? POP_GAIN_PEAK;

  gain.gain.setValueAtTime(0, noteStart);
  gain.gain.linearRampToValueAtTime(peak, noteStart + attackSeconds);
  gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + durationSeconds);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(noteStart);
  oscillator.stop(noteStart + durationSeconds + 0.02);
}

/**
 * Schedules every note in `jingle` against a single shared
 * `context.currentTime` snapshot (read once, up front) so notes stay locked
 * to their intended relative `startMs` offsets instead of drifting against
 * however long synchronous scheduling takes. Each note gets its own
 * oscillator/gain pair via `playBlip`, so overlapping `startMs` windows
 * (see `FANFARE_SOUND`'s finale chord) ring simultaneously without either
 * note clobbering the other's envelope.
 */
export function playJingle(context: AudioContextLike, jingle: JingleSpec): void {
  const now = context.currentTime;
  for (const note of jingle) {
    playBlip(context, note, now);
  }
}

function defaultCreateAudioContext(): AudioContextLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

/**
 * Builds the host-screen party sound triggers. `getMuted` is read on every
 * call (not just once) so the caller's mute toggle takes effect immediately
 * without recreating this object; `createAudioContext` defaults to the real
 * browser API and is only overridden in tests. The context itself is a lazy
 * singleton — the first non-muted play creates it, every later play (muted
 * or not) reuses it.
 */
export function createPartySounds(
  getMuted: () => boolean,
  createAudioContext: () => AudioContextLike | null = defaultCreateAudioContext
): PartySounds {
  let context: AudioContextLike | null = null;

  const ensureContext = (): AudioContextLike | null => {
    if (!context) context = createAudioContext();
    return context;
  };

  const play = (jingle: JingleSpec) => {
    if (getMuted()) return;
    const ctx = ensureContext();
    if (!ctx) return;
    playJingle(ctx, jingle);
  };

  return {
    playJoin: () => play(JOIN_SOUND),
    playAdd: () => play(ADD_SOUND),
    playFanfare: () => play(FANFARE_SOUND),
    dispose: () => {
      context?.close();
      context = null;
    },
  };
}
