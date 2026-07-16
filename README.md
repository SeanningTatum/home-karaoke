# 🎤 home-karaoke

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![React Router](https://img.shields.io/badge/framework-React%20Router%20v7-CA4245?logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Effect TS](https://img.shields.io/badge/typed-Effect%20TS-1E1E2C)](https://effect.website/)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> **Open-source group karaoke for your living room.** One person hosts a room on the big screen; everyone else scans a QR code, searches YouTube from their phone, and drops songs into a shared queue that syncs live. No app install, no accounts — guests just pick a nickname and sing.

Built on the Cloudflare edge stack — **Cloudflare Workers + React Router v7 + tRPC + D1/Drizzle + Better Auth + Effect TS + ShadCN/Tailwind** — with a **Durable Object** holding each room's live queue/playback/roster over hibernatable WebSockets.

---

## How it works

**Host** (big screen / TV / laptop)
1. Sign in → dashboard → **Create room**.
2. Land on `/room/:code` — a full-screen YouTube player, the live queue, playback controls, and a **join QR code**.
3. Control play / pause / skip / volume, drag to reorder the queue, and flip **Allow guest reorder** on or off. End the party when done.

**Guests** (phones)
1. Scan the QR (or open the link) → `/join/:code`.
2. Pick a **nickname** — an anonymous session is provisioned automatically (no signup).
3. **Search** tab: query YouTube (biased toward karaoke tracks) or paste a video link. **Queue** tab: watch the shared queue update live, your own picks highlighted, and drag-reorder if the host allowed it.

The queue, playback state, and connected-guest roster all sync in real time over a single WebSocket per room. Rooms auto-close after **1 hour idle**.

---

## Architecture at a glance

| Concern | How |
|---------|-----|
| **Live room state** | `KaraokeRoom` raw **Durable Object** (SQLite storage + WebSocket Hibernation API) — the source of truth for queue / playback / roster while a room is open. State transitions are pure functions in [`app/lib/room-state.ts`](app/lib/room-state.ts); the DO only does side effects (WS accept/send, storage, clock). |
| **Room CRUD + search** | tRPC procedures on the Worker: create / get / close a room, `setGuestReorder`, `recordPlayed`, and the YouTube search/resolve flow. |
| **YouTube** | Data API v3 (`search.list` / `videos.list`), karaoke-biased queries, results persisted to D1 with a **7-day search cache** to save quota. Degrades gracefully with **no API key** — guests fall back to the keyless oEmbed "paste a link" path. |
| **Durable records** | D1 (SQLite via Drizzle): `room`, `song`, `search_log`, `room_song` (play history). The DO's live state is ephemeral; D1 is the durable record. |
| **Auth** | Better Auth with the **anonymous plugin** — guests get a real session/user row without signing up. Hosts use email/password. |
| **Idle cleanup** | A 1h sliding-window DO alarm re-armed on every WS connect/message; on fire with no sockets connected it writes `room.status = "closed"` to D1. |

Full feature memo: [`.brain/features/group-karaoke/group-karaoke.md`](.brain/features/group-karaoke/group-karaoke.md).

---

## Quick Start

### Prerequisites

```bash
# Bun (package manager + runtime)
curl -fsSL https://bun.sh/install | bash

# Cloudflare CLI
bun add -g wrangler
wrangler login
```

### Option A — Automated setup (recommended)

```bash
bun run scripts/first-time-setup.ts
```

The wizard creates your D1 database, R2 bucket, optional KV namespace, generates a `BETTER_AUTH_SECRET`, writes `wrangler.jsonc` + `.env`, runs migrations, and deploys. ~3 min end-to-end.

### Option B — Manual

```bash
bun install                 # also runs cf-typegen + git hooks install
bun run db:migrate:local    # apply migrations to local D1
bun run db:seed             # seed local D1 with admin/user/banned fixtures
bun run dev                 # http://localhost:5173
```

### YouTube search (optional)

Set `YOUTUBE_API_KEY` (a [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key) to enable in-app search:

```bash
wrangler secret put YOUTUBE_API_KEY          # production
echo 'YOUTUBE_API_KEY=...' >> .dev.vars      # local dev
```

**Without a key the app still works** — the Search tab falls back to pasting a YouTube link (resolved via the keyless oEmbed endpoint).

---

## Stack

- **Runtime:** Cloudflare Workers (no Node), React Router v7 SSR
- **Live state:** raw Durable Object with SQLite storage + WebSocket Hibernation
- **Server logic:** tRPC v11 procedures wrapped in Effect TS
- **Persistence:** D1 (SQLite) via Drizzle ORM, R2 for files
- **Auth:** Better Auth (Drizzle adapter + admin plugin for RBAC + anonymous plugin for guests)
- **External:** YouTube Data API v3 (+ keyless oEmbed fallback)
- **Validation:** Effect Schema everywhere — no Zod
- **Errors:** `Data.TaggedError` mapped to tRPC codes via `tagToTRPC`
- **UI:** ShadCN/Radix + Tailwind v4 (oklch), `@dnd-kit` drag-reorder, `qrcode.react`, next-themes
- **i18n:** remix-i18next + i18next, route-level namespaces, fully typed
- **Testing:** Vitest (unit, 400+ tests) + Playwright (e2e) + `@effect/vitest`

---

## Working in this repo (for agents)

This repo ships with a full **agent harness** under [`.brain/`](.brain/) — retrieval-first docs, paste-able recipes, deterministic verification gates, and project-local sub-agents. If you're an AI agent (Claude Code, Cursor, Codex), **read [`AGENTS.md`](AGENTS.md) first** (`CLAUDE.md` is a symlink to it) — it points to everything else.

Every non-trivial task runs three gated phases:

| Phase | Command | Does |
|-------|---------|------|
| Init | [`/start-task`](.claude/commands/start-task.md) | `init.sh --baseline` + reads the brain + frames task + opens run note |
| Verify | [`/verify-done`](.claude/commands/verify-done.md) | typecheck / test / e2e / build / brain-coherence / non-negotiables |
| Ship | [`/ship-feature`](.claude/commands/ship-feature.md) | verify-done + flip `feature_list.json` + close run note + `/harness-check` |

**Five non-negotiables** (grep-checkable, full detail in [`.brain/codebase/effect-ts.md`](.brain/codebase/effect-ts.md)):

1. **Effect TS by default.** No `throw`, no `try/catch` outside `Effect.tryPromise`.
2. **Effect Schema for validation.** No Zod.
3. **Tagged errors only** — in `app/models/errors/`, mapped in `app/lib/effect-trpc.ts` (`tagToTRPC`).
4. **Unit test every helper, repository, and service.**
5. **Cloudflare Workers, not Node.** Bindings via the `CloudflareEnv` Tag — never `process.env`.

The `.brain/` layout, recipes, rules, and sub-agents are documented in [`AGENTS.md`](AGENTS.md).

---

## Project layout

```
app/
├── auth/                 Better Auth server config + client (admin + anonymous plugins)
├── components/
│   ├── ui/               shadcn primitives
│   ├── room/             Host room UI — queue rail, player, controls, QR join panel
│   └── join/             Guest UI — nickname form, search/queue/controls tabs
├── db/                   Drizzle schema (room, song, search_log, room_song, user, …)
├── durable-objects/      KaraokeRoom raw Durable Object (live queue/playback/roster)
├── hooks/                React hooks — incl. use-room-socket.ts (room WS)
├── lib/
│   ├── room-state.ts     Pure reducers — applyClientMessage, canPerform, roster
│   ├── youtube.ts        Pure helpers — parse URL/duration, karaoke bias, normalize
│   └── schemas/          Effect Schema — room, youtube, room-ws protocol
├── models/errors/        Tagged error classes
├── repositories/         Drizzle-backed Effect.Service repos (room, song, user, bucket)
├── routes/
│   ├── room/$code.tsx    Host big-screen room
│   ├── join/$code.tsx    Guest join flow
│   └── api/room.$code.ws.ts   WebSocket upgrade boundary → KaraokeRoom DO
├── services/             Effect Tag/Layer services (Database, AuthApi, YouTube, …)
└── trpc/                 tRPC router + procedures (room, youtube, …)
.brain/                   Agent harness — docs, rules, recipes, features, runs
.githooks/                Pre-commit gate (typecheck + tests)
.claude/                  Claude Code config — settings, hooks, agents/, commands/
drizzle/                  SQL migrations
workflows/                Cloudflare Workflow definitions
workers/app.ts            Cloudflare Workers entrypoint
```

---

## Commands

```bash
./init.sh                     # Harness bootstrap — install + migrate + typecheck + test
bun run dev                   # Dev server (auto-runs local DB migrations) → :5173
bun run build                 # Production build
bun run deploy                # Build + deploy to Cloudflare Workers
bun run deploy:preview        # Build (CLOUDFLARE_ENV=preview) + deploy the -preview worker

bun run typecheck             # cf-typegen + react-router typegen + tsc -b
bun run test                  # Vitest (one-shot)
bun run test:watch            # Vitest watch
bun run test:e2e              # Playwright

bun run db:generate           # Generate Drizzle migration from schema
bun run db:migrate:local      # Apply migrations to local D1
bun run db:migrate:remote     # Apply migrations to remote D1
bun run db:seed               # Seed local D1 with admin/user/banned fixtures
bun run db:studio             # Drizzle Studio (visual DB editor)

bun run setup                 # First-time wizard
bun run teardown              # Tear down Cloudflare resources
```

---

## Database

D1 (SQLite) through Drizzle. Schema in [`app/db/schema.ts`](app/db/schema.ts). Karaoke tables:

| Table | Holds |
|-------|-------|
| `room` | `code`, `hostUserId`, `status`, `allowGuestReorder`, timestamps |
| `song` | `videoId` (PK), `title`, `channel`, `thumbnailUrl`, `embeddable`, `durationSeconds` |
| `search_log` | search history + picked video (indexed on `normalizedQuery` for the cache join) |
| `room_song` | play history — room ↔ song ↔ singer nickname, `playedAt` |

Schema-change flow:

```bash
# 1. Edit app/db/schema.ts   2. bun run db:generate   3. review drizzle/<NNNN>_*.sql
# 4. bun run db:migrate:local   5. after merge: bun run db:migrate:remote
```

---

## Authentication

[Better Auth](https://better-auth.com/) with the Drizzle adapter, `admin()` plugin (RBAC), and `anonymous()` plugin (guests).

- Auth handler: `/api/auth/*` ([`app/routes/api/auth.$.ts`](app/routes/api/auth.$.ts))
- Guests: `signIn.anonymous()` provisions a real session/user row + nickname — no signup, works through `protectedProcedure` unmodified.
- Hosts: email/password. Admin role gates the `/admin/*` area at both the loader (page) and `adminProcedure` (data) layers.

```bash
# Production secret
openssl rand -base64 32
wrangler secret put BETTER_AUTH_SECRET
```

Seed local fixtures (`bun run db:seed`, password `Password123!` for all):

| Email | Role |
|-------|------|
| `admin@preview.local` | admin |
| `user@preview.local` | user |
| `banned@preview.local` | user (banned) |

---

## Deployment

```bash
bun run deploy                    # Build + deploy to production
```

Observability is on in [`wrangler.jsonc`](wrangler.jsonc) (logs, 100% head sampling; smart placement enabled). Every PR can get its own isolated live preview (own Worker + per-PR D1 + shared preview R2) via [`.github/workflows/preview.yml`](.github/workflows/preview.yml) — see the preview section in [`AGENTS.md`](AGENTS.md)/`.brain` for enablement.

> **Durable Objects need a full deploy.** After adding or migrating a DO class, run a full `bun run deploy` (not just a `versions upload`) so the migration registers.

---

## Contributing

1. Branch off `main`.
2. Read the relevant [`.brain/recipes/`](.brain/recipes/) runbook before starting.
3. Pre-commit gate runs typecheck + tests automatically.
4. Update the `.brain/` doc that owns your change (the brain-reminder hook tells you which).
5. Open the PR.

When in doubt: read first, code second. 🎤
