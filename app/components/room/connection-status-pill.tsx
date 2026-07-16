import { useTranslation } from "react-i18next";
import { IconLoader2 } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/hooks/use-room-socket";

export interface ConnectionStatusPillProps {
  readonly status: ConnectionStatus;
}

/** Quiet pill shown while the room socket isn't in a steady "open" state. */
export function ConnectionStatusPill({ status }: ConnectionStatusPillProps) {
  const { t } = useTranslation("room");

  if (status === "open" || status === "closed") return null;

  return (
    <span
      data-testid="room-reconnecting-pill"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
      )}
    >
      <IconLoader2 className="size-3.5 animate-spin" />
      {status === "connecting"
        ? t("connection.connecting")
        : t("connection.reconnecting")}
    </span>
  );
}
