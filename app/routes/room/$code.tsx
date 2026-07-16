import { useEffect, useRef, useState } from "react";
import { redirect, Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Effect, Schema } from "effect";
import { toast } from "sonner";
import { IconArrowLeft, IconDoorExit } from "@tabler/icons-react";

import { requireSession } from "@/lib/session";
import { RoomCode } from "@/lib/schemas/room";
import { RoomRepository } from "@/repositories/room";
import { buildJoinUrl } from "@/lib/room-urls";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { api } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { YoutubePlayer } from "@/components/room/youtube-player";
import { NowSingingBanner } from "@/components/room/now-singing-banner";
import { HostControls } from "@/components/room/host-controls";
import { QueueRail } from "@/components/room/queue-rail";
import { JoinPanel } from "@/components/room/join-panel";
import { ConnectionStatusPill } from "@/components/room/connection-status-pill";
import { RosterStrip } from "@/components/room/roster-strip";
import { CelebrationBurst } from "@/components/room/celebration-burst";
import type { Route } from "./+types/$code";

export const handle = { i18n: ["room"] };

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const session = await requireSession(request, context);
  const code = params.code;

  // Bad/stale code (RoomNotFoundError) or a malformed code (fails the
  // `RoomCode` pattern) get the same friendly non-crash treatment. Any other
  // failure rejects the promise and bubbles to the root ErrorBoundary.
  const lookup = await context.runtime.runPromise(
    Schema.decodeUnknown(RoomCode)(code).pipe(
      Effect.flatMap((roomCode) =>
        Effect.gen(function* () {
          const repo = yield* RoomRepository;
          return yield* repo.getRoomByCode({ code: roomCode });
        })
      ),
      Effect.map((room) => ({ found: true as const, room })),
      Effect.catchTags({
        ParseError: () => Effect.succeed({ found: false as const }),
        RoomNotFoundError: () => Effect.succeed({ found: false as const }),
      })
    )
  );
  if (!lookup.found) {
    return { status: "not_found" as const, code };
  }
  const room = lookup.room;

  if (room.hostUserId !== session.user.id) {
    // Guest join UI is Phase 4 — this currently 404s, which is expected
    // for this phase.
    throw redirect(`/join/${encodeURIComponent(code)}`);
  }

  if (room.status === "closed") {
    return { status: "closed" as const, code };
  }

  const origin = new URL(request.url).origin;
  return {
    status: "ok" as const,
    code,
    room,
    joinUrl: buildJoinUrl(origin, code),
    user: session.user,
  };
}

export default function RoomHostRoute({ loaderData }: Route.ComponentProps) {
  if (loaderData.status !== "ok") {
    return (
      <RoomUnavailable status={loaderData.status} code={loaderData.code} />
    );
  }
  return <RoomHostView {...loaderData} />;
}

function RoomUnavailable({
  status,
  code,
}: {
  status: "not_found" | "closed";
  code: string;
}) {
  const { t } = useTranslation("room");

  return (
    <div
      data-testid="room-unavailable"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center"
    >
      <h1 className="text-2xl font-semibold text-foreground">
        {status === "closed" ? t("state.closed_title") : t("state.not_found_title")}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {status === "closed"
          ? t("state.closed_description")
          : t("state.not_found_description", { code })}
      </p>
      <Button asChild variant="outline" data-testid="room-back-to-dashboard">
        <Link to="/dashboard">
          <IconArrowLeft className="size-4" />
          {t("state.back_to_dashboard")}
        </Link>
      </Button>
    </div>
  );
}

