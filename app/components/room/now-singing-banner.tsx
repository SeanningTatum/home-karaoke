import { useTranslation } from "react-i18next";
import { IconMicrophone } from "@tabler/icons-react";
import type { QueueItem } from "@/lib/schemas/room-ws";
import { cn } from "@/lib/utils";

export interface NowSingingBannerProps {
  readonly currentItem: QueueItem | null;
  /** "tv" — the host TV screen (`/room/:code`): tv-headline size + gradient
   * accent text, singer name stacked below. "compact" (default) — the
   * guest phone Queue tab (`/join/:code`), unchanged single-row layout. */
  readonly size?: "tv" | "compact";
}

/** Title + singer strip above the player. Renders a quiet "nothing queued" hint when idle. */
export function NowSingingBanner({
  currentItem,
  size = "compact",
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
    return (
      <div
        data-testid="room-now-singing"
        className="flex min-w-0 items-center text-foreground"
      >
        <div className="min-w-0">
          {/* Beta feedback: the old `tv-headline` (56px, single-line
              truncate) was too large and clipped long song titles on a
              1080p TV. Down to `tv-title` (36px) and allowed to wrap up to
              two lines (`line-clamp-2` + `break-words`) so the video below
              gets the vertical space while a long title stays readable. */}
          <p className="tv-title text-gradient-accent line-clamp-2 break-words">
            {currentItem.title}
          </p>
          <span className="tv-label block truncate normal-case text-muted-foreground">
            {t("banner.singer", { name: currentItem.singerNickname })}
          </span>
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
