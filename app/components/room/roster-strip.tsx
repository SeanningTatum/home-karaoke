import { useTranslation } from "react-i18next";
import { IconUsers } from "@tabler/icons-react";

import { InitialsAvatar } from "@/components/room/initials-avatar";
import type { RosterEntry } from "@/lib/schemas/room-ws";

export interface RosterStripProps {
  readonly roster: readonly RosterEntry[];
  /**
   * "lobby" (default) — the full-height "who's here" board that fills the
   * lobby's right column with big avatars. "compact" — the slim participants
   * strip pinned at the top of the playing-state right rail: a short header
   * over a capped, internally-scrolling wrap of small avatar chips, so the
   * queue below it keeps most of the rail's height.
   */
  readonly size?: "lobby" | "compact";
}

/**
 * Lobby "who's here" board — one gradient-avatar chip per connected guest,
 * ticking in as they join. Roster data already flows over the room socket
 * (`state.roster`, keyed by userId) — this just renders it. The host is
 * excluded; this is a guest headcount, not a full roster. Each `<li>` keeps
 * a stable `key={userId}` so a chip's DOM node — and therefore its one-shot
 * `animate-chip-in` entrance — is only created once, the first time that
 * guest appears; existing chips never replay the animation on re-render.
 *
 * Fills the whole right-hand lobby column (see `app/routes/room/$code.tsx`)
 * and owns its own `overflow-y-auto` on the chip grid so a party of 30+
 * guests scrolls inside this panel — the lobby page itself never scrolls.
 */
export function RosterStrip({ roster, size = "lobby" }: RosterStripProps) {
  const { t } = useTranslation("room");
  const guests = roster.filter((entry) => entry.role === "guest");

  // Compact strip for the playing-state rail — small chips, capped height,
  // its own scroll region so it never steals space from the queue below.
  if (size === "compact") {
    return (
      <div
        data-testid="room-roster-strip"
        className="flex flex-col gap-2"
      >
        <p className="flex items-center gap-1.5 text-lg font-semibold text-muted-foreground">
          <IconUsers className="size-5 shrink-0" aria-hidden />
          {guests.length === 0
            ? t("lobby.roster_empty")
            : t("lobby.roster_title", { count: guests.length })}
        </p>
        {guests.length > 0 && (
          <ul
            data-testid="room-roster-chips-compact"
            className="flex max-h-24 flex-wrap gap-x-3 gap-y-2 overflow-y-auto pr-1"
          >
            {guests.map((entry) => (
              <li
                key={entry.userId}
                data-testid="room-roster-chip"
                className="animate-chip-in flex items-center gap-1.5"
              >
                <InitialsAvatar name={entry.nickname} size="sm" />
                <span className="max-w-24 truncate text-base font-medium text-foreground">
                  {entry.nickname}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (guests.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-5 p-8 text-center">
        <span
          aria-hidden
          className="flex size-24 items-center justify-center rounded-full border border-border/60 bg-muted/40"
        >
          <IconUsers className="size-12 text-muted-foreground/60" />
        </span>
        <p
          data-testid="room-roster-empty"
          className="tv-body max-w-sm text-muted-foreground"
        >
          {t("lobby.roster_empty")}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="room-roster-strip"
      className="flex h-full min-h-0 w-full flex-col gap-5 p-6 lg:p-8"
    >
      <p className="tv-label shrink-0 text-muted-foreground">
        {t("lobby.roster_title", { count: guests.length })}
      </p>
      <ul className="grid min-h-0 flex-1 content-start auto-rows-min grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-4 gap-y-6 overflow-y-auto pr-1">
        {guests.map((entry) => (
          <li
            key={entry.userId}
            data-testid="room-roster-chip"
            className="animate-chip-in flex flex-col items-center gap-2"
          >
            <InitialsAvatar
              name={entry.nickname}
              size="lg"
              className="size-20 text-2xl"
            />
            <span className="max-w-28 truncate text-base font-medium text-foreground">
              {entry.nickname}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
