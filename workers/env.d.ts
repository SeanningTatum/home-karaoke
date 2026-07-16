// Secrets aren't declared in wrangler.jsonc, so `wrangler types` only picks
// them up from local .dev.vars/.env files — which don't exist on a fresh
// clone or CI runner. Declare them here (interface merging with the
// generated Env) so typecheck doesn't depend on local secret files.
interface Env {
  BETTER_AUTH_SECRET: string;
  // YouTube Data API v3 key. Optional by design — `YouTubeLive` degrades
  // gracefully when unset: `search` fails with a `ConfigurationError`
  // (client falls back to the always-available paste-a-link flow) and
  // `getVideo` falls back to the keyless YouTube oEmbed endpoint (no
  // `embeddable`/`duration` metadata, but title/author/thumbnail still
  // resolve). Set via `wrangler secret put YOUTUBE_API_KEY` in prod, local
  // `.dev.vars` for dev.
  YOUTUBE_API_KEY?: string;
}
