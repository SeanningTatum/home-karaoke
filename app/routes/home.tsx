import { useState } from "react";
import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  IconArrowRight,
  IconMicrophone2,
  IconDeviceTv,
  IconQrcode,
  IconPlaylistAdd,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { redirectIfAuthenticated } from "@/lib/session";
import { cn } from "@/lib/utils";
import { normalizeRoomCodeInput, isCompleteRoomCode } from "@/lib/room-code";

export const handle = { i18n: ["home"] };

export function meta(_: Route.MetaArgs) {
  const title = "Home Karaoke — sing together";
  const description =
    "Start a karaoke room, share the code, and sing together — no app to install, just open the link on your phone.";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  await redirectIfAuthenticated(request, context);
  return null;
}

export default function Home() {
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("common");

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flex items-center justify-between gap-1 p-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <IconMicrophone2 className="size-3.5 text-primary" />
          {tc("app_name")}
        </span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
      </div>

      <main className="relative isolate flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        {/* Soft gradient glow behind the hero wordmark — decorative only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/4 left-1/2 -z-10 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-accent opacity-15 blur-3xl"
        />

        <div className="flex max-w-2xl flex-col items-center gap-5">
          <h1 className="text-balance font-display text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {t("hero.headline")}
          </h1>
          <p className="max-w-md text-balance text-base text-muted-foreground sm:text-lg">
            {t("hero.subline")}
          </p>
        </div>

        <JoinRoomCard />

        <Button
          asChild
          variant="outline"
          size="lg"
          data-testid="hero-host-cta"
        >
          <Link to="/login">
            <IconDeviceTv className="size-4" />
            {t("host_cta")}
          </Link>
        </Button>

        <HowItWorks />
      </main>
    </div>
  );
}

function JoinRoomCard() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCompleteRoomCode(code)) {
      setError(t("join.error_incomplete"));
      return;
    }
    setError(null);
    navigate(`/join/${code}`);
  };

  return (
    <Card className="w-full max-w-sm" data-testid="landing-join-card">
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3"
          noValidate
        >
          <label
            htmlFor="landing-code-input"
            className="text-left text-sm font-medium text-foreground"
          >
            {t("join.label")}
          </label>
          <Input
            id="landing-code-input"
            data-testid="landing-code-input"
            value={code}
            onChange={(event) => {
              setCode(normalizeRoomCodeInput(event.target.value));
              if (error) setError(null);
            }}
            placeholder={t("join.code_placeholder")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "landing-code-error" : undefined}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={7}
            className={cn(
              "h-14 text-center font-mono text-xl tracking-[0.3em] uppercase"
            )}
          />
          {error && (
            <p
              id="landing-code-error"
              data-testid="landing-code-error"
              className="text-left text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            data-testid="landing-join-button"
            className="bg-gradient-accent text-primary-foreground shadow-glow-accent hover:opacity-90"
          >
            {t("join.submit")}
            <IconArrowRight className="ml-1 size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function HowItWorks() {
  const { t } = useTranslation("home");

  const steps = [
    { icon: IconDeviceTv, key: "step_1" },
    { icon: IconQrcode, key: "step_2" },
    { icon: IconPlaylistAdd, key: "step_3" },
  ] as const;

  return (
    <section className="flex w-full max-w-3xl flex-col items-center gap-6 pt-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {t("how_it_works.title")}
      </h2>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map(({ icon: Icon, key }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-center"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
              <Icon className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
              {t(`how_it_works.${key}.title`)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`how_it_works.${key}.body`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
