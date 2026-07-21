# Third-Party Integrations

The integrations actually wired into this repo. **Stripe / PostHog / Resend / external AI SDKs are not present** — if a feature needs one, add it explicitly (binding + service Tag + secret) and update this file.

## Cloudflare Services

Bindings declared in [`wrangler.jsonc`](../../wrangler.jsonc) and typed in `worker-configuration.d.ts`. The config is committed with dummy IDs (so `cf-typegen`/CI work on fresh clones); `bun run setup` fills real IDs and provisions both production resources and the `env.preview` environment (`<name>-preview` worker + `-preview` D1/R2 for per-PR preview deployments — see [`../rules/cloudflare.md`](../rules/cloudflare.md) "Environments & preview deployments"):

| Binding | Type | Purpose |
|---------|------|---------|
| `DATABASE` | D1 | SQLite DB via Drizzle |
| `BUCKET` | R2 | Object storage |
| `AI` | Workers AI | Native model inference (binding only — no usage yet) |
| `EXAMPLE_WORKFLOW` | Workflow | Sample CF Workflow class `ExampleWorkflow` |
| `ASSETS` | Assets | Static assets directory |
| `KARAOKE_ROOM` | Durable Object | `KaraokeRoom` — live per-room state (queue/playback/roster) for group-karaoke (feat-007); SQLite storage, WS Hibernation API, 1h idle alarm. `v1` migration, `new_sqlite_classes`. See [`../rules/cloudflare.md`](../rules/cloudflare.md) |
| `YOUTUBE_API_KEY` | secret, optional | YouTube Data API v3 key — see "YouTube Data API v3" below |

Compatibility flags: `nodejs_compat`. Placement: smart.

### D1 (`DATABASE`)

```typescript
// app/services/database.ts
export const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const env = yield* CloudflareEnv;
    if (!env.DATABASE) return yield* Effect.fail(new ConfigurationError({ service: "Database", field: "DATABASE" }));
    return { db: drizzleD1(env.DATABASE, { schema, logger: false }) };
  })
);
```

Repos consume via `const { db } = yield* Database;`. Never instantiate `drizzle()` inside a repo.

### R2 (`BUCKET`)

The `Bucket` Tag exposes the raw `R2Bucket` binding. `BucketRepository` wraps R2 calls in `Effect.tryPromise`:

```typescript
const repo = yield* BucketRepository;
const key = yield* repo.upload(file);    // Effect<string, BucketUploadError>
const obj = yield* repo.get(key);        // Effect<R2ObjectBody | null, BucketGetError>
yield* repo.remove(key);                 // Effect<void, BucketDeleteError>
const list = yield* repo.list({ prefix: "uploads/", limit: 100 }); // Effect<R2Objects, BucketListError>
```

Default key generator: `uploads/<timestamp>-<uuid>`. Tagged errors: `BucketBindingError`, `BucketUploadError`, `BucketGetError`, `BucketNotFoundError`, `BucketDeleteError`, `BucketListError`, `BucketValidationError`. `BucketNotFoundError` is wired in `tagToTRPC` but not raised by any built-in repo method — wrap `get` with `requireFound` to use it. See [`../rules/errors.md`](../rules/errors.md) and [`../rules/services.md`](../rules/services.md).

### Workers AI (`AI`)

Binding present but no consumers yet. To use: yield `CloudflareEnv`, call `env.AI.run(model, input)` inside `Effect.tryPromise` with an `ExternalServiceError` catch.

### Workflows (`EXAMPLE_WORKFLOW`)

Class exported from [`workflows/example.ts`](../../workflows/example.ts) and re-exported from [`workers/app.ts`](../../workers/app.ts). The `Workflows` service Tag exposes a typed `triggerExample(params)` that returns `Effect<WorkflowInstance, WorkflowTriggerError>`. See [`../rules/cloudflare.md`](../rules/cloudflare.md) and [`../rules/services.md`](../rules/services.md).

### Durable Objects (`KARAOKE_ROOM`)

`KaraokeRoom` (raw Durable Object, not `@cloudflare/actors` — that package was spiked and rejected during group-karaoke Phase 2 as immature: 0.0.1-beta.6, opaque persistence model) backs the live state of an open karaoke room: queue, playback (play/pause/current position), roster (connected guests). One instance per room, addressed via `env.KARAOKE_ROOM.idFromName(room.id)`. SQLite storage + the WS Hibernation API keep the room's WebSocket connections cheap to hold open; a 1h sliding idle alarm closes the D1 `room` row and clears live state when nobody's connected. See [`../rules/cloudflare.md`](../rules/cloudflare.md) "Durable Objects (binding side)" and [`../features/group-karaoke/group-karaoke.md`](../features/group-karaoke/group-karaoke.md).

---

## YouTube Data API v3

Backs song search/resolve for group-karaoke (feat-007). Wrapped by the `YouTube` Effect service (`app/services/youtube.ts`), consumed via the `youtube.search` / `youtube.resolveVideo` tRPC procedures — never called directly from a repo or route.

