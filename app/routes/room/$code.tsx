import { useEffect, useRef, useState } from "react";
import { redirect, Link, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { Effect, Schema } from "effect";
import {
  IconArrowLeft,
  IconMusic,
  IconPlaylist,
} from "@tabler/icons-react";

import { requireSession } from "@/lib/session";
import { RoomCode } from "@/lib/schemas/room";
import { RoomRepository } from "@/repositories/room";
import { buildJoinUrl } from "@/lib/room-urls";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { createPartySounds, type PartySounds } from "@/lib/party-sounds";
import type {
  ReactionBurstMessage,
  ReactionRecapMessage,
} from "@/lib/schemas/room-ws";
import type { ReactionRecapPayload } from "@/lib/reaction-recap-state";
import { api } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/room/initials-avatar";
import { YoutubePlayer } from "@/components/room/youtube-player";
import { NowSingingBanner } from "@/components/room/now-singing-banner";
import { QueueRail } from "@/components/room/queue-rail";
import { JoinPanel } from "@/components/room/join-panel";
import { ConnectionStatusPill } from "@/components/room/connection-status-pill";
import { RosterStrip } from "@/components/room/roster-strip";
import { CelebrationBurst } from "@/components/room/celebration-burst";
import { NowUpOverlay } from "@/components/room/now-up-overlay";
import {
  ReactionOverlay,
  type ReactionOverlayHandle,
} from "@/components/room/reaction-overlay";
import { ReactionRecap, RECAP_TOTAL_MS } from "@/components/room/reaction-recap";
import type { Route } from "./+types/$code";

/** localStorage key for the host's party-sounds mute toggle. Absent (or any
 * value other than `"off"`) means unmuted/audible — the documented default. */
const PARTY_SOUNDS_STORAGE_KEY = "hk-party-sounds";

/** Minimum gap between two reaction-pop sounds (feat-010) — a flurry of
 * guest taps fans out as many `reaction.burst` messages in quick succession,
 * but the pop is only meant to register as "reactions are happening", not to
 * fire once per burst. */
const REACTION_POP_THROTTLE_MS = 700;

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
  // Emoji reactions (feat-010) — the TV-side overlay handle, the reaction-pop
  // throttle clock, the end-of-song recap state, and a ref flag the
  // currentItem-change effect below reads to decide whether to defer the
  // "You're up" announcement. Declared here (before `useRoomSocket`) so the
  // socket callbacks below can close over them; `partySoundsRef` (created
  // further down) is referenced inside those callback BODIES only, which
  // aren't invoked until a WebSocket message actually arrives — well after
  // this render has finished setting it up.
  const reactionOverlayRef = useRef<ReactionOverlayHandle>(null);
  const lastPopAtRef = useRef(0);
  const recapActiveRef = useRef(false);
  const [recap, setRecap] = useState<ReactionRecapPayload | null>(null);

  const handleReactionBurst = (msg: ReactionBurstMessage) => {
    reactionOverlayRef.current?.burst(msg.emoji, msg.count);
    const now = Date.now();
    if (now - lastPopAtRef.current >= REACTION_POP_THROTTLE_MS) {
      lastPopAtRef.current = now;
      partySoundsRef.current?.playReactionPop();
    }
  };

  const handleReactionRecap = (msg: ReactionRecapMessage) => {
    setRecap({
      singerNickname: msg.singerNickname,
      total: msg.total,
      breakdown: msg.breakdown,
    });
    recapActiveRef.current = true;
    partySoundsRef.current?.playRecap();
  };

  const { state, send, connectionStatus, roomClosed } = useRoomSocket({
    code,
    onReactionBurst: handleReactionBurst,
    onReactionRecap: handleReactionRecap,
  });
  const { queue, playback, roster } = state;
  // `state.settings` is `null` until the room DO's first `room.state`
  // snapshot arrives (see `INITIAL_STATE` in `use-room-socket.ts`) — used
  // below to tell "the real initial roster/queue" apart from that empty
  // pre-connect placeholder, so the join/add pop sounds seed against actual
  // data instead of firing for everyone already in the room on connect.
  const hasReceivedSnapshot = state.settings !== null;

  // Party-sounds mute for the WebAudio jingles below (join/add + the
  // "you're up!" fanfare). The on-screen TV toggle was removed per beta
  // feedback (annotation C) — we still honor the persisted default so a
  // room that was previously muted stays muted, but there's no longer a
  // control surface for it on the TV. (A future home for the toggle, if one
  // is wanted, is the phone Controls tab alongside the other host controls.)
  // Starts `false` so SSR and first client paint agree, then flips after
  // mount from localStorage — same pattern as `NicknameForm`'s stored
  // nickname prefill. The play path reads `soundsMutedRef`, not this state
  // directly, so `partySoundsRef` (below) never needs recreating.
  const [soundsMuted, setSoundsMuted] = useState(false);
  const soundsMutedRef = useRef(soundsMuted);
  useEffect(() => {
    soundsMutedRef.current = soundsMuted;
  }, [soundsMuted]);

  useEffect(() => {
    const stored = window.localStorage.getItem(PARTY_SOUNDS_STORAGE_KEY);
    if (stored === "off") setSoundsMuted(true);
  }, []);

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
  // Emoji reactions (feat-010) — holds the pending "You're up" announcement
  // while `recapActiveRef` is true (see `handleReactionRecap` above and the
  // effect below). Cleared whenever a superseding singer change arrives so a
  // stale delayed announcement never fires for the wrong nickname.
  const nowUpAnnounceDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Fires the "You're up, {nickname}!" card + fanfare together (see the
  // FANFARE_SOUND doc comment — they must never drift apart) and (re)arms
  // the 5s auto-dismiss. Pulled out of the effect below so it can be called
  // either immediately or after the `RECAP_TOTAL_MS` reaction-recap deferral.
  const announceNowUp = (nickname: string) => {
    if (nowUpDismissTimerRef.current) clearTimeout(nowUpDismissTimerRef.current);
    setNowUpSinger({ nickname });
    partySoundsRef.current?.playFanfare();
    nowUpDismissTimerRef.current = setTimeout(() => setNowUpSinger(null), 5000);
  };

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

    if (nowUpAnnounceDelayTimerRef.current) {
      clearTimeout(nowUpAnnounceDelayTimerRef.current);
      nowUpAnnounceDelayTimerRef.current = null;
    }

    // No reduced-motion gate here: the singer announcement must reach every
    // viewer either way — NowUpOverlay's visual card renders regardless of
    // motion preference too (just statically, via the global CSS collapse),
    // and its always-mounted aria-live region announces on top of that.
    const nickname = currentItem!.singerNickname;

    // The server broadcasts `reaction.recap` for the just-finished song
    // BEFORE the `playback.updated` that advances `currentItem` — so
    // `recapActiveRef.current` is already set by the time this effect
    // re-runs. Defer the announcement by `RECAP_TOTAL_MS` (visible hold +
    // exit window) so the "You're up" entrance never runs hidden behind the
    // still-opaque exiting recap card, which stacks above it at the same z.
    if (recapActiveRef.current) {
      nowUpAnnounceDelayTimerRef.current = setTimeout(() => {
        nowUpAnnounceDelayTimerRef.current = null;
        announceNowUp(nickname);
      }, RECAP_TOTAL_MS);
    } else {
      announceNowUp(nickname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.currentItem?.id]);

  useEffect(
    () => () => {
      if (nowUpDismissTimerRef.current) clearTimeout(nowUpDismissTimerRef.current);
      if (nowUpAnnounceDelayTimerRef.current)
        clearTimeout(nowUpAnnounceDelayTimerRef.current);
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

  // The DO broadcast `room.closed` (host ended the party — possibly from
  // another tab/device). Re-run the loader: it resolves the room as closed
  // and this route renders the closed state instead of a stale live UI.
  const revalidator = useRevalidator();
  useEffect(() => {
    if (roomClosed) void revalidator.revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomClosed]);

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

  // Recap card finished (visible hold + exit animation) — clear it and let
  // the deferred "You're up" announcement (if any is pending) proceed on its
  // own RECAP_TOTAL_MS timer, which was armed independently in the effect above.
  const handleRecapDone = () => {
    setRecap(null);
    recapActiveRef.current = false;
  };

  return (
    <div
      data-testid="room-host-view"
      className="tv-safe flex h-screen flex-col overflow-hidden bg-background text-foreground lg:flex-row"
    >
      {/* MAIN column — the navbar-style top bar sits INSIDE this column (not
          spanning the rail) so the rail can extend the full viewport height
          beside it (annotation H). Below it: the playing video (kept mounted,
          just hidden, in the lobby so the YoutubePlayer IFrame survives the
          lobby -> playing transition) or the lobby's two-column layout. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Top bar: "Party lobby" acts as a navbar title on the LEFT in the
            lobby (annotation D); connection status on the RIGHT. The
            party-sounds toggle and End party button were removed per beta
            feedback — the TV is a display surface; ending the party lives in
            the phone Controls tab. The persisted sounds-mute default is
            still honored, there's just no TV control for it. */}
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-center">
            {!hasCurrentItem && (
              <h1
                data-testid="room-lobby-heading"
                className="tv-title-sm uppercase tracking-[0.12em] text-muted-foreground"
              >
                {t("lobby.heading")}
              </h1>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ConnectionStatusPill status={connectionStatus} />
          </div>
        </div>

        {/* Playing video — the single largest element on the TV. `fill`
            letterboxes it against the black surface so it's as big as the
            leftover height allows, never overflowing the viewport. Kept
            mounted, hidden in the lobby (see MAIN column comment). */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-3",
            !hasCurrentItem && "hidden"
          )}
        >
          <div className="shrink-0">
            <NowSingingBanner
              currentItem={playback?.currentItem ?? null}
              size="tv"
            />
          </div>
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

        {/* Lobby — two-column layout that fits a 1920x1080 TV with zero page
            scroll. LEFT = QR hero, stretched to the full column height so it
            matches the right column (annotation B). RIGHT = participants
            board (~1/3 height, annotation A) over the queue panel (fills the
            rest and always renders, annotation E). `min-h-0` on every nested
            flex/grid child is required so panels become their own scroll
            regions instead of growing past the viewport. Below `lg` (host
            previewing on a laptop) it stacks and the lobby scrolls. */}
        {!hasCurrentItem && (
          <div
            data-testid="room-lobby"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden"
          >
            <div className="mx-auto grid min-h-0 w-full max-w-[1700px] flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(420px,540px)_1fr]">
              {/* LEFT: QR hero, filling the full column height. */}
              <div className="flex min-h-0">
                <JoinPanel joinUrl={joinUrl} code={code} size="lg" />
              </div>

              {/* RIGHT: participants (top, ~1/3) + queue (below, fills). */}
              <div className="flex min-h-0 flex-col gap-5">
                <div
                  data-testid="room-lobby-roster-panel"
                  className="flex h-1/3 min-h-0 shrink-0 overflow-hidden rounded-3xl border border-border/70 bg-card/40"
                >
                  <RosterStrip roster={roster} />
                </div>

                <div
                  data-testid="room-lobby-queue"
                  className="flex min-h-0 flex-1 flex-col rounded-3xl border border-border/70 bg-card/40 p-6"
                >
                  <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
                    <h2 className="tv-title-sm flex items-center gap-2 text-foreground">
                      <IconPlaylist className="size-6 text-primary" />
                      {t("queue.title")}
                    </h2>
                    {queue.length > 0 && (
                      <Badge
                        variant="secondary"
                        data-testid="room-lobby-queue-count"
                        className="px-3 py-1 text-base font-semibold uppercase tracking-[0.04em]"
                      >
                        {t("queue.count", { count: queue.length })}
                      </Badge>
                    )}
                  </div>

                  {queue.length === 0 ? (
                    // Empty state — the queue panel renders even before any
                    // song is added (annotation E) so the lobby's right
                    // column reads as "participants + queue" from the start.
                    <div
                      data-testid="room-lobby-queue-empty"
                      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center"
                    >
                      <span
                        aria-hidden
                        className="flex size-16 items-center justify-center rounded-full border border-border/60 bg-muted/40"
                      >
                        <IconMusic className="size-8 text-muted-foreground/60" />
                      </span>
                      <p className="tv-body max-w-sm text-muted-foreground">
                        {t("queue.empty")}
                      </p>
                    </div>
                  ) : (
                    <ul
                      data-testid="room-lobby-queue-summary"
                      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
                    >
                      {queue.map((item) => (
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
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT RAIL — playing state only, spanning the full viewport height
          (annotation H): a sibling of MAIN so it runs from the top of the
          tv-safe content area to the bottom (top-aligned above the title),
          rather than starting below the top bar. Participants on top, the
          queue filling the flex-1 middle with its own scroll, the join QR
          pinned at the bottom so guests can keep scanning mid-session. Kept
          mounted, hidden in the lobby.

          Widened 280 -> 336px and pulled flush to the screen edge: the root
          `tv-safe` padding-inline (--tv-safe-inline, 80px at 1920) left a
          dead right margin, so a negative right margin cancels that padding
          down to a 4px gap (beta feedback). Referencing the custom property
          keeps this in lockstep with the tv-safe token in app.css — the gap
          holds at every viewport width and survives future token edits. */}
      <div
        data-testid="room-playing-rail"
        className={cn(
          "flex min-h-0 w-full shrink-0 flex-col gap-4 border-t border-border pt-4 lg:w-[336px] lg:-mr-[calc(var(--tv-safe-inline)_-_4px)] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0",
          !hasCurrentItem && "hidden"
        )}
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

        <div data-testid="room-playing-join" className="shrink-0">
          <JoinPanel joinUrl={joinUrl} code={code} size="sm" className="w-full" />
        </div>
      </div>

      <CelebrationBurst
        show={showCelebration}
        onDone={() => setShowCelebration(false)}
      />
      <NowUpOverlay singer={nowUpSinger} />
      <ReactionOverlay ref={reactionOverlayRef} variant="tv" />
      <ReactionRecap recap={recap} onDone={handleRecapDone} />
    </div>
  );
}
