import { useEffect, useState } from "react";
import { Link, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { Effect, Schema } from "effect";
import { IconArrowLeft } from "@tabler/icons-react";

import { RoomCode } from "@/lib/schemas/room";
import { RoomRepository } from "@/repositories/room";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionStatusPill } from "@/components/room/connection-status-pill";
import { NicknameForm } from "@/components/join/nickname-form";
import { SearchTab } from "@/components/join/search-tab";
import { QueueTab } from "@/components/join/queue-tab";
import { ControlsTab } from "@/components/join/controls-tab";
import { PositionBar } from "@/components/join/position-bar";
import type { Route } from "./+types/$code";

export const handle = { i18n: ["room"] };

// Public loader — no `requireSession`. Guests reach this URL from a QR scan
// with no session at all yet; the host can also land here (per spec, sees
// the same search/queue tabs). Bad/stale/malformed codes and closed rooms
// get the same friendly non-crash treatment as the host route.
export async function loader({ request, context, params }: Route.LoaderArgs) {
  const code = params.code;

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

  if (room.status === "closed") {
    return { status: "closed" as const, code };
  }

  // A missing session is expected here (unlike `requireSession`'s
  // protected routes) — read it directly rather than redirecting.
  const session = await context.auth.api.getSession({
    headers: request.headers,
  });

  return {
    status: "ok" as const,
    code,
    roomId: room.id,
    // Derived server-side — never ship the host's internal user id to the
    // client. The host reaches /join/:code with their real account session
    // already resolved (they must be signed in to have created the room),
    // so comparing here is sufficient; guests get an anonymous id that can
    // never equal the host's. `isHost` only gates the Controls tab as a UX
    // affordance — the DO's `canPerform` is the real enforcement.
    isHost: Boolean(session) && session?.user.id === room.hostUserId,
    hasSession: Boolean(session),
    userId: session?.user.id ?? null,
  };
}

export default function JoinRoute({ loaderData }: Route.ComponentProps) {
  if (loaderData.status !== "ok") {
    return (
      <JoinUnavailable status={loaderData.status} code={loaderData.code} />
    );
  }
  return <JoinFlow {...loaderData} />;
}

function JoinUnavailable({
  status,
  code,
}: {
  status: "not_found" | "closed";
  code: string;
}) {
  const { t } = useTranslation("room");

  return (
    <div
      data-testid="join-unavailable"
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
      <Button asChild variant="outline" data-testid="join-back-to-home">
        <Link to="/">
          <IconArrowLeft className="size-4" />
          {t("state.back_to_home")}
        </Link>
      </Button>
    </div>
  );
}

interface JoinFlowProps {
  readonly code: string;
  readonly roomId: string;
  readonly isHost: boolean;
  readonly hasSession: boolean;
  readonly userId: string | null;
}

/**
 * Gates between the nickname step and the room view. Always starts on the
 * nickname step (SSR can't read localStorage — `NicknameForm` prefills it
 * client-side once mounted) and flips to the room view once the visitor
 * has a confirmed nickname + session.
 */
function JoinFlow({ code, roomId, isHost, hasSession, userId }: JoinFlowProps) {
  const [joined, setJoined] = useState<{
    nickname: string;
    userId: string | null;
  } | null>(null);

  if (!joined) {
    return (
      <NicknameForm
        hasSession={hasSession}
        userId={userId}
        onJoined={(nickname, resolvedUserId) =>
          setJoined({ nickname, userId: resolvedUserId })
        }
      />
    );
  }

  return (
    <JoinRoomView
      code={code}
      roomId={roomId}
      isHost={isHost}
      nickname={joined.nickname}
      ownUserId={joined.userId}
    />
  );
}

interface JoinRoomViewProps {
  readonly code: string;
  readonly roomId: string;
  readonly isHost: boolean;
  readonly nickname: string;
  readonly ownUserId: string | null;
}

function JoinRoomView({
  code,
  roomId,
  isHost,
  nickname,
  ownUserId,
}: JoinRoomViewProps) {
  const { t } = useTranslation("room");
  const [activeTab, setActiveTab] = useState<"search" | "queue" | "controls">(
    "search"
  );
  const { state, send, connectionStatus, roomClosed } = useRoomSocket({
    code,
    nickname,
  });

  // Host ended the party — the DO broadcast `room.closed`. Re-run the
  // loader so this route renders the friendly closed state instead of a
  // stale live queue.
  const revalidator = useRevalidator();
  useEffect(() => {
    if (roomClosed) void revalidator.revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomClosed]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-background p-4 text-foreground">
      <header className="flex items-center justify-between gap-3">
        <span
          data-testid="join-room-code"
          className="font-mono text-lg font-bold tracking-wider"
        >
          {code}
        </span>
        <ConnectionStatusPill status={connectionStatus} />
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "search" | "queue" | "controls")
        }
        data-testid="join-tabs"
      >
        <TabsList className="w-full">
          <TabsTrigger
            value="search"
            className="flex-1"
            data-testid="join-tab-search"
          >
            {t("join.tabs.search")}
          </TabsTrigger>
          <TabsTrigger
            value="queue"
            className="flex-1"
            data-testid="join-tab-queue"
          >
            {t("join.tabs.queue")}
          </TabsTrigger>
          {isHost && (
            <TabsTrigger
              value="controls"
              className="flex-1"
              data-testid="join-tab-controls"
            >
              {t("join.tabs.controls")}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="search">
          <SearchTab
            roomId={roomId}
            send={send}
            queueLength={state.queue.length}
            onQueued={() => setActiveTab("queue")}
          />
        </TabsContent>
        <TabsContent value="queue">
          <QueueTab
            queue={state.queue}
            playback={state.playback}
            ownUserId={ownUserId}
            allowGuestReorder={state.settings?.allowGuestReorder ?? false}
            send={send}
          />
        </TabsContent>
        {isHost && (
          <TabsContent value="controls">
            <ControlsTab
              roomId={roomId}
              queue={state.queue}
              playback={state.playback}
              settings={state.settings}
              send={send}
            />
          </TabsContent>
        )}
      </Tabs>

      <PositionBar queue={state.queue} ownUserId={ownUserId} />
    </div>
  );
}
