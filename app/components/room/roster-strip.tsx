import { useTranslation } from "react-i18next";

import { InitialsAvatar } from "@/components/room/initials-avatar";
import type { RosterEntry } from "@/lib/schemas/room-ws";

export interface RosterStripProps {
  readonly roster: readonly RosterEntry[];
}

/**
 * Lobby "who's here" strip — one gradient-avatar chip per connected guest,
 * ticking in as they join. Roster data already flows over the room socket
 * (`state.roster`, keyed by userId) — this just renders it. The host is
 * excluded; this is a guest headcount, not a full roster. Each `<li>` keeps
 * a stable `key={userId}` so a chip's DOM node — and therefore its one-shot
 * `animate-chip-in` entrance — is only created once, the first time that
 * guest appears; existing chips never replay the animation on re-render.
 */
export function RosterStrip({ roster }: RosterStripProps) {
  const { t } = useTranslation("room");
  const guests = roster.filter((entry) => entry.role === "guest");

  if (guests.length === 0) {
    return (
      <p
        data-testid="room-roster-empty"
        className="tv-label text-muted-foreground"
      >
        {t("lobby.roster_empty")}
      </p>
    );
  }

  return (
    <div
      data-testid="room-roster-strip"
      className="flex flex-col items-center gap-4"
    >
      <p className="tv-label text-muted-foreground">
        {t("lobby.roster_title", { count: guests.length })}
      </p>
      <ul className="flex max-w-3xl flex-wrap justify-center gap-4">
        {guests.map((entry) => (
          <li
            key={entry.userId}
            data-testid="room-roster-chip"
            className="animate-chip-in flex flex-col items-center gap-1.5"
          >
            <InitialsAvatar name={entry.nickname} size="lg" />
            <span className="max-w-24 truncate text-sm font-medium text-foreground">
              {entry.nickname}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
