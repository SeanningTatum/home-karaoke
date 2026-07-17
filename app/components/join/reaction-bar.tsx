import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  MAX_REACTION_BATCH,
  REACTION_EMOJIS,
  type ClientMessage,
  type ReactionEmoji,
} from "@/lib/schemas/room-ws";
import { cn } from "@/lib/utils";

export interface ReactionBarProps {
  readonly send: (message: ClientMessage) => boolean;
  /** Muted + inert while nothing is playing (nothing to react to yet). */
  readonly disabled: boolean;
}

/** Tap-accumulation window — a burst of taps on the same emoji within this
 * many ms collapses into a single `reaction.send` batch instead of one
 * message per tap. */
const BATCH_WINDOW_MS = 300;

/**
 * Persistent tap strip on `/join/:code` — one finger-sized button per
 * `REACTION_EMOJIS`, mounted below the Tabs on every tab. Taps for each
 * emoji accumulate in a plain ref (no re-render per tap) until a 300ms
 * flush timer — started on the first tap of a window — fires and sends one
 * `reaction.send` per emoji touched, with `count` already clamped to
 * `MAX_REACTION_BATCH`. If the socket is down `send` returns `false`; that
 * batch is dropped silently, matching the rest of the room UI's "offline
 * just means the tap didn't land" treatment (no error toast for a
 * best-effort reaction).
 *
 * This component never spawns particles itself — the tap's own fly-up
 * feedback comes back over the wire as a `reaction.burst` broadcast,
 * rendered by the phone `ReactionOverlay` mounted at the route root.
 */
export function ReactionBar({ send, disabled }: ReactionBarProps) {
  const { t } = useTranslation("room");
  const pendingRef = useRef<Partial<Record<ReactionEmoji, number>>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every tap purely to re-trigger the sr-only `aria-live`
  // announcement below — screen readers only announce a live region when
  // its content actually changes, and "Reaction sent" alone wouldn't change
  // between one tap and the next.
  const [announceTick, setAnnounceTick] = useState(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flush = () => {
    timerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = {};
    for (const emoji of REACTION_EMOJIS) {
      const count = pending[emoji];
      if (!count) continue;
      send({ type: "reaction.send", emoji, count });
    }
  };

  const handleTap = (emoji: ReactionEmoji) => {
    if (disabled) return;
    const current = pendingRef.current[emoji] ?? 0;
    pendingRef.current[emoji] = Math.min(current + 1, MAX_REACTION_BATCH);
    if (!timerRef.current) {
      timerRef.current = setTimeout(flush, BATCH_WINDOW_MS);
    }
    setAnnounceTick((n) => n + 1);
  };

  return (
    <div
      role="group"
      aria-label={t("reactions.bar_label")}
      data-testid="join-reaction-bar"
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2 py-2 shadow-sm backdrop-blur"
    >
      {REACTION_EMOJIS.map((emoji, index) => (
        <button
          key={emoji}
          type="button"
          disabled={disabled}
          onClick={() => handleTap(emoji)}
          aria-label={emoji}
          data-testid={`join-reaction-button-${index}`}
          className={cn(
            "flex h-12 flex-1 items-center justify-center rounded-md text-2xl transition-transform active:scale-90",
            "disabled:pointer-events-none disabled:opacity-40 disabled:grayscale",
            !disabled && "bg-muted/60 hover:bg-muted"
          )}
        >
          {emoji}
        </button>
      ))}
      <span aria-live="polite" className="sr-only">
        {announceTick > 0 ? t("reactions.aria_sent") : ""}
      </span>
    </div>
  );
}
