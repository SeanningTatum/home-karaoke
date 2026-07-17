import { useEffect, useRef, useState } from "react";
import { redirect, Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Effect, Schema } from "effect";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconDoorExit,
  IconMusic,
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

  // Host mute toggle for the WebAudio party sounds below (join/add jingles +
  // the "you're up!" fanfare) — default unmuted, persisted so it survives a
  // page reload. Starts `false` (SSR and first client paint agree) and only
  // flips after mount reading localStorage, same pattern as `NicknameForm`'s
  // stored-nickname prefill. Declared up here (ahead of the celebration/
  // now-up effects below) so `partySoundsRef` exists before the fanfare
  // trigger needs it.
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

  // Close the lazily-created `AudioContext` (if any) on unmount — browsers
  // cap concurrent instances (Chrome: 6), and without this, navigating to
  // this screen repeatedly in one session (re-opening a room, testing) would
  // leak contexts. Ref access only, so this never re-runs.
  useEffect(() => {
    return () => partySoundsRef.current?.dispose();
  }, []);

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
  //
  // The "you're up!" fanfare (Phase 4) hooks into this SAME edge — not a
  // separate observer of `playback.currentItem` — so it inherits the exact
  // same first-connect suppression as the overlay: both the visual card and
  // the sound only ever fire together, on a real singer CHANGE.
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

    // No reduced-motion gate here: the singer announcement must reach every
    // viewer either way — NowUpOverlay's visual card renders regardless of
    // motion preference too (just statically, via the global CSS collapse),
    // and its always-mounted aria-live region announces on top of that.
    if (nowUpDismissTimerRef.current) clearTimeout(nowUpDismissTimerRef.current);
    setNowUpSinger({ nickname: currentItem!.singerNickname });
    partySoundsRef.current?.playFanfare();
    nowUpDismissTimerRef.current = setTimeout(() => setNowUpSinger(null), 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.currentItem?.id]);

  useEffect(
    () => () => {
      if (nowUpDismissTimerRef.current) clearTimeout(nowUpDismissTimerRef.current);
    },
    []
  );

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
      {/* Top bar holds only the room-level controls now (sounds / connection
          / end party). The now-singing title moved into the LEFT column of
          the playing grid below, next to the video, so the video can be the
          largest element on the TV. */}
      <div className="flex items-center justify-end gap-3 pb-4">
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
          lobby -> playing transition instead of resetting.

          Beta feedback (1080p TV): make the video the single largest element.
          LEFT column = compact title + video that grows to fill all leftover
          height (`fill` letterboxes it against the black surface, so it's as
          big as fits with zero page scroll). RIGHT rail is fixed and slim
          (~320px, down from the old minmax(340px,1fr)): participants on top,
          the queue taking the flex-1 middle with its own scroll, and the join
          QR pinned at the bottom so guests can keep joining mid-session.
          There are NO on-screen playback controls here anymore — the host
          drives play/pause/skip from the phone Controls tab on /join/:code. */}
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]",
          !hasCurrentItem && "hidden"
        )}
      >
        <div className="flex min-h-0 flex-col gap-3">
          <div className="shrink-0">
            <NowSingingBanner
              currentItem={playback?.currentItem ?? null}
              size="tv"
            />
          </div>
          {/* Flex-1 box the video fills; `YoutubePlayer fill` + `inset-0`
              lets the video be as large as the leftover height allows,
              letterboxed, never overflowing the viewport. */}
          <div className="relative min-h-0 flex-1">
            <YoutubePlayer
              fill
              className="absolute inset-0"
              playback={playback}
              onVideoEnded={handleVideoEnded}
              onVideoError={handleVideoError}
            />
          </div>
        </div>

        <div
          data-testid="room-playing-rail"
          className="flex min-h-0 flex-col gap-4 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
        >
          <div data-testid="room-playing-participants" className="shrink-0">
            <RosterStrip roster={roster} size="compact" />
          </div>

          <div className="min-h-0 flex-1">
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

          {/* Join QR pinned at the bottom of the rail so guests can keep
              scanning in mid-session (this replaces feat-008's persistent
              corner panel, which now shows only in the lobby state). */}
          <div data-testid="room-playing-join" className="shrink-0">
            <JoinPanel
              joinUrl={joinUrl}
              code={code}
              size="sm"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Lobby state — party's about to start: horizontal two-column layout
          that fits a 1920x1080 TV with zero page scroll (beta feedback: the
          old stacked layout scrolled). QR hero fixed on the LEFT; the
          "who's here" roster board fills the RIGHT and owns its own
          internal `overflow-y-auto` (see RosterStrip) so 30+ guests scroll
          inside their panel — never the page. `min-h-0` is required
          alongside `overflow-y-auto`/`overflow-hidden` throughout here:
          this div is a `flex-1` child of the `h-screen flex-col
          overflow-hidden` root above, and a flex/grid item's default
          `min-height: auto` refuses to shrink below its content size —
          without `min-h-0` on every nested flex/grid child, content would
          just grow taller than the viewport instead of becoming its own
          scroll region. Below `lg` (host previewing on a laptop, not the
          TV) it stacks into a single column and the outer lobby can scroll
          as a fallback. */}
      {!hasCurrentItem && (
        <div
          data-testid="room-lobby"
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto lg:overflow-hidden"
        >
          {/* Page-level header row above BOTH columns (was a lone label
              centered over just the right panel, which read as orphaned).
              Left-aligned so it clearly titles the whole lobby page. */}
          <header className="shrink-0">
            <h1
              data-testid="room-lobby-heading"
              className="tv-title-sm uppercase tracking-[0.12em] text-muted-foreground"
            >
              {t("lobby.heading")}
            </h1>
          </header>

          {/* Wider than the old `max-w-6xl` (1152px) — at 1920px wide a TV
              has plenty of room for a much wider two-column split before
              the QR/roster columns feel cramped. LEFT = QR hero only;
              RIGHT = roster board + (when songs are queued) a queue preview. */}
          <div className="mx-auto grid min-h-0 w-full max-w-[1700px] flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(420px,540px)_1fr]">
            <div className="flex min-h-0 flex-col items-center overflow-y-auto lg:justify-center">
              <JoinPanel joinUrl={joinUrl} code={code} size="lg" />
            </div>

            {/* Right column: "who's here" board (fills + scrolls internally)
                plus a read-only queue preview pinned below it once songs are
                queued. Playback is no longer startable from the TV (beta
                decision: the phone Controls tab is the only playback surface
                — see `lobby.playback_hint` in the QR card), so the preview is
                purely informational. */}
            <div className="flex min-h-0 flex-col gap-5">
              <div
                data-testid="room-lobby-roster-panel"
                className="flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-border/70 bg-card/40"
              >
                <RosterStrip roster={roster} />
              </div>

              {queue.length > 0 && (
                <div
                  data-testid="room-lobby-queue"
                  className="flex shrink-0 flex-col rounded-3xl border border-border/70 bg-card/40 p-6"
                >
                  <div
                    data-testid="room-lobby-queue-summary"
                    className="flex min-h-0 flex-col"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="tv-title-sm flex items-center gap-2 text-foreground">
                        <IconPlaylist className="size-6 text-primary" />
                        {t("queue.title")}
                      </h2>
                      <Badge
                        variant="secondary"
                        data-testid="room-lobby-queue-count"
                        className="px-3 py-1 text-base font-semibold uppercase tracking-[0.04em]"
                      >
                        {t("queue.count", { count: queue.length })}
                      </Badge>
                    </div>
                    <ul className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
                      {queue.slice(0, 4).map((item) => (
                        <li
                          key={item.id}
                          data-testid="room-lobby-queue-item"
                          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                        >
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt=""
                              className="size-12 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <IconMusic className="size-5 text-muted-foreground" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-semibold">
                              {item.title}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <InitialsAvatar name={item.singerNickname} size="sm" />
                              <p className="truncate text-sm text-muted-foreground">
                                {t("queue.singer", { name: item.singerNickname })}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
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
