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
  IconBrandGithub,
  IconSearch,
  IconAdjustments,
  IconMoodSmile,
  IconUserCircle,
  IconRefresh,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { redirectIfAuthenticated } from "@/lib/session";
import { cn } from "@/lib/utils";
import { normalizeRoomCodeInput, isCompleteRoomCode } from "@/lib/room-code";

const GITHUB_URL = "https://github.com/SeanningTatum/home-karaoke";

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
  return (
    <div className="bg-stagelight flex min-h-svh flex-col">
      <NavBar />
      <main className="flex flex-1 flex-col">
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}

function NavBar() {
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("common");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          <IconMicrophone2 className="size-3.5 text-primary" />
          {tc("app_name")}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="hover:text-foreground">
            {t("nav.how_it_works")}
          </a>
          <a href="#features" className="hover:text-foreground">
            {t("nav.features")}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" data-testid="hero-host-cta">
            <Link to="/login">
              <IconDeviceTv className="size-4" />
              {t("host_cta")}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t } = useTranslation("home");

  return (
    <section className="relative isolate overflow-hidden">
      {/* Soft spotlight behind the headline — decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/4 -z-10 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary opacity-10 blur-3xl"
      />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:py-20 lg:grid-cols-[6fr_5fr] lg:px-8">
        <div className="flex flex-col items-start gap-6 text-left">
          <h1 className="animate-hero-in motion-reduce:animate-none text-balance font-display text-5xl font-semibold sm:text-6xl">
            {t("hero.headline")}
          </h1>
          <p className="max-w-md text-balance text-base text-muted-foreground sm:text-lg">
            {t("hero.subline")}
          </p>
          <JoinRoomCard />
        </div>

        {/* Real product capture in a TV-style frame — no illustration, the
            actual playing screen (re-captured whenever the TV layout
            changes; see HowItWorks). */}
        <div aria-hidden="true" className="relative hidden lg:block">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-2xl">
            <img
              src="/marketing/step-tv-playing.png"
              alt=""
              loading="eager"
              className="aspect-video w-full rounded-lg object-cover object-top"
            />
          </div>
          <p className="code-marquee mt-4 text-center text-sm text-muted-foreground">
            KQ7-3FP
          </p>
        </div>
      </div>
    </section>
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

  // Real product captures (public/marketing/, from the feat-012 verification
  // walk) instead of icon cards — re-capture after any future TV/phone
  // redesign so the landing never shows a stale UI. Decorative (alt=""):
  // each card's title/body carries the information.
  const steps = [
    { icon: IconDeviceTv, image: "/marketing/step-tv-lobby.png", key: "step_1" },
    { icon: IconQrcode, image: "/marketing/step-phone-add.png", key: "step_2" },
    { icon: IconPlaylistAdd, image: "/marketing/step-tv-playing.png", key: "step_3" },
  ] as const;

  return (
    <section
      id="how-it-works"
      className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col items-center gap-8 px-4 py-16 lg:px-8"
    >
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {t("how_it_works.title")}
      </h2>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map(({ icon: Icon, image, key }) => (
          <div
            key={key}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-center"
          >
            <img
              src={image}
              alt=""
              loading="lazy"
              className="aspect-video w-full border-b border-border/60 object-cover object-top"
            />
            <div className="flex flex-col items-center gap-2 px-4 py-5">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="size-4 text-primary" />
                {t(`how_it_works.${key}.title`)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(`how_it_works.${key}.body`)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  const { t } = useTranslation("home");

  // Every card is a shipped feature — no roadmap items on the landing page.
  const features = [
    { key: "live_queue", icon: IconRefresh },
    { key: "no_app", icon: IconQrcode },
    { key: "search", icon: IconSearch },
    { key: "host_controls", icon: IconAdjustments },
    { key: "reactions", icon: IconMoodSmile },
    { key: "avatars", icon: IconUserCircle },
  ] as const;

  return (
    <section
      id="features"
      className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col items-center gap-8 px-4 py-16 lg:px-8"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {t("features.eyebrow")}
        </h2>
        <p className="text-balance font-display text-3xl font-semibold sm:text-4xl">
          {t("features.title")}
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-6 text-left"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon className="size-5" />
            </span>
            <p className="font-medium text-foreground">
              {t(`features.items.${key}.title`)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`features.items.${key}.body`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  const { t } = useTranslation("home");

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 lg:px-8">
      <div className="bg-stagelight relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-border/70 px-6 py-14 text-center">
        <p
          aria-hidden="true"
          className="font-display border-brass/60 w-fit border-b-2 pb-1 text-3xl font-semibold tracking-[0.08em] text-foreground"
        >
          KQ7-3FP
        </p>
        <h2 className="text-balance font-display text-3xl font-semibold sm:text-4xl">
          {t("cta.title")}
        </h2>
        <p className="max-w-md text-balance text-muted-foreground">
          {t("cta.subline")}
        </p>
        <Button asChild size="lg" data-testid="landing-cta-host">
          <Link to="/login">
            <IconDeviceTv className="size-4" />
            {t("cta.button")}
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("common");

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row lg:px-8">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <IconMicrophone2 className="size-3.5 text-primary" />
          {tc("app_name")}
        </span>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
            data-testid="footer-github"
          >
            <IconBrandGithub className="size-4" />
            {t("footer.github")}
          </a>
          <Link to="/login" className="hover:text-foreground">
            {t("footer.sign_in")}
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground/70">{t("footer.note")}</p>
      </div>
    </footer>
  );
}
