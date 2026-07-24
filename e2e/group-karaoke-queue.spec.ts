import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration";

/**
 * Group-karaoke add-to-queue golden path — the flow the "can't be used"
 * Sing King bug lived in (app/trpc/routes/youtube.ts `resolveVideo`).
 *
 *   1. Host signs up → dashboard → opens a room (big-screen `/room/:code`).
 *   2. A guest (separate anonymous browser context) joins `/join/:code`.
 *   3. Guest pastes a YouTube link → the video resolves and is queued.
 *   4. The host's big screen picks up the new song over the live WebSocket.
 *
 * The embeddability-flag regression itself is guarded deterministically (no
 * network) by app/trpc/routes/__tests__/youtube.test.ts — this spec proves the
 * whole add-to-queue path works end to end. It uses the paste-a-link flow,
 * which resolves via YouTube's keyless oEmbed endpoint, so it needs no
 * `YOUTUBE_API_KEY` (unset in local/CI dev) but does reach youtube.com.
 */
test.describe("Group karaoke — add to queue", () => {
  const email = `karaoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
  const password = "E2EPass123!";
  // A stable, long-lived public video — its oEmbed metadata won't disappear.
  const videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  test("host opens a room, guest pastes a link, song syncs to both", async ({
    page,
    browser,
  }) => {
    // 1. Host signs up and lands on the dashboard.
    await page.goto("/sign-up");
    // SSR'd form — wait for React before clicking. See e2e/helpers/hydration.ts.
    await waitForHydration(page, '[data-testid="signup-submit"]');
    // Wait for the client bundle to finish loading so the form is hydrated —
    // otherwise a fast fill+submit fires the native GET before react-hook-form
    // attaches its preventDefault handler. (No WebSocket on this page, so
    // networkidle is reachable.)
    await page.waitForLoadState("networkidle");
    await page.fill('[data-testid="signup-name"]', "E2E Host");
    await page.fill('[data-testid="signup-email"]', email);
    await page.fill('[data-testid="signup-password"]', password);
    await page.fill('[data-testid="signup-confirm-password"]', password);
    await page.click('[data-testid="signup-submit"]');
    await page.waitForURL("/dashboard");

    // 2. Host opens a room and we capture the join code from the URL.
    await page.click('[data-testid="dashboard-host-room-button"]');
    await page.waitForURL(/\/room\/[A-Z0-9-]+$/);
    const code = page.url().split("/room/")[1];
    expect(code).toBeTruthy();

    // 3. Guest joins in a fresh (anonymous) context — a different session
    //    from the host, exactly like a phone scanning the QR.
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(`/join/${code}`);
    await waitForHydration(guest, '[data-testid="join-nickname-submit"]');
    // Same hydration guard before the first interaction (the room WebSocket
    // only opens after joining, so the nickname step still reaches idle).
    await guest.waitForLoadState("networkidle");
    await guest.fill('[data-testid="join-nickname-input"]', "E2E Guest");
    await guest.click('[data-testid="join-nickname-submit"]');
    await expect(guest.getByTestId("join-search-tab")).toBeVisible();

    // 4. Guest pastes a YouTube link and adds it.
    await guest.click('[data-testid="join-search-paste-toggle"]');
    await guest.fill('[data-testid="join-paste-url-input"]', videoUrl);
    await guest.click('[data-testid="join-paste-url-submit"]');

    // 5. The song lands in the guest's queue (the paste form auto-switches to
    //    the Queue tab on success).
    await expect(guest.getByTestId("room-queue-item").first()).toBeVisible({
      timeout: 15_000,
    });

    // 6. The host's big screen receives the same song over the WebSocket.
    //    Assert on the queue count rather than the item element: the host rail
    //    renders a second, hidden `room-queue-item` in its isolated drag
    //    column, so an item-visibility check is ambiguous — the count is not.
    await expect(page.getByTestId("room-queue-count")).toContainText("1", {
      timeout: 15_000,
    });

    await guestContext.close();
  });
});
