import { useTranslation } from "react-i18next";
import { IconMicrophone } from "@tabler/icons-react";
import type { QueueItem } from "@/lib/schemas/room-ws";

export interface NowSingingBannerProps {
  readonly currentItem: QueueItem | null;
}

/** Title + singer strip above the player. Renders a quiet "nothing queued" hint when idle. */
export function NowSingingBanner({ currentItem }: NowSingingBannerProps) {
  const { t } = useTranslation("room");

  if (!currentItem) {
    return (
      <p
        data-testid="room-now-singing"
        className="text-sm text-muted-foreground"
      >
        {t("banner.idle")}
      </p>
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
