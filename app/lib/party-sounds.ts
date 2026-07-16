// Tiny WebAudio-synthesized "pop" sounds for the host TV screen
// (`/room/:code`) only — never the guest phone screen. No audio asset
// files: each sound is a short sine/triangle blip with a quiet linear
// attack + exponential decay envelope, synthesized on the fly.
//
// The `AudioContext` is created lazily on the first *enabled* play — never
// eagerly — because browsers block audio playback before a user gesture.
// By the time either sound can fire, the host has already clicked "Start
// the party" earlier in the session, so a gesture exists; if the context
// still comes back `"suspended"` (e.g. a stricter browser policy), we call
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

export interface BlipSpec {
  readonly frequency: number;
  readonly type: OscillatorType;
  readonly durationMs: number;
}

/** Guest joins the roster — a short, bright sine blip. */
export const JOIN_SOUND: BlipSpec = { frequency: 660, type: "sine", durationMs: 90 };

/** Song added to the queue — a slightly longer, warmer triangle blip. */
export const ADD_SOUND: BlipSpec = { frequency: 880, type: "triangle", durationMs: 130 };

/** Peak gain of the envelope — deliberately quiet ("subtle pops", per design.md §7). */
export const POP_GAIN_PEAK = 0.12;

/** Linear attack ramp before the exponential decay. */
export const POP_ATTACK_MS = 8;

export interface PartySounds {
  readonly playJoin: () => void;
  readonly playAdd: () => void;
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
 * Schedules one envelope-shaped oscillator blip on `context` per `spec`.
 * Exported for tests — production code only reaches this through
 * `createPartySounds`.
 */
export function playBlip(context: AudioContextLike, spec: BlipSpec): void {
  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = spec.type;
  oscillator.frequency.value = spec.frequency;

  const now = context.currentTime;
  const attackSeconds = POP_ATTACK_MS / 1000;
  const durationSeconds = spec.durationMs / 1000;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(POP_GAIN_PEAK, now + attackSeconds);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSeconds + 0.02);
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
 * Builds the two host-screen party sound triggers. `getMuted` is read on
 * every call (not just once) so the caller's mute toggle takes effect
 * immediately without recreating this object; `createAudioContext` defaults
 * to the real browser API and is only overridden in tests. The context
 * itself is a lazy singleton — the first non-muted play creates it, every
 * later play (muted or not) reuses it.
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

  const play = (spec: BlipSpec) => {
    if (getMuted()) return;
    const ctx = ensureContext();
    if (!ctx) return;
    playBlip(ctx, spec);
  };

  return {
    playJoin: () => play(JOIN_SOUND),
    playAdd: () => play(ADD_SOUND),
    dispose: () => {
      context?.close();
      context = null;
    },
  };
}
