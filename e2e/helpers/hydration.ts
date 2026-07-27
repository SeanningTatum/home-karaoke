import type { Page } from "@playwright/test";

/**
 * Waits until React has hydrated the element at `selector`.
 *
 * Why this exists: these forms are server-rendered, so the markup (and its
 * native `<form>` submit behavior) exists before the client bundle attaches
 * handlers. A `page.click()` that lands in that window submits the form as a
 * plain GET — the browser navigates to `/sign-up?email=…&password=…`, the SPA
 * route never runs, and the spec times out waiting for `/dashboard` with the
 * credentials sitting in the URL. That was an intermittent failure in both
 * auth specs, unrelated to any app change.
 *
 * The signal is React's own doing: on hydration React stores its internal
 * props on the DOM node under a `__reactProps$<random>` key. Polling for that
 * key is deterministic — it flips exactly when the node becomes interactive —
 * unlike a fixed `waitForTimeout`, which is either flaky or slow.
 */
export const waitForHydration = async (
  page: Page,
  selector: string
): Promise<void> => {
  await page.waitForSelector(selector, { state: "attached" });
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;
      return Object.keys(element).some((key) =>
        key.startsWith("__reactProps$")
      );
    },
    selector,
    { timeout: 15_000 }
  );
};
