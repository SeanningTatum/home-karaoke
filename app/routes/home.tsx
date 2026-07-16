import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { IconArrowRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { redirectIfAuthenticated } from "@/lib/session";

export const handle = { i18n: ["home"] };

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Home Karaoke — sing together" },
    {
      name: "description",
      content:
        "Start a karaoke room, share the code, and sing together — no app to install, just open the link on your phone.",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  await redirectIfAuthenticated(request, context);
  return null;
}

export default function Home() {
  const { t } = useTranslation("home");

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flex items-center justify-end gap-1 p-4">
        <LanguageSwitcher compact />
        <ThemeToggle />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-24 text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
          {t("brand")}
        </h1>

        <p className="max-w-md text-balance text-base text-muted-foreground sm:text-lg">
          {t("tagline")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" data-testid="hero-sign-up">
            <Link to="/sign-up">
              {t("cta_sign_up")}
              <IconArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" data-testid="hero-sign-in">
            <Link to="/login">{t("cta_sign_in")}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
