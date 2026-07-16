import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { IconLoader2, IconMicrophone } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { authClient } from "@/auth/client";
import { effectResolver } from "@/lib/effect-form";
import { JoinNicknameInput } from "@/lib/schemas/room";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const NICKNAME_STORAGE_KEY = "karaoke-nickname";

export interface NicknameFormProps {
  /** True when the visitor already has a Better Auth session (host, or a
   * returning guest whose anonymous session cookie is still valid) — skips
   * `signIn.anonymous()` since a session already exists. */
  readonly hasSession: boolean;
  /** The existing session's user id (from the loader) — reused verbatim
   * when `hasSession` is true instead of re-resolving it. */
  readonly userId: string | null;
  readonly onJoined: (nickname: string, userId: string | null) => void;
}

/**
 * First step of `/join/:code` — collects a nickname, ensures an (anonymous,
 * if needed) session exists, then hands control back to the route to render
 * the room view. Always rendered on first paint (server can't read
 * localStorage), and pre-fills from `localStorage["karaoke-nickname"]`
 * once mounted client-side.
 */
export function NicknameForm({ hasSession, userId, onJoined }: NicknameFormProps) {
  const { t } = useTranslation("room");
  const [joinError, setJoinError] = useState<string>();

  const form = useForm<JoinNicknameInput>({
    resolver: effectResolver(JoinNicknameInput),
    defaultValues: { nickname: "" },
  });

  // SSR can't read localStorage, so the field always starts empty on first
  // paint (server + initial client render match); once mounted, prefill
  // from a previous visit so a returning guest just hits submit.
  useEffect(() => {
    const stored = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (stored) form.setValue("nickname", stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: JoinNicknameInput) {
    setJoinError(undefined);
    try {
      let resolvedUserId = userId;
      if (!hasSession) {
        const result = await authClient.signIn.anonymous();
        if (result.error) {
          setJoinError(result.error.message ?? t("join.nickname.error_session"));
          return;
        }
        resolvedUserId = result.data?.user?.id ?? null;
        // Best-effort — the nickname is always passed via the WS `?nickname=`
        // query param regardless, so a failure here doesn't block joining.
        try {
          await authClient.updateUser({ name: data.nickname });
        } catch {
          // ignore — see comment above
        }
      }
      window.localStorage.setItem(NICKNAME_STORAGE_KEY, data.nickname);
      onJoined(data.nickname, resolvedUserId);
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : t("join.nickname.error_session")
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card
        data-testid="join-nickname-card"
        className={cn("w-full max-w-sm border-border/80 shadow-sm")}
      >
        <CardHeader className="gap-2">
          <span className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground">
            <IconMicrophone className="size-5" />
          </span>
          <CardTitle className="text-xl">
            {t("join.nickname.title")}
          </CardTitle>
          <CardDescription>{t("join.nickname.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
              data-testid="join-nickname-form"
            >
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("join.nickname.label")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        autoFocus
                        placeholder={t("join.nickname.placeholder")}
                        data-testid="join-nickname-input"
                        {...field}
                        disabled={form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage data-testid="join-nickname-error" />
                  </FormItem>
                )}
              />
              {joinError && (
                <div
                  role="alert"
                  data-testid="join-nickname-session-error"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {joinError}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                data-testid="join-nickname-submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <IconLoader2 className="size-4 animate-spin" />
                    {t("join.nickname.submitting")}
                  </>
                ) : (
                  t("join.nickname.submit")
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