function RoomHostView({
  code,
  room,
  joinUrl,
}: {
  code: string;
  room: { id: string };
  joinUrl: string;
}) {
  const { t } = useTranslation("room");
  const navigate = useNavigate();
  const { state, send, connectionStatus } = useRoomSocket({ code });
  const { queue, playback, roster } = state;

  // "Room goes live" is the lobby -> playing transition: the moment a
  // `currentItem` first appears this session. Playback status can bounce
  // between "playing"/"paused" afterwards without re-triggering — only the
  // null -> non-null edge counts, and only once per mount (see
  // CelebrationBurst's own doc comment for the reduced-motion handling).
  const hasCurrentItem = Boolean(playback?.currentItem);
  const [showCelebration, setShowCelebration] = useState(false);
  const hasCelebratedRef = useRef(false);
  const prevHasCurrentItemRef = useRef<boolean | null>(null);

  useEffect(() => {
    const previouslyHadItem = prevHasCurrentItemRef.current;
    prevHasCurrentItemRef.current = hasCurrentItem;

    if (previouslyHadItem !== false || !hasCurrentItem) return;
    if (hasCelebratedRef.current) return;
    hasCelebratedRef.current = true;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) setShowCelebration(true);
  }, [hasCurrentItem]);

  const recordPlayed = api.room.recordPlayed.useMutation({
    onError: (error) => {
      // Best-effort history write — never blocks the transport control the
      // host just triggered. See app/trpc/routes/room.ts `recordPlayed`.
      console.error("room.recordPlayed failed", error);
    },
  });

  const recordCurrentIfPlaying = () => {
    const current = playback?.currentItem;
    if (!current) return;
    recordPlayed.mutate({
      roomId: room.id,
      videoId: current.videoId,
      singerNickname: current.singerNickname,
      addedByUserId: current.addedByUserId ?? undefined,
      // Idempotency key — dedupes a dual-screen double-record.
      queueItemId: current.id,
    });
  };

  const handleVideoEnded = () => {
    recordCurrentIfPlaying();
    send({
      type: "playback.videoEnded",
      currentItemId: playback?.currentItem?.id,
    });
  };

  // Broken video (not found / embedding disabled / player error): advance
  // the queue but do NOT record history — it was never actually sung.
  const handleVideoError = () => {
    send({
      type: "playback.videoEnded",
      currentItemId: playback?.currentItem?.id,
    });
  };

  const handleSkip = () => {
    recordCurrentIfPlaying();
    send({ type: "playback.skip", currentItemId: playback?.currentItem?.id });
  };

  const closeRoom = api.room.close.useMutation({
    onSuccess: () => navigate("/dashboard"),
    onError: (error) => {
      toast.error(error.message || t("controls.end_party_error"));
    },
  });

  return (
    <div
      data-testid="room-host-view"
      className="tv-safe flex h-screen flex-col overflow-hidden bg-background text-foreground"
    >
      <div
        className={cn(
          "flex items-center gap-3 pb-4",
          hasCurrentItem ? "justify-between" : "justify-end"
        )}
      >
        {hasCurrentItem && (
          <NowSingingBanner currentItem={playback?.currentItem ?? null} size="tv" />
        )}
        <div className="flex shrink-0 items-center gap-3">
          <ConnectionStatusPill status={connectionStatus} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                data-testid="room-end-party-button"
                className="gap-2 text-2xl font-semibold"
              >
                <IconDoorExit className="size-5" />
                {t("controls.end_party")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent data-testid="room-end-party-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-4xl font-bold font-display">
                  {t("controls.end_party_confirm_title")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[1.75rem] leading-[1.4] font-medium">
                  {t("controls.end_party_confirm_description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  data-testid="room-end-party-cancel"
                  size="lg"
                  // `AlertDialogCancel`/`AlertDialogAction` render via
                  // Radix's `asChild` Slot, which merges this className
                  // onto the child by plain concatenation — NOT through
                  // `tailwind-merge` — so a same-specificity override
                  // (`text-2xl`) can lose to the wrapped Button's own
                  // baked-in `text-sm` depending on generated CSS order.
                  // `!` forces it to win regardless.
                  className="!text-2xl !font-semibold"
                >
                  {t("controls.end_party_cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  data-testid="room-end-party-confirm"
                  size="lg"
                  disabled={closeRoom.isPending}
                  onClick={() => closeRoom.mutate({ roomId: room.id })}
                  className="!text-2xl !font-semibold"
                >
                  {t("controls.end_party_confirm_action")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Playing state — kept mounted (just hidden) rather than
          conditionally unmounted while in the lobby, so the YoutubePlayer's
          IFrame instance and its user-gesture "started" flag survive the
          lobby -> playing transition instead of resetting. */}
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[3fr_minmax(340px,1fr)]",
          !hasCurrentItem && "hidden"
        )}
      >
        <div className="flex min-h-0 flex-col gap-4">
          <YoutubePlayer
            playback={playback}
            onVideoEnded={handleVideoEnded}
            onVideoError={handleVideoError}
          />
          <div className="flex items-center justify-between gap-4">
            <HostControls
              playback={playback}
              queueLength={queue.length}
              onPlay={() => send({ type: "playback.play" })}
              onPause={() => send({ type: "playback.pause" })}
              onSkip={handleSkip}
              size="tv"
            />
            {/* Persistent join affordance while a song is playing — always
                visible, never hidden behind an interaction. */}
            <JoinPanel joinUrl={joinUrl} code={code} size="sm" />
          </div>
        </div>

        <div className="min-h-0 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <QueueRail
            queue={queue}
            viewerRole="host"
            reorderable
            size="tv"
            onReorder={(queueItemId, toIndex) =>
              send({ type: "queue.reorder", queueItemId, toIndex })
            }
            onRemove={(queueItemId) => send({ type: "queue.remove", queueItemId })}
          />
        </div>
      </div>

      {/* Lobby state — party's about to start: big room code + QR, idle
          glow, live "who's here" roster. */}
      {!hasCurrentItem && (
        <div
          data-testid="room-lobby"
          className="flex flex-1 flex-col items-center justify-center gap-10 overflow-y-auto py-6"
        >
          <p
            data-testid="room-lobby-heading"
            className="tv-label text-muted-foreground"
          >
            {t("lobby.heading")}
          </p>
          <JoinPanel joinUrl={joinUrl} code={code} size="lg" />
          <RosterStrip roster={roster} />
        </div>
      )}

      <CelebrationBurst
        show={showCelebration}
        onDone={() => setShowCelebration(false)}
      />
    </div>
  );
}
