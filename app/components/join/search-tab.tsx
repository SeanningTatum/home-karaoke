import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { IconLoader2, IconMusic, IconPlus, IconSearch } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/client";
import { MAX_QUEUE_SIZE } from "@/lib/room-state";
import type { ClientMessage } from "@/lib/schemas/room-ws";

/** Surface "queue almost full" once fewer than this many slots remain,
 * rather than only failing silently at the hard `MAX_QUEUE_SIZE` cap. */
const QUEUE_NEARLY_FULL_THRESHOLD = 20;

export interface SearchTabProps {
  readonly roomId: string;
  readonly send: (message: ClientMessage) => void;
  /** Current live queue length — used to (a) compute the "Added! You're #N"
   * toast position (the DO always appends to the tail, so `queueLength + 1`
   * at send-time is the guest's expected position) and (b) surface a
   * near-cap warning next to the add button. */
  readonly queueLength: number;
  /** Called after a song is successfully queued — switches to the Queue tab. */
  readonly onQueued: () => void;
}

/**
 * Search tab of `/join/:code` — submit-triggered search (never
 * per-keystroke), an "Add" button per result that resolves full metadata
 * before sending `queue.add`, and an always-available paste-a-link
 * fallback (auto-opened when the API reports quota exhaustion).
 */
export function SearchTab({ roomId, send, queueLength, onQueued }: SearchTabProps) {
  const { t } = useTranslation("room");
  const [query, setQuery] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const remainingSlots = MAX_QUEUE_SIZE - queueLength;
  const queueNearlyFull =
    remainingSlots > 0 && remainingSlots <= QUEUE_NEARLY_FULL_THRESHOLD;

  const search = api.youtube.search.useMutation({
    onError: (error) => {
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        setQuotaExceeded(true);
        setPasteMode(true);
      } else {
        toast.error(error.message || t("join.search.error"));
      }
    },
  });

  const resolveVideo = api.youtube.resolveVideo.useMutation({
    onSuccess: (metadata) => {
      send({
        type: "queue.add",
        videoId: metadata.videoId,
        title: metadata.title,
        channel: metadata.channel,
        thumbnailUrl: metadata.thumbnailUrl,
      });
      // `addToQueue` always appends to the tail (see `app/lib/room-state.ts`),
      // so the guest's position is deterministically `queueLength + 1` at
      // the moment this send fires — a best-effort estimate if another
      // guest adds in the same instant, but accurate for the common case
      // and far more useful than a generic "added" toast.
      toast.success(t("join.search.added_position", { count: queueLength + 1 }));
      setPasteUrl("");
      setPendingId(null);
      onQueued();
    },
    onError: (error) => {
      setPendingId(null);
      if (
        pasteMode &&
        (error.data?.code === "BAD_REQUEST" || error.data?.code === "NOT_FOUND")
      ) {
        // Only blame the pasted URL when the server actually rejected it as
        // one (unparseable / video doesn't exist) — an upstream YouTube
        // outage (BAD_GATEWAY etc.) is not the user's link's fault.
        toast.error(t("join.search.paste_error"));
      } else {
        toast.error(error.message || t("join.search.error"));
      }
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Debounce guard — search is submit-triggered only; ignore a resubmit
    // while one is already in flight instead of firing a second request.
    if (search.isPending) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    setQuotaExceeded(false);
    search.mutate({ query: trimmed, roomId });
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolveVideo.isPending) return;
    const trimmed = pasteUrl.trim();
    if (!trimmed) return;
    setPendingId("__paste__");
    resolveVideo.mutate({ url: trimmed, roomId });
  };

  const handleAdd = (result: { videoId: string }) => {
    if (resolveVideo.isPending) return;
    setPendingId(result.videoId);
    resolveVideo.mutate({
      videoId: result.videoId,
      searchLogId:
        search.data?.source === "api" ? search.data.searchLogId : undefined,
      roomId,
    });
  };

  return (
    <div data-testid="join-search-tab" className="flex flex-col gap-4">
      <form
        onSubmit={handleSearchSubmit}
        data-testid="join-search-form"
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("join.search.placeholder")}
          data-testid="join-search-input"
          className="h-11 flex-1 text-base"
        />
        <Button
          type="submit"
          size="icon-lg"
          disabled={search.isPending}
          data-testid="join-search-submit"
          className="shrink-0 rounded-full"
        >
          {search.isPending ? (
            <IconLoader2 className="size-5 animate-spin" />
          ) : (
            <IconSearch className="size-5" />
          )}
        </Button>
      </form>

      {queueNearlyFull && (
        <p
          data-testid="join-search-queue-warning"
          className="text-xs font-medium text-muted-foreground"
        >
          {t("join.search.queue_almost_full", { count: remainingSlots })}
        </p>
      )}

      {quotaExceeded && (
        <div
          data-testid="join-search-quota"
          className="rounded-md border border-border bg-muted/40 p-3 text-sm"
        >
          <p className="font-medium text-foreground">
            {t("join.search.quota_title")}
          </p>
          <p className="text-muted-foreground">
            {t("join.search.quota_description")}
          </p>
        </div>
      )}

      {!pasteMode && (
        <button
          type="button"
          onClick={() => setPasteMode(true)}
          data-testid="join-search-paste-toggle"
          className="self-start text-xs text-muted-foreground underline underline-offset-4"
        >
          {t("join.search.paste_toggle")}
        </button>
      )}

      {pasteMode && (
        <form
          onSubmit={handlePasteSubmit}
          data-testid="join-paste-form"
          className="flex gap-2"
        >
          <Input
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            placeholder={t("join.search.paste_placeholder")}
            data-testid="join-paste-url-input"
          />
          <Button
            type="submit"
            disabled={resolveVideo.isPending}
            data-testid="join-paste-url-submit"
          >
            {resolveVideo.isPending && pendingId === "__paste__" ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              t("join.search.paste_submit")
            )}
          </Button>
        </form>
      )}

      {search.data && search.data.results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {t("join.search.empty")}
        </p>
      )}

      <ul data-testid="join-search-results" className="flex flex-col gap-2">
        {search.data?.results.map((result) => (
          <li
            key={result.videoId}
            data-testid="join-search-result"
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
          >
            {result.thumbnailUrl ? (
              <img
                src={result.thumbnailUrl}
                alt=""
                className="size-14 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted">
                <IconMusic className="size-6 text-muted-foreground" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">
                {result.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {result.channel}
              </p>
            </div>
            {/* Add-song "+" — per design.md §3, one of the three places the
             * gradient accent is deliberately used. */}
            <Button
              type="button"
              size="icon-lg"
              variant="default"
              onClick={() => handleAdd(result)}
              disabled={resolveVideo.isPending}
              aria-label={t("join.search.add")}
              title={t("join.search.add")}
              data-testid="join-search-add"
              className={cn(
                "shrink-0 rounded-full bg-gradient-accent text-primary-foreground shadow-glow-accent hover:opacity-90"
              )}
            >
              {resolveVideo.isPending && pendingId === result.videoId ? (
                <IconLoader2 className="size-5 animate-spin" />
              ) : (
                <IconPlus className="size-5" />
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
