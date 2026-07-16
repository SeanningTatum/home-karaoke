import { useEffect, useRef, useState } from "react";
import { redirect, Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Effect, Schema } from "effect";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconDoorExit,
  IconMusic,
  IconPlayerPlayFilled,
  IconPlaylist,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

import { requireSession } from "@/lib/session";
import { RoomCode } from "@/lib/schemas/room";
import { RoomRepository } from "@/repositories/room";
import { buildJoinUrl } from "@/lib/room-urls";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { createPartySounds, type PartySounds } from "@/lib/party-sounds";
import { api } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/room/initials-avatar";
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
import { NowUpOverlay } from "@/components/room/now-up-overlay";
import type { Route } from "./+types/$code";

/** localStorage key for the host's party-sounds mute toggle. Absent (or any
 * value other than `"off"`) means unmuted/audible — the documented default. */
const PARTY_SOUNDS_STORAGE_KEY = "hk-party-sounds";

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
  // `state.settings` is `null` until the room DO's first `room.state`
  // snapshot arrives (see `INITIAL_STATE` in `use-room-socket.ts`) — used
  // below to tell "the real initial roster/queue" apart from that empty
  // pre-connect placeholder, so the join/add pop sounds seed against actual
  // data instead of firing for everyone already in the room on connect.
  const hasReceivedSnapshot = state.settings !== null;

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

  // "You're up, {nickname}!" name card — every subsequent singer change,
  // as opposed to CelebrationBurst's one-time "room goes live" moment
  // above. Tracks the previous item id in a ref (same latching discipline):
  // seeded from whatever's current at mount so a page reload mid-song never
  // fires it, then a `null -> item` edge is suppressed exactly once (the
  // lobby -> playing transition CelebrationBurst already owns) via
  // `hasSeenFirstItemRef`, but every `item -> different item` edge — and any
  // LATER `null -> item` edge (queue idled out mid-party, then resumed) —
  // shows the card. Pause/resume never changes `currentItem.id`, so it never
  // re-triggers this.
  const [nowUpSinger, setNowUpSinger] = useState<{ nickname: string } | null>(null);
  const prevNowUpItemIdRef = useRef<string | null>(playback?.currentItem?.id ?? null);
  const hasSeenFirstItemRef = useRef(Boolean(playback?.currentItem));
  const nowUpDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentItem = playback?.currentItem ?? null;
    const currentId = currentItem?.id ?? null;
    const previousId = prevNowUpItemIdRef.current;
    prevNowUpItemIdRef.current = currentId;

    if (currentId === null || currentId === previousId) return;

    if (previousId === null) {
      if (!hasSeenFirstItemRef.current) {
        hasSeenFirstItemRef.current = true;
        return;
      }
    }

    // No reduced-motion gate here: the singer announcement must reach
    // assistive tech either way — NowUpOverlay itself suppresses only the
    // VISUAL card under prefers-reduced-motion while its always-mounted
    // aria-live region still announces.
    if (nowUpDismissTimerRef.current) clearTimeout(nowUpDismissTimerRef.current);
    setNowUpSinger({ nickname: currentItem!.singerNickname });
    nowUpDismissTimerRef.current = setTimeout(() => setNowUpSinger(null), 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.currentItem?.id]);

  useEffect(
    () => () => {
      if (nowUpDismissTimerRef.current) clearTimeout(nowUpDismissTimerRef.current);
    },
    []
  );

  // Host mute toggle for the tiny WebAudio pop sounds below — default
  // unmuted, persisted so it survives a page reload. Starts `false` (SSR
  // and first client paint agree) and only flips after mount reading
  // localStorage, same pattern as `NicknameForm`'s stored-nickname prefill.
  const [soundsMuted, setSoundsMuted] = useState(false);
  const soundsMutedRef = useRef(soundsMuted);
  useEffect(() => {
    soundsMutedRef.current = soundsMuted;
  }, [soundsMuted]);

  useEffect(() => {
    const stored = window.localStorage.getItem(PARTY_SOUNDS_STORAGE_KEY);
    if (stored === "off") setSoundsMuted(true);
  }, []);

  const toggleSounds = () => {
    setSoundsMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem(PARTY_SOUNDS_STORAGE_KEY, next ? "off" : "on");
      return next;
    });
  };

  // Lazily-created once per mount — `createPartySounds` itself never touches
  // `AudioContext` until the first non-muted play, so it's cheap to build
  // eagerly here. Reads the mute flag through a ref (not the `soundsMuted`
  // closure) so a toggle takes effect immediately without recreating this.
  const partySoundsRef = useRef<PartySounds | null>(null);
  if (partySoundsRef.current === null) {
    partySoundsRef.current = createPartySounds(() => soundsMutedRef.current);
  }

  // Join pop — fires once per guest who joins the roster AFTER this screen
  // is already mounted. Seeded from whatever's already in the roster on the
  // first run (initial connect / reconnect snapshot) so existing guests
  // never trigger it retroactively.
  const knownGuestIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    // Still on the empty pre-connect placeholder — nothing real to seed
    // against yet, so don't seed OR fire.
    if (!hasReceivedSnapshot) return;
    const guestIds = roster.filter((r) => r.role === "guest").map((r) => r.userId);
    if (knownGuestIdsRef.current === null) {
      knownGuestIdsRef.current = new Set(guestIds);
      return;
    }
    const hasNewGuest = guestIds.some((id) => !knownGuestIdsRef.current!.has(id));
    guestIds.forEach((id) => knownGuestIdsRef.current!.add(id));
    if (hasNewGuest) partySoundsRef.current?.playJoin();
  }, [roster, hasReceivedSnapshot]);

  // Add pop — same seed-then-diff pattern, for songs added to the queue.
  const knownQueueSoundIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!hasReceivedSnapshot) return;
    const ids = queue.map((item) => item.id);
    if (knownQueueSoundIdsRef.current === null) {
      knownQueueSoundIdsRef.current = new Set(ids);
      return;
    }
    const hasNewItem = ids.some((id) => !knownQueueSoundIdsRef.current!.has(id));
    ids.forEach((id) => knownQueueSoundIdsRef.current!.add(id));
    if (hasNewItem) partySoundsRef.current?.playAdd();
  }, [queue, hasReceivedSnapshot]);

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="room-sounds-toggle"
            aria-label={
              soundsMuted ? t("sounds.unmute_label") : t("sounds.mute_label")
            }
            title={soundsMuted ? t("sounds.unmute_label") : t("sounds.mute_label")}
            onClick={toggleSounds}
          >
            {soundsMuted ? (
              <IconVolumeOff className="size-5" />
            ) : (
              <IconVolume className="size-5" />
            )}
          </Button>
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
          glow, live "who's here" roster. `min-h-0` is required alongside
          `overflow-y-auto` here: this div is a `flex-1` child of the
          `h-screen flex-col overflow-hidden` root above, and a flex item's
          default `min-height: auto` refuses to shrink below its content
          size — without `min-h-0` the lobby would just grow taller than
          the viewport and get silently clipped by the root's
          `overflow-hidden` instead of becoming its own scroll region. */}
      {!hasCurrentItem && (
        <div
          data-testid="room-lobby"
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-6"
        >
          <p
            data-testid="room-lobby-heading"
            className="tv-label text-muted-foreground"
          >
            {t("lobby.heading")}
          </p>

          {/* Two-column once a queue exists — stacking the QR panel, roster,
              queue summary, AND start-party button in one column overflowed
              a 1920x1080 TV viewport (JoinPanel's "lg" size alone is ~600px
              tall). Side-by-side keeps every element on screen without
              shrinking the QR/roster hero the empty-queue lobby keeps as
              its centered stack below. */}
          <div
            className={cn(
              "flex w-full max-w-6xl flex-col items-center gap-8",
              queue.length > 0 && "lg:flex-row lg:items-center lg:justify-center"
            )}
          >
            <div className="flex flex-col items-center gap-6">
              <JoinPanel joinUrl={joinUrl} code={code} size="lg" />
              {/* Capped to a few rows regardless of how many guests are
                  connected — `max-h` + its own `overflow-y-auto` keeps a
                  big roster from pushing anything else off screen. */}
              <div className="max-h-32 w-full max-w-sm overflow-y-auto">
                <RosterStrip roster={roster} />
              </div>
            </div>

            {/* Regression fix (feature-verifier, ui-overhaul): from a cold
                lobby there was previously no way to start the party or see
                what's queued — `room-play-pause-button` + `QueueRail` only
                render once `hasCurrentItem` is true, which itself only
                becomes true AFTER `playback.play` is sent. Shown only once
                something's actually queued; an empty queue leaves the
                lobby exactly as it was (QR + prompt + roster). */}
            {queue.length > 0 && (
              <div
                data-testid="room-lobby-queue"
                className="flex w-full max-w-md flex-col items-center gap-4"
              >
                <div
                  data-testid="room-lobby-queue-summary"
                  className="max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card/60 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                      <IconPlaylist className="size-4" />
                      {t("queue.title")}
                    </h2>
                    <Badge variant="secondary" data-testid="room-lobby-queue-count">
                      {t("queue.count", { count: queue.length })}
                    </Badge>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {queue.slice(0, 3).map((item) => (
                      <li
                        key={item.id}
                        data-testid="room-lobby-queue-item"
                        className="flex items-center gap-3 rounded-lg bg-card p-2"
                      >
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="size-12 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <span className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
                            <IconMusic className="size-5 text-muted-foreground" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.title}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <InitialsAvatar name={item.singerNickname} size="sm" />
                            <p className="truncate text-xs text-muted-foreground">
                              {t("queue.singer", { name: item.singerNickname })}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sends the exact same `playback.play` message
                    `HostControls`'s play button sends below — no new wire
                    protocol. With no `currentItem` yet, `applyClientMessage`
                    (`app/lib/room-state.ts`) pops the queue head into
                    `currentItem`, which flips `hasCurrentItem` true and
                    swaps this whole lobby for the playing-state grid. */}
                <Button
                  size="lg"
                  data-testid="room-lobby-start-party"
                  className="gap-3 rounded-full bg-gradient-accent px-10 py-7 text-2xl font-semibold text-primary-foreground shadow-glow-accent hover:opacity-90"
                  onClick={() => send({ type: "playback.play" })}
                >
                  <IconPlayerPlayFilled className="size-6" />
                  {t("player.start_party")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <CelebrationBurst
        show={showCelebration}
        onDone={() => setShowCelebration(false)}
      />
      <NowUpOverlay singer={nowUpSinger} />
    </div>
  );
}
