import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";

export interface CelebrationBurstProps {
  /** Render the burst. Caller flips this to `true` for exactly one render
   * (the lobby→playing transition, once per session) and back to `false`
   * via `onDone`. */
  readonly show: boolean;
  /** Called ~1.5s after `show` becomes true — caller resets `show` to `false`. */
  readonly onDone: () => void;
}

const PARTICLE_COLORS = ["bg-primary", "bg-secondary", "bg-accent-end", "bg-success"];
const PARTICLE_COUNT = 28;
const DURATION_MS = 1500;

/**
 * One-shot "room goes live" celebration — a brief hand-rolled confetti
 * burst (no library) for the lobby→playing transition. Per design.md §6,
 * celebration moments are rare and this is the only one in Phase 4: it must
 * fire once per session, never on subsequent songs.
 *
 * Reduced-motion handling is split in two, deliberately: the CSS
 * `animate-confetti-fall` keyframe duration collapses under the global
 * `prefers-reduced-motion` net in app.css, but this component is mounted
 * via a JS state flip (not pure CSS), so the caller (`$code.tsx`) also
 * checks `prefers-reduced-motion` before ever setting `show` — a
 * reduced-motion viewer never sees the burst mount at all, not just a
 * duration-zero version of it.
 */
export function CelebrationBurst({ show, onDone }: CelebrationBurstProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: Math.round(Math.random() * 100),
        delay: Math.round(Math.random() * 300),
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      })),
    // Regenerate positions only when a new burst starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [show]
  );

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <div
      aria-hidden
      data-testid="room-celebration-burst"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          style={{ left: `${particle.left}%`, animationDelay: `${particle.delay}ms` }}
          className={cn(
            "animate-confetti-fall absolute top-0 size-3 rounded-sm",
            particle.color
          )}
        />
      ))}
    </div>
  );
}
