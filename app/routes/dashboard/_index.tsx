import { useTranslation } from "react-i18next";
import { useOutletContext, Link, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  IconLayoutDashboard,
  IconSparkles,
  IconMicrophone,
  IconLoader2,
} from "@tabler/icons-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/trpc/client";

export const handle = { i18n: ["dashboard"] };

export default function DashboardIndex() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: { name: string; role?: string | null } }>();
  const isAdmin = user.role === "admin";

  const createRoom = api.room.create.useMutation({
    onSuccess: (room) => navigate(`/room/${room.code}`),
    onError: (error) => toast.error(error.message ?? t("host_room.error")),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 lg:px-6">
      {/* Welcome */}
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <IconSparkles className="size-3" />
            {t("eyebrow")}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("welcome", { name: user.name })}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Host a karaoke room */}
      <section className="mb-12">
        <Card data-testid="dashboard-host-room">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground">
                <IconMicrophone className="size-5" />
              </span>
              <CardTitle className="text-base">
                {t("host_room.title")}
              </CardTitle>
            </div>
            <CardDescription>{t("host_room.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
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
          </CardContent>
        </Card>
      </section>

      {/* Status / your account */}
      <section>
        <Card data-testid="dashboard-account">
          <CardHeader className="gap-2">
            <CardTitle className="text-base">{t("account.title")}</CardTitle>
            <CardDescription>{t("account.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-muted-foreground">
              {isAdmin ? t("account.role_admin") : t("account.role_user")}
            </span>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
