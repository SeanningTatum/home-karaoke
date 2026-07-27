import { useTranslation } from "react-i18next";
import { IconMicrophone } from "@tabler/icons-react";
import type { QueueItem } from "@/lib/schemas/room-ws";
import { cleanSongTitle, formatDuration } from "@/lib/song-title";
import { InitialsAvatar } from "@/components/room/initials-avatar";
import { cn } from "@/lib/utils";

export interface NowSingingBannerProps {
  readonly currentItem: QueueItem | null;
  /** "tv" — the host TV screen (`/room/:code`): the single-row now-playing bar
   * (eyebrow + cleaned song title + artist + singer chip + remaining time).
   * "compact" (default) — the guest phone Queue tab (`/join/:code`), unchanged
   * single-row layout. */
  readonly size?: "tv" | "compact";
  /**
   * Seconds left in the current song, from the TV's own player poll
   * (`YoutubePlayer.onProgress`). `null` while unknown — before the player
   * reports a duration, or on the phone, where this isn't rendered at all.
   * TV variant only.
   */
  readonly remainingSeconds?: number | null;
}

/**
 * Title + singer strip above the player. Renders a quiet "nothing queued" hint
 * when idle.
 *
 * The TV variant is one row, not a stack (feat-014): the old two-line 36px
 * title plus a separate credit line cost 128px of the video's height, and the
 * raw YouTube titles it rendered were half SEO cruft. Now the title runs
 * through `cleanSongTitle` — which also yields the artist as a separate,
 * quieter value — and the singer becomes an avatar chip on the same line. The
 * raw title stays on `title`/`aria-label` so nothing is actually lost.
 */
export function NowSingingBanner({
  currentItem,
  size = "compact",
  remainingSeconds = null,
}: NowSingingBannerProps) {
  const { t } = useTranslation("room");
  const isTv = size === "tv";

  if (!currentItem) {
    return (
      <p
        data-testid="room-now-singing"
        className={cn("text-muted-foreground", isTv ? "tv-body" : "text-sm")}
      >
        {t("banner.idle")}
      </p>
    );
  }

  if (isTv) {
    const { song, artist, raw } = cleanSongTitle(
      currentItem.title,
      currentItem.channel
    );

    return (
      <div
        data-testid="room-now-singing"
        className="flex min-w-0 items-center gap-6 text-foreground"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="tv-eyebrow text-muted-foreground">
            {t("banner.now_singing")}
          </span>
          <div className="flex min-w-0 items-baseline gap-3">
            {/* One line, truncated: the cleaned title fits at 28px, and a wrap
                would take height back from the video. `title` keeps the full
                raw string available on hover and to assistive tech. */}
            <p className="tv-song min-w-0 truncate text-foreground" title={raw}>
              {song}
            </p>
            {artist && (
              <span className="shrink-0 truncate text-xl text-muted-foreground">
                · {artist}
              </span>
            )}
          </div>
        </div>

        {/* Singer credit — an avatar chip rather than brass italic text, so
            the person is the recognizable element from across the room. Brass
            stays as the name's color, keeping its punctuation-only role. */}
        <div className="flex shrink-0 items-center gap-3">
          <InitialsAvatar
            name={currentItem.singerNickname}
            size="lg"
            className="size-10 text-base"
            src={currentItem.singerAvatarUrl}
          />
          <span
            data-testid="room-now-singing-singer"
            className="max-w-48 truncate text-2xl font-semibold text-brass"
          >
            {currentItem.singerNickname}
          </span>
          {remainingSeconds !== null && (
            <span
              data-testid="room-now-singing-remaining"
              className="code-marquee ml-3 shrink-0 text-lg text-muted-foreground"
            >
              {t("banner.remaining", { time: formatDuration(remainingSeconds) })}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="room-now-singing"
      className="flex items-center gap-2 text-foreground"
    >
      <IconMicrophone className="size-5 shrink-0 text-primary" />
      <p className="truncate text-lg font-semibold">{currentItem.title}</p>
      <span className="text-muted-foreground">
        {t("banner.singer", { name: currentItem.singerNickname })}
      </span>
    </div>
  );
}
