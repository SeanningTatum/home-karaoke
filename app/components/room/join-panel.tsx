import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { IconDeviceMobile } from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";

export interface JoinPanelProps {
  /** Absolute join URL — built server-side from the request origin, never `window.location`. */
  readonly joinUrl: string;
  /** Display code, e.g. "KQ7-3FP". */
  readonly code: string;
}

/** Bottom-left panel: QR code + room code for guests to scan and join. */
export function JoinPanel({ joinUrl, code }: JoinPanelProps) {
  const { t } = useTranslation("room");

  return (
    <Card className="w-fit">
      <CardContent className="flex items-center gap-4 p-4">
        {/* Literal white, not a theme token: QR scanners need a light quiet
            zone with dark modules in every theme, so this surface must not
            follow dark mode. */}
        <div
          data-testid="room-join-qr"
          className="flex shrink-0 items-center justify-center rounded-md bg-white p-2"
        >
          <QRCodeSVG value={joinUrl} size={96} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <IconDeviceMobile className="size-3.5" />
            {t("join.hint")}
          </span>
          <span
            data-testid="room-code-text"
            className="font-mono text-2xl font-bold tracking-wider text-foreground"
          >
            {code}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