- **`search`** — `search.list`, query biased toward "karaoke" (`withKaraokeBias` in `app/lib/youtube.ts`), followed by a `videos.list?part=status` pass (1 quota unit for the batch) that **filters out videos whose owner disabled embedding** — they can't play in the IFrame (error 150/101), so users never see them as pickable. A D1 7-day cache (`SongRepository.getCachedPicks`, keyed on `search_log.normalizedQuery`, also filtered to `embeddable = true`) is checked before spending API quota on a repeat query.
- **`getVideo`** — `videos.list` for metadata (`embeddable`, `durationSeconds`) when resolving a search pick or a pasted URL/video id.
- **Quota**: YouTube Data API v3's default free-tier project quota is 10,000 units/day; `search.list` costs 100 units — roughly **100 searches/day** before Google returns a `quotaExceeded` 403. The service maps that to `YouTubeQuotaExceededError` (`TOO_MANY_REQUESTS`); any other API/network failure maps to `YouTubeUnavailableError` (`BAD_GATEWAY`). See [`../rules/errors.md`](../rules/errors.md).
- **Key is optional**: `YOUTUBE_API_KEY` is an optional Cloudflare secret (declared ambient in `workers/env.d.ts`, same pattern as `BETTER_AUTH_SECRET` — see [`../rules/cloudflare.md`](../rules/cloudflare.md)). Unset → `search` fails fast with `ConfigurationError` and the guest UI falls back to a "paste a link" input.
- **Keyless oEmbed fallback**: `getVideo` (and therefore `resolveVideo`) falls back to the public YouTube oEmbed endpoint — no key required — when the Data API key is absent or a lookup needs only title/author/thumbnail. oEmbed doesn't return `embeddable`/`duration`, so a paste-a-link video resolved via oEmbed (no key) is treated as playable-until-proven-otherwise and the IFrame player's `onError` (toast + auto-skip) is the last line of defense. With a key, `resolveVideo` rejects `embeddable === false` (`VideoNotEmbeddableError`).

## Client libraries (not CF bindings)

- **`qrcode.react`** — renders the `<QRCodeSVG>` join-code QR panel on the host's `/room/:code` screen (`app/components/room/join-panel.tsx`). Pure client-side SVG generation, no network calls, no binding.
- **`@dnd-kit/{core,sortable,modifiers,utilities}`** — drag-to-reorder on the guest queue tab (`app/components/room/queue-rail.tsx`), gated by `allowGuestReorder` / host role via the pure `canPerform` check in `app/lib/room-state.ts` (UI-level `disabled` is an affordance only — the DO enforces the real check).

---

## Better Auth

Email/password authentication with the `admin` plugin, plus the **`anonymous`** plugin (added for group-karaoke, feat-007) so a guest can join a room and get a real `session`/`user` row (`user.isAnonymous = true`) without signing up — `signIn.anonymous()` on the client, `anonymousClient()` plugin registered in `app/auth/client.ts`. `protectedProcedure` doesn't distinguish anonymous from real users today — see [`security.md`](security.md) "Anonymous guest sessions" for what that does and doesn't gate. Constructed per request through the Effect runtime in `workers/app.ts` — the raw `createAuth(...)` call was replaced by reading the `AuthApi` tag off the runtime (built by `AuthApiLive(baseURL)`, which wraps construction in `Effect.try` → `ExternalServiceError`):

```typescript
const runtime = makeAppRuntime(env, new URL(request.url).origin);
const authExit = await runtime.runPromiseExit(AuthApi);
// Exit.match → controlled 500 on failure; auth reused as context.auth
```

Underneath, `createAuth` (`app/auth/server.ts`) wires the drizzle adapter against D1:

```typescript
betterAuth({
  database: drizzleAdapter(getDb(database), { provider: "sqlite", schema }),
  secret,
  baseURL,
  emailAndPassword: { enabled: true },
  plugins: [admin()],
});
```

Inside Effect, the `AuthApi` Tag exposes the running instance:

```typescript
const { api } = yield* AuthApi;
const session = yield* Effect.promise(() => api.getSession({ headers }));
```

Client SDK:

```typescript
// app/auth/client.ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();

await authClient.signUp.email({ email, password, name });
await authClient.signIn.email({ email, password });
await authClient.signOut();
const { data: session } = authClient.useSession();
```

Required secret: `BETTER_AUTH_SECRET` (set via `bunx wrangler secret put BETTER_AUTH_SECRET`).

---

## i18n stack

remix-i18next + i18next + react-i18next with `/:lng/` URL prefix. Locales live in `app/locales/{lng}/*.json`. See [`../codebase/i18n.md`](../codebase/i18n.md).

---

## Integration checklist

When adding a new integration:

1. Declare any CF binding in `wrangler.jsonc`, run `bun run typecheck` to regen `worker-configuration.d.ts`
2. Add secrets via `bunx wrangler secret put VAR_NAME` (production) and `.dev.vars` (local)
3. Create an `Effect.Service` Tag + `Layer` in `app/services/{name}.ts`. Yield `CloudflareEnv` and construct the client.
4. Add the service to `AppServices` union and the layer composition in `app/runtime.ts`
5. Add a test layer in `app/services/{name}.test-layer.ts` for repository unit tests
6. Repos consume via `yield* MyService` — never instantiate the client inside a repo
7. Add tagged errors in `app/models/errors/{domain}.ts` and a `case` in `tagToTRPC` (`app/lib/effect-trpc.ts`)
8. Document the integration in this file and update [`architecture.md`](architecture.md) bindings table
