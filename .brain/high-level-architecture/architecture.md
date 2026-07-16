# System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ React Router│  │ tRPC Client │  │ Better Auth Client      │ │
│  │ Components  │  │ Hooks       │  │ (useSession, signIn)    │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers (Edge)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ React Router│  │ tRPC Router │  │ Better Auth Handler     │ │
│  │ Loaders     │  │ /api/trpc/* │  │ /api/auth/*             │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                     │                │
│         └────────────────┼─────────────────────┘                │
│                          ▼                                      │
│             ┌─────────────────────────┐                         │
│             │ Effect ManagedRuntime   │                         │
│             │ (per request)           │                         │
│             └────────────┬────────────┘                         │
│                          ▼                                      │
│             ┌─────────────────────────┐                         │
│             │ Repositories            │                         │
│             │ (Effect.Service)        │                         │
│             └────────────┬────────────┘                         │
└──────────────────────────┼──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Services                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ D1 Database │  │ R2 Storage  │  │ Workers AI / Workflows  │ │
│  │ (SQLite)    │  │ (Files)     │  │ (binding: AI, EXAMPLE_  │ │
│  │ + sessions  │  │             │  │  WORKFLOW)              │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ KaraokeRoom Durable Object (binding: KARAOKE_ROOM)       │   │
│  │ one instance per room, addressed by D1 `room.id`;        │   │
│  │ SQLite storage + WS Hibernation API + idle alarm         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

Sessions are persisted in the D1 `session` table by Better Auth's drizzle adapter — **not in KV**. There is no KV binding.

### WebSocket / Durable Object request path (group-karaoke)

```
Client → GET /api/room/:code/ws  (Upgrade: websocket)
              │
              ▼
        routes/api/room.$code.ws.ts  loader (non-tRPC HTTP boundary —
              │                       runPromiseExit + Exit.match, see routes.md)
              ├─ getSession(headers) → 401 if absent
              ├─ RoomRepository.getRoomByCode(code) → 404 / 409 if closed
              ├─ role = session.user.id === room.hostUserId ? "host" : "guest"
              ▼
        env.KARAOKE_ROOM.idFromName(room.id) → stub.fetch(request)
              (identity forwarded via x-user-id / x-nickname / x-role /
               x-room-id / x-allow-guest-reorder headers — the DO never
               calls Better Auth or a repository directly)
              │
              ▼
        KaraokeRoom Durable Object (app/durable-objects/karaoke-room.ts)
              ├─ WS Hibernation API accepts the socket, session attachment
              │  serialized onto it (survives eviction)
              ├─ pure reducers in app/lib/room-state.ts (RoomLiveState:
              │  queue, playback, roster) — DO class only resolves side
              │  effects (send/broadcast/storage/clock)
              ├─ state persisted to the DO's own SQLite storage (not D1)
              └─ 1h sliding idle alarm → on fire with no sockets connected,
                 closes the D1 `room` row (RoomRepository) and clears
                 live state
```

Client-side: `app/hooks/use-room-socket.ts` opens/maintains the WS connection and exposes `{ state, send, connectionStatus }` to `app/routes/room/$code.tsx` (host) and `app/routes/join/$code.tsx` (guest).

## Data flow patterns

### Server-side rendering (loaders)

```
Route Loader → context.trpc.<router>.<method>() → tRPC Procedure
                    │
                    ▼
              runProcedure(ctx.runtime, Effect.gen(...))
                    │
                    ▼
              yield* Repository → Database service → D1
                    │
                    └─→ Returns data to component via loaderData
```

```typescript
// app/routes/admin/users.tsx
export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await context.auth.api.getSession({ headers: request.headers });
  if (!session) return redirect("/login");

  const users = await context.trpc.admin.getUsers({ page: 0, limit: 100 });
  return { users };
}
```

### Client-side data fetching

```
Component → api.<router>.<method>.useQuery() → /api/trpc/* → tRPC Router → runProcedure → Repository → D1
```

```typescript
const { data: users, isLoading } = api.admin.getUsers.useQuery({ page: 0, limit: 50 });
```

### Mutations

```
Component → api.<router>.<method>.useMutation() → /api/trpc/* → runProcedure → Repository → D1
                  │
                  └─→ onSuccess: invalidate via api.useUtils()
```

## Layer responsibilities

### Routes (`app/routes/`)
- React Router v7 file-based routes
- Server loaders for SSR data (auth-gate first, then `context.trpc.*`)
- Client components, forms, navigation

### tRPC routes (`app/trpc/routes/`)
- Input validation via Effect Schema (`Schema.standardSchemaV1(...)`)
- Authorization through `publicProcedure` / `protectedProcedure` / `adminProcedure`
- Wrap body in `runProcedure(ctx.runtime, Effect.gen(...))`
- Yield repositories via Effect Tags — never call repo methods as plain functions

### Repositories (`app/repositories/`)
- `Effect.Service` classes that yield service Tags (`Database`, `Bucket`, `AuthApi`, `Workflows`)
- Methods return `Effect<A, TaggedError, never>`
- No tRPC imports, no session access, no `throw`
- Drizzle calls wrapped via `tryQuery` / `tryUpdate` / `tryCreate` / `tryDelete` from `@/lib/effect-utils`

### Models (`app/models/errors/`)
- `Data.TaggedError` ADTs — `NotFoundError`, `ValidationError`, `CreationError`, `UpdateError`, `DeletionError`, `QueryError`, `ConfigurationError`, `ExternalServiceError`, bucket errors, workflow errors
- Mapped to TRPC codes by `tagToTRPC` in `app/lib/effect-trpc.ts`

### Schemas (`app/lib/schemas/`)
- Effect Schema definitions — **no Zod**
- Inferred types via `typeof MySchema.Type`
- Bridged into tRPC with `Schema.standardSchemaV1(...)`
- Bridged into React Hook Form with `effectResolver(...)` from `@/lib/effect-form`

## Key files

| Layer | Location | Purpose |
|-------|----------|---------|
| Worker entry | `workers/app.ts` | CF entry, builds runtime + tRPC ctx per request |
| Runtime | `app/runtime.ts` | `makeAppRuntime(env, baseURL?)` — composes all Layers; auth is built inside via `AuthApiLive(baseURL)` |
| Routes | `app/routes.ts` | Route table |
| tRPC bootstrap | `app/trpc/index.ts` | `createTRPCContext`, procedure types, error formatter |
| tRPC router | `app/trpc/router.ts` | Top-level router (`user`, `admin`, `analytics`) |
| Effect ↔ tRPC | `app/lib/effect-trpc.ts` | `runProcedure`, `tagToTRPC` |
| DB | `app/db/schema.ts` | Drizzle schema |
| Auth | `app/auth/server.ts` | Better Auth factory — `admin` + `anonymous` plugins |
| Services | `app/services/` | `Database`, `Bucket`, `AuthApi`, `Workflows`, `YouTube`, `Session`, `CloudflareEnv`, `Logger` |
| Errors | `app/models/errors/` | Tagged errors |
| Durable Object | `app/durable-objects/karaoke-room.ts` | `KaraokeRoom` — live room state (queue/playback/roster), WS Hibernation API, idle alarm. Re-exported from `workers/app.ts`. See `rules/cloudflare.md` |
| WS route | `app/routes/api/room.$code.ws.ts` | Non-tRPC HTTP boundary — resolves identity + room, forwards to the `KARAOKE_ROOM` DO stub |

## AppLoadContext shape

```typescript
declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: { env: Env; ctx: ExecutionContext };
    trpc: ReturnType<typeof createCaller>;
    auth: Auth;
    runtime: AppRuntime;
  }
}
```

There is **no `context.db`**, no `context.posthog`, no `context.stripe`. Bindings are reached via `context.cloudflare.env`. Database access goes through repos via `context.trpc.*`.
