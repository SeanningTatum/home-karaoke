import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import { ThemeProvider } from "next-themes";

import type { Route } from "./+types/root";
import "./app.css";
import { TRPCProvider } from "./trpc/client";
import { useTranslation } from "react-i18next";
import { useChangeLanguage } from "remix-i18next/react";
import { i18nServer } from "./i18n/i18n.server";
import { Toaster } from "@/components/ui/sonner";

export const handle = { i18n: ["common"] };

// Fonts (Inter + Bricolage Grotesque) are self-hosted via @fontsource and
// bundled through app.css — no runtime Google Fonts CDN dependency (this is
// a Cloudflare Workers app). See design.md §Typography.
export const links: Route.LinksFunction = () => [];

export async function loader({ request }: Route.LoaderArgs) {
  const locale = await i18nServer.getLocale(request);
  return { locale };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const loaderData = useRouteLoaderData("root") as
    | { locale: string }
    | undefined;
  const locale = loaderData?.locale ?? "en";

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  useChangeLanguage(loaderData.locale);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TRPCProvider>
        <Outlet />
        <Toaster />
      </TRPCProvider>
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation("common");

  let message = t("errors.oops");
  let details = t("errors.unexpected");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? t("errors.404") : t("errors.error");
    details =
      error.status === 404
        ? t("errors.not_found")
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
