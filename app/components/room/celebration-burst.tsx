import { useEffect, useRef } from "react";
import confetti, { type CreateTypes } from "canvas-confetti";

export interface CelebrationBurstProps {
  /** Render the burst. Caller flips this to `true` for exactly one render
   * (the lobby→playing transition, once per session) and back to `false`
   * via `onDone`. */
  readonly show: boolean;
  /** Called once the burst has finished — caller resets `show` to `false`. */
  readonly onDone: () => void;
}

/** Same hex stops as the `--primary` / `--secondary` / `--accent-end` /
 * `--success` custom properties in app.css, duplicated here because
 * canvas-confetti paints on a raw 2D canvas (no access to Tailwind
 * classes/CSS vars) — kept in sync by hand if those tokens ever move. */
const PALETTE = {
  dark: ["#ff3d9a", "#a238ff", "#ffd23d", "#2fe6b8"],
  light: ["#d31d70", "#7b1fd6", "#c98a00", "#087a5c"],
} as const;

const DURATION_MS = 1800;
/** `next-themes` (attribute="class", defaultTheme="dark") stamps `dark` on
 * `<html>` — read it directly rather than threading theme context through
 * this one-shot effect component. */
function currentPalette(): string[] {
  if (typeof document === "undefined") return [...PALETTE.dark];
  return document.documentElement.classList.contains("dark") ? [...PALETTE.dark] : [...PALETTE.light];
}

/**
 * One-shot "room goes live" celebration for the lobby→playing transition.
 * Per design.md §6, celebration moments are rare and this is the only one
 * in Phase 4: it must fire once per session, never on subsequent songs.
 *
 * Built on `canvas-confetti` (dedicated `confetti.create()` instance bound
 * to this component's own fixed, pointer-events-none canvas) rather than
 * fighting React with DOM particles — the library owns its canvas'
 * pixels/rAF loop entirely, so it never conflicts with React's reconciler
 * or the other fixed-position overlays (`NowUpOverlay`, `ReactionOverlay`,
 * `ReactionRecap`) sharing this stacking context.
 *
 * Reduced-motion handling is deliberately doubled: the caller
 * (`$code.tsx`) checks `prefers-reduced-motion` before ever setting `show`
 * true, so a reduced-motion viewer never mounts this component at all —
 * and `disableForReducedMotion: true` below is belt-and-braces in case
 * this component is ever reused from a caller that forgets the gate.
 */
export function CelebrationBurst({ show, onDone }: CelebrationBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<CreateTypes | null>(null);

  // Ref-stash the callback so the timer effect stays keyed on `show` alone
  // without stale-capturing a caller's `onDone`.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!show || !canvasRef.current) return;

    const colors = currentPalette();
    const instance = confetti.create(canvasRef.current, {
      resize: true,
      useWorker: true,
    });
    instanceRef.current = instance;

    const shared = { colors, disableForReducedMotion: true } as const;

    // Two side cannons from the bottom corners, angled inward...
    void instance({
      ...shared,
      particleCount: 70,
      angle: 60,
      spread: 55,
      startVelocity: 55,
      origin: { x: 0, y: 1 },
    });
    void instance({
      ...shared,
      particleCount: 70,
      angle: 120,
      spread: 55,
      startVelocity: 55,
      origin: { x: 1, y: 1 },
    });

    // ...then a wide center burst a beat later, so the room reads as one
    // escalating moment rather than three simultaneous pops.
    const centerTimer = setTimeout(() => {
      void instance({
        ...shared,
        particleCount: 110,
        spread: 100,
        startVelocity: 45,
        scalar: 1.15,
        origin: { x: 0.5, y: 0.4 },
      });
    }, 200);

    const doneTimer = setTimeout(() => onDoneRef.current(), DURATION_MS);

    return () => {
      clearTimeout(centerTimer);
      clearTimeout(doneTimer);
      instance.reset();
      instanceRef.current = null;
    };
  }, [show]);

  if (!show) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="room-celebration-burst"
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
