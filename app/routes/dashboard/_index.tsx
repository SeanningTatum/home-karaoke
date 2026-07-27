import { useTranslation } from "react-i18next";
import { useOutletContext, Link, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  IconLayoutDashboard,
  IconMicrophone,
  IconMicrophone2,
  IconLoader2,
  IconArrowRight,
  IconMusic,
  IconSparkles,
  IconUsersGroup,
  IconDeviceTv,
  IconHeart,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/trpc/client";
import { cn } from "@/lib/utils";

export const handle = { i18n: ["dashboard"] };

export default function DashboardIndex() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: { name: string; role?: string | null } }>();
  const isAdmin = user.role === "admin";

  const createRoom = api.room.create.useMutation({
    onSuccess: (room) => navigate(`/room/${room.code}`),
    onError: (error) => toast.error(error.message ?? t("host_room.error")),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-6 lg:px-8">
      {/* Slim top bar — wordmark left; account/role, admin, locale, theme
          right. The old "Your session" card folds into the role chip here
          (`dashboard-account` testid preserved for the e2e auth spec). */}
      <header className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <IconMicrophone2 className="size-3.5 text-primary" />
          {tc("app_name")}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="dashboard-account"
            className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground sm:inline-flex"
          >
            {user.name}
            <span className="text-muted-foreground/60">·</span>
            {isAdmin ? t("account.role_admin") : t("account.role_user")}
          </span>
          {isAdmin && (
            <Button asChild variant="outline" size="sm" data-testid="dashboard-go-admin">
              <Link to="/admin">
                <IconLayoutDashboard className="size-4" />
                {t("actions.open_admin")}
              </Link>
            </Button>
          )}
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
      </header>

      {/* Stage hero — the one dominant action. */}
      <section
        data-testid="dashboard-host-room"
        className="bg-stagelight relative isolate overflow-hidden rounded-3xl border border-border/70 px-6 py-14 text-center sm:py-16"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <IconSparkles className="size-3" />
            {t("eyebrow")}
          </span>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            {t("welcome", { name: user.name })}
          </h1>
          <p className="max-w-md text-balance text-muted-foreground">
            {t("host_room.description")}
          </p>
          <Button
            size="lg"
            data-testid="dashboard-host-room-button"
            disabled={createRoom.isPending}
            onClick={() => createRoom.mutate({})}
          >
            {createRoom.isPending ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconMicrophone className="size-4" />
            )}
            {t("host_room.cta")}
          </Button>
        </div>
      </section>

      <PreviousSessionsRail />
      <FeaturedPlaylistsRail />
    </div>
  );
}

function PreviousSessionsRail() {
  const { t, i18n } = useTranslation("dashboard");
  const sessions = api.room.listMine.useQuery();

  const formatDate = (value: string | Date) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: "short",
      day: "numeric",
    }).format(new Date(value));

  return (
    <section data-testid="dashboard-sessions" className="flex flex-col gap-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {t("sessions.title")}
      </h2>

      {sessions.isPending ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-56 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : sessions.isError || sessions.data.length === 0 ? (
        // Query failure degrades to the same quiet empty state — the rail
        // must never block the Start-a-party hero above it.
        <div
          data-testid="dashboard-sessions-empty"
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted/40">
            <IconDeviceTv className="size-6 text-muted-foreground/60" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("sessions.empty")}
          </p>
        </div>
      ) : (
        <ul className="flex gap-4 overflow-x-auto pb-2">
          {sessions.data.map((room) => {
            const isLive = room.status === "open";
            return (
              <li
                key={room.id}
                data-testid="dashboard-session-card"
                className={cn(
                  "flex w-56 shrink-0 flex-col gap-3 rounded-2xl border bg-card/70 p-5",
                  isLive ? "border-primary/50" : "border-border/70"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(room.createdAt)}
                  </span>
                  {isLive && (
                    <Badge className="px-2 py-0.5 text-[10px] uppercase tracking-wider">
                      {t("sessions.live")}
                    </Badge>
                  )}
                </div>
                <span className="code-marquee text-2xl text-foreground">
                  {room.code}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <IconMusic className="size-4" />
                  {t("sessions.songs", { count: room.songCount })}
                </span>
                {isLive && (
                  <Button asChild variant="outline" size="sm" className="mt-1 w-fit">
                    <Link to={`/room/${room.code}`}>
                      {t("sessions.rejoin")}
                      <IconArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Queue-ahead playlists are a future feature (plan decision 4): this rail is
 * a deliberate, visible placeholder — curated static cards, non-interactive,
 * honest about it via the coming-soon badge. Shipping the real feature later
 * means wiring these cards up and deleting the badge, not redesigning the
 * dashboard.
 */
function FeaturedPlaylistsRail() {
  const { t } = useTranslation("dashboard");

  const playlists = [
    { key: "throwbacks", icon: IconSparkles },
    { key: "duets", icon: IconUsersGroup },
    { key: "opm", icon: IconHeart },
    { key: "crowd_pleasers", icon: IconMicrophone },
  ] as const;

  return (
    <section data-testid="dashboard-playlists" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {t("playlists.title")}
        </h2>
        <Badge variant="secondary" className="px-2 py-0.5 text-[10px] uppercase tracking-wider">
          {t("playlists.coming_soon")}
        </Badge>
      </div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {playlists.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/50 p-5"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-display text-lg font-semibold text-foreground">
                {t(`playlists.items.${key}.title`)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(`playlists.items.${key}.body`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
