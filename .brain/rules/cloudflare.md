# Cloudflare Layer

Cloudflare Workers runtime, bindings, environment variables. **Source-of-truth files**: `wrangler.jsonc`, `worker-configuration.d.ts`, `workers/app.ts`, `app/services/cloudflare.ts`.

> Programming model basics: see [`../codebase/effect-ts.md`](../codebase/effect-ts.md).

> Cloudflare API reference (Workers runtime, bindings, Wrangler, D1, R2, Workflows, Workers AI, KV, DO): https://developers.cloudflare.com/llms.txt. Prefer `context7` MCP. Catalog + fetch guidance: [`../codebase/llms-txt.md`](../codebase/llms-txt.md).

## Runtime

This project runs on **Cloudflare Workers, not Node.js**. No `process`, no `fs`, no native modules. Edge runtime only.

## Bindings

Available bindings (declared in `wrangler.jsonc`, typed in `worker-configuration.d.ts`):

| Binding | Type | Purpose |
|---------|------|---------|
| `DATABASE` | D1 | SQLite via Drizzle |
| `BUCKET` | R2 | Object storage |
| `AI` | Workers AI | Native model inference (binding present, no consumers yet) |
| `EXAMPLE_WORKFLOW` | Workflow | Sample workflow class `ExampleWorkflow` |
| `ASSETS` | Assets | Static assets directory (`build/client`) |
| `BETTER_AUTH_SECRET` | secret | Auth signing (set via `wrangler secret put`) |
| `YOUTUBE_API_KEY` | secret, optional | YouTube Data API v3 key (`app/services/youtube.ts`). Unset → graceful degradation (search fails fast, resolve falls back to keyless oEmbed). |
| `KARAOKE_ROOM` | Durable Object | Raw DO (not `@cloudflare/actors`) backing live room state — see `high-level-architecture` / `features/group-karaoke`. |

Add a binding:
1. Edit `wrangler.jsonc`
2. Run `bun run typecheck` (auto-runs `cf-typegen`) to regenerate `worker-configuration.d.ts`
3. For secrets: `bunx wrangler secret put VAR_NAME`
4. Local secrets: `.dev.vars`

### Typing a secret that isn't in `wrangler.jsonc`

`wrangler types` only infers a secret's type from a local `.dev.vars` file — which doesn't exist on a fresh clone or CI runner, so `typecheck` would fail there even though the app works fine once someone's local `.dev.vars` is populated. [`workers/env.d.ts`](../../workers/env.d.ts) declares these ambient (interface-merged into the generated `Env`) instead, so typecheck is deterministic everywhere:

```typescript
// workers/env.d.ts
interface Env {
  BETTER_AUTH_SECRET: string;
  YOUTUBE_API_KEY?: string; // optional — service degrades gracefully when unset
}
```

