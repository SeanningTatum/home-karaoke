import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { IconLoader2, IconMusic, IconSearch } from "@tabler/icons-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/client";
import { VIDEO_NOT_EMBEDDABLE_MESSAGE_PREFIX } from "@/models/errors/youtube";
import type { ClientMessage } from "@/lib/schemas/room-ws";

export interface SearchTabProps {
  readonly roomId: string;
  readonly send: (message: ClientMessage) => void;
  /** Called after a song is successfully queued — switches to the Queue tab. */
  readonly onQueued: () => void;
}

/**
 * Search tab of `/join/:code` — submit-triggered search (never
 * per-keystroke), an "Add" button per result that resolves full metadata
 * before sending `queue.add`, and an always-available paste-a-link
 * fallback (auto-opened when the API reports quota exhaustion).
 */
export function SearchTab({ roomId, send, onQueued }: SearchTabProps) {
  const { t } = useTranslation("room");
  const [query, setQuery] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

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
      toast.success(t("join.search.added"));
      setPasteUrl("");
      setPendingId(null);
      onQueued();
    },
    onError: (error) => {
      setPendingId(null);
      if (error.message.startsWith(VIDEO_NOT_EMBEDDABLE_MESSAGE_PREFIX)) {
        toast.error(t("join.search.not_embeddable"));
      } else if (
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
        />
        <Button
          type="submit"
          disabled={search.isPending}
          data-testid="join-search-submit"
        >
          {search.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconSearch className="size-4" />
          )}
        </Button>
      </form>

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
            className="flex items-center gap-3 rounded-md border border-border bg-card p-2"
          >
            {result.thumbnailUrl ? (
              <img
                src={result.thumbnailUrl}
                alt=""
                className="size-12 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
                <IconMusic className="size-5 text-muted-foreground" />
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
            <Button
              size="sm"
              type="button"
              onClick={() => handleAdd(result)}
              disabled={resolveVideo.isPending}
              data-testid="join-search-add"
            >
              {resolveVideo.isPending && pendingId === result.videoId ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                t("join.search.add")
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
