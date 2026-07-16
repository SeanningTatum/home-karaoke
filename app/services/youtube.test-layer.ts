import { Layer } from "effect";
import { YouTube, type YouTubeShape } from "./youtube";

/**
 * Test layer mirror (see `database.test-layer.ts`) — lets callers (tRPC
 * route tests, future consumers) swap in a stub `YouTube` shape without
 * going through `YouTubeLive`'s `CloudflareEnv` + `fetch` plumbing.
 */
export const makeTestYouTube = (
  stub: Partial<YouTubeShape>
): Layer.Layer<YouTube> => Layer.succeed(YouTube, stub as YouTubeShape);