Add every "secret with no `wrangler.jsonc` entry" here (mark it `?` if the app must tolerate it being unset, per `services.md`'s "Adding a new service"). Add the real key to `.dev.vars` (gitignored) for local dev and to `.dev.vars.example` (committed) as documentation.

## Accessing env

**Never `process.env`.** Three valid paths:

> Tracing secrets: `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_HEADERS` / `OTEL_SERVICE_NAME` are optional (`wrangler secret put` in prod, `.dev.vars` locally). They never appear in the generated `Env` type — `app/services/tracing.ts` reads them defensively. Unset = tracing export off. See [`.brain/codebase/observability.md`](../codebase/observability.md).

### A. `Env` type (auto-generated)

```typescript
import type { Env } from "../worker-configuration";
// Env has every binding typed
```

### B. `CloudflareEnv` Effect Tag (inside Effect)

```typescript
import { Effect } from "effect";
import { CloudflareEnv } from "@/services/cloudflare";

const program = Effect.gen(function* () {
  const env = yield* CloudflareEnv;
  // env.DATABASE, env.BUCKET, ...
});
```

### C. `context.cloudflare.env` (loaders/actions)

```typescript
export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DATABASE;
  // ...
}
```

## Workflows (binding side)

Cloudflare Workflows for background / long-running tasks (AI calls, > 1-2s ops, retry-required work). User request returns immediately; workflow runs async.

### Define

Reference: real example in [`workflows/example.ts`](../../workflows/example.ts):

```typescript
// workflows/example.ts (real shape)
import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from "cloudflare:workers";

export interface ExampleWorkflowRequestPayload {
  email: string;
  metadata: Record<string, string>;
}

export class ExampleWorkflow extends WorkflowEntrypoint<Env, ExampleWorkflowRequestPayload> {
  async run(event: WorkflowEvent<ExampleWorkflowRequestPayload>, step: WorkflowStep) {
    await step.sleep("sleep for a bit", "1 minute");
    // ⚠ source bug: missing `await` and ignored result — fire-and-forget. New code should `await` and wrap in `step.do(...)` for retry safety.
    this.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
      prompt: "What is the meaning of life?",
    });
    return { success: true, email: event.payload.email };
  }
}
```

`this.env` exposes every CF binding (`DATABASE`, `BUCKET`, `AI`, `EXAMPLE_WORKFLOW`).

> Workflows only execute under real wrangler — `bun run dev` does not. Use `bun run preview` to actually invoke a workflow locally.

### Register

1. `wrangler.jsonc`:
```jsonc
"workflows": [
  {
    "binding": "EXAMPLE_WORKFLOW",
    "name": "testing-example-workflow",
    "class_name": "ExampleWorkflow"
  }
]
```
2. `workers/app.ts`:
```typescript
export { ExampleWorkflow } from "../workflows/example";
```
3. `bun run typecheck` to regen `worker-configuration.d.ts`
4. Wire into the `Workflows` Effect service — see [`services.md`](services.md).

### Trigger semantics

- Each `step.do(...)` may retry on failure → **must be idempotent**
- Workflow `create()` itself can fail. The `Workflows` service wraps it as `WorkflowTriggerError` (mapped to `INTERNAL_SERVER_ERROR` by `tagToTRPC`):

```typescript
// inside an Effect program
const wf = yield* Workflows;
return yield* wf.triggerExample(input);   // Effect<WorkflowInstance, WorkflowTriggerError>
```

If you want the user request to succeed even when the workflow trigger fails, swallow the error after logging:

```typescript
yield* wf.triggerExample(input).pipe(
  Effect.catchTag("WorkflowTriggerError", (e) => Effect.logError("triggerExample failed", e))
);
```

## Durable Objects (binding side)

`KaraokeRoom` (`app/durable-objects/karaoke-room.ts`, binding `KARAOKE_ROOM`) is the first Durable Object in this repo — added for group-karaoke (feat-007) to hold a room's **live** state (queue, playback, roster) with WebSocket connections held open cheaply via the Hibernation API. It's a **raw DO** (`DurableObject<Env>` from `cloudflare:workers`), not `@cloudflare/actors` — that package was spiked and rejected in Phase 2 (0.0.1-beta.6, opaque persistence model).

### Register

1. `wrangler.jsonc` — binding **and** a top-level `migrations` entry (DO migrations apply per-worker-script across all environments and cannot be declared inside `env.preview`):
```jsonc
"durable_objects": {
  "bindings": [{ "name": "KARAOKE_ROOM", "class_name": "KaraokeRoom" }]
},
"migrations": [
  { "tag": "v1", "new_sqlite_classes": ["KaraokeRoom"] }
]
```
Redeclare the `durable_objects.bindings` block inside `env.preview` too (bindings aren't inherited — same rule as D1/R2/Workflows below); the top-level `migrations` array is not duplicated per-env.
2. `workers/app.ts`:
```typescript
export { KaraokeRoom } from "../app/durable-objects/karaoke-room";
```
3. `bun run typecheck` to regen `worker-configuration.d.ts` (adds `env.KARAOKE_ROOM: DurableObjectNamespace`).

### Class shape

Deliberately **not** run through the Effect runtime — per the Phase 2 task brief, the class stays plain, deterministic TypeScript so it fits the Hibernation API's callback shape (`webSocketMessage` / `webSocketClose` / `alarm`) without forcing a `ManagedRuntime` into a non-request context. All state-transition logic is pure and lives in `app/lib/room-state.ts` (unit-tested independently); the DO class only resolves side effects (WS accept/send, storage reads/writes, ids, the clock) and calls straight into the pure reducers. `ws.send`/storage calls are wrapped in plain `try`/`catch` purely so one dead peer can't crash a broadcast loop for everyone else — the DO-boundary equivalent of the HTTP-boundary `Exit.match` pattern (no `throw` escapes the class).

```typescript
// app/durable-objects/karaoke-room.ts (real shape, abbreviated)
import { DurableObject } from "cloudflare:workers";

export class KaraokeRoom extends DurableObject<Env> {
  private liveState: RoomLiveState;
  private readonly sessions = new Map<WebSocket, SessionAttachment>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(/* heartbeat ping/pong, answered without waking the DO */);
    // Rebuild `sessions` from `ctx.getWebSockets()` + `ws.deserializeAttachment()`
    // — hibernated sockets survive eviction, in-memory state doesn't.
  }

  async fetch(request: Request): Promise<Response> { /* WS upgrade, accept + attach session */ }
  async webSocketMessage(ws: WebSocket, message: string): Promise<void> { /* decode → pure reducer → persist → broadcast */ }
  async alarm(): Promise<void> { /* idle timeout — see below */ }
}
```

### Resolving a stub (from a route)

```typescript
// app/routes/api/room.$code.ws.ts
const stub = env.KARAOKE_ROOM.get(env.KARAOKE_ROOM.idFromName(room.id));
return yield* Effect.tryPromise({
  try: () => stub.fetch(forwardedRequest),
  catch: (cause) => new ExternalServiceError({ service: "KaraokeRoomDO", cause }),
});
```

One DO instance per room, addressed deterministically by the D1 `room.id` via `idFromName` — never a random id, or reconnects would hit a different instance.

### Idle alarm

A 1h sliding-window `ctx.storage.setAlarm(...)` re-armed on every WS connect/message. If it fires with sockets still connected, it's just re-armed. If it fires with none connected, the room is considered abandoned: the DO closes the D1 `room` row directly (drizzle over the `DATABASE` binding, not through `RoomRepository` — the DO has no Effect runtime to yield a repository Tag from) and clears its in-memory `liveState`.

### Anti-patterns

- Reaching for `@cloudflare/actors` — rejected for this repo (see above); use a raw `DurableObject<Env>` subclass.
- Running Effect/`ManagedRuntime` inside DO lifecycle callbacks (`fetch`/`webSocketMessage`/`alarm`) — keep the class plain TS, push logic into pure, independently-tested functions.
- Addressing a DO with a random/generated id — use `idFromName` keyed on a stable D1 id so reconnects hit the same instance.
- Letting one dead WebSocket's `send()` throw and abort a broadcast to every other connected client — wrap per-socket sends in `try`/`catch`.

## Environments & preview deployments

Two wrangler environments live in `wrangler.jsonc`:

| Env | Worker | D1 | R2 | Deploy command |
|-----|--------|----|----|----------------|
| top-level (prod) | `<name>` | `<name>-db` | `<name>-bucket` | `bun run deploy` |
| `preview` | `<name>-preview` | `<name>-db-preview` (manual) / `<name>-db-pr-<N>` (per-PR, patched in CI) | `<name>-bucket-preview` (shared) | `bun run deploy:preview` |

Rules:

- **Env bindings are NOT inherited.** Every binding (D1, R2, AI, workflows, observability) must be redeclared inside `env.preview`. A missing redeclaration silently drops the binding.
- **`wrangler deploy --env preview` DOES NOT WORK with the Vite plugin** — it silently deploys prod. `@cloudflare/vite-plugin` writes a flattened redirected config (`build/server/wrangler.json`) with no `env` block; the environment must be selected at **build time**: `CLOUDFLARE_ENV=preview bun run build`, then plain `wrangler deploy` follows the redirect.
- **Secrets are per-environment**: `wrangler secret put BETTER_AUTH_SECRET --env preview` — an unset secret fails at runtime (error 1101), not deploy time.
- Per-PR previews: `.github/workflows/preview.yml` runs `scripts/ci/setup-preview-db.ts <N>` — creates a **per-PR D1** (`<name>-db-pr-<N>`) and patches the CI checkout's `wrangler.jsonc` to point `env.preview`'s `DATABASE` binding at it (patch never committed) — then migrates it, builds with `CLOUDFLARE_ENV=preview`, runs `wrangler versions upload --preview-alias pr-<N>` → stable URL `https://pr-<N>-<name>-preview.<subdomain>.workers.dev`. Bindings are per-version, so one preview worker serves all PRs. R2 stays **shared** across previews (wrangler can't delete non-empty buckets). Opt-in via GitHub repo variable `CLOUDFLARE_ACCOUNT_ID` + secret `CLOUDFLARE_API_TOKEN`. Cleanup: `preview-cleanup.yml` deletes the per-PR D1 on PR close; worker versions age out on their own (aliases capped at 1000 most recent); `bun run teardown` sweeps orphaned `-db-pr-*` DBs. D1 free plan caps at 10 databases — per-PR DBs assume paid; on free, revert the provision step to the shared `-db-preview`.
- Preview URLs work with the Workflows binding (verified 2026-07-10); the documented Durable-Object preview-URL restriction is not triggered by `workflows` config.
- `wrangler.jsonc` is **committed with dummy IDs** so `cf-typegen`/CI work on a fresh clone; `bun run setup` fills real IDs (and creates preview resources); `bun run teardown` restores the dummy file.

## Wrangler commands

```bash
bun run db:migrate:local       # Apply migrations to local D1
bun run db:migrate:remote      # Apply migrations to remote D1
bun run db:studio              # Drizzle Studio
bunx wrangler secret put VAR   # Set production secret
bunx wrangler types            # Regen worker-configuration.d.ts (also via bun run typecheck)
bun run deploy                 # Build + push to CF
```

## Anti-patterns

- `process.env.ANYTHING` — use bindings
- Importing `node:fs`, `node:path`, etc. — Workers has no Node std lib
- Caching auth/DB clients globally across requests — must be per-request (each invocation gets a fresh isolate or pooled isolate; bindings only valid for the request)
- Long sync work in request handler — push to a Workflow
- `step.do()` body that mutates external state without idempotency — retries WILL run it twice
