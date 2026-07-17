import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  capParticles,
  makeParticle,
  MAX_ACTIVE_PARTICLES,
  type ReactionParticle,
} from "@/lib/reactions";
import type { ReactionEmoji } from "@/lib/schemas/room-ws";
import { cn } from "@/lib/utils";

export interface ReactionOverlayHandle {
  /** Spawn a fly-up burst for `emoji`. `count` taps → up to a few particles. */
  burst(emoji: ReactionEmoji, count: number): void;
}

export interface ReactionOverlayProps {
  /** `tv` renders large emoji for the 10-foot screen; `phone` renders small. */
  readonly variant: "tv" | "phone";
}

/**
 * Particles a single burst may spawn, regardless of the reported `count`.
 * `count` is already clamped to 20 server-side; this keeps even a maxed batch
 * from dominating the shared 40-particle cap on its own.
 */
const MAX_PARTICLES_PER_BURST = 12;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Shared full-screen fly-up layer for emoji reactions (TV + phone). Decorative
 * and `aria-hidden` — emoji-only, no text — and `pointer-events-none` so it
 * never intercepts taps on the controls underneath.
 *
 * Imperative by design: a parent holds a ref and calls `burst()` from the
 * `useRoomSocket` `onReactionBurst` callback, so a stream of reactions animates
 * without re-rendering the whole room. Active particles are capped
 * (`MAX_ACTIVE_PARTICLES`) and each is removed after its own `durationMs` via a
 * timer that's cleaned up on unmount.
 *
 * Reduced motion: `burst()` no-ops entirely for reduced-motion viewers (so no
 * particle ever mounts), matching CelebrationBurst's caller-side gate. The
 * float keyframe also collapses under the global `prefers-reduced-motion` net
 * in app.css as belt-and-suspenders.
 */
export const ReactionOverlay = forwardRef<
  ReactionOverlayHandle,
  ReactionOverlayProps
>(function ReactionOverlay({ variant }, ref) {
  const [particles, setParticles] = useState<readonly ReactionParticle[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Monotonic counter for unique particle keys across bursts (a plain index
  // would collide once particles are removed and re-added).
  const idCounterRef = useRef(0);

  useImperativeHandle(ref, () => ({
    burst(emoji, count) {
      if (prefersReducedMotion()) return;

      const spawnCount = Math.max(
        1,
        Math.min(Math.floor(count), MAX_PARTICLES_PER_BURST)
      );
      const incoming = Array.from({ length: spawnCount }, () => {
        idCounterRef.current += 1;
        return makeParticle(emoji, Math.random, `r${idCounterRef.current}`);
      });

      setParticles((current) =>
        capParticles(current, incoming, MAX_ACTIVE_PARTICLES)
      );

      for (const particle of incoming) {
        const timer = setTimeout(() => {
          timersRef.current.delete(timer);
          setParticles((current) =>
            current.filter((p) => p.id !== particle.id)
          );
        }, particle.durationMs);
        timersRef.current.add(timer);
      }
    },
  }), []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className={cn(
            "animate-reaction-float absolute bottom-0 select-none",
            variant === "tv" ? "text-6xl" : "text-3xl"
          )}
          style={
            {
              left: `${particle.leftPct}%`,
              animationDuration: `${particle.durationMs}ms`,
              "--reaction-drift": `${particle.driftPx}px`,
              "--reaction-rotate": `${particle.rotateDeg}deg`,
            } as CSSProperties
          }
        >
          {particle.emoji}
        </span>
      ))}
    </div>
  );
});
