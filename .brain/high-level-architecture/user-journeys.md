# User Journeys

Verified against current code (2026-05-07). Auth pages live at root (no locale prefix); after auth, users land on `/dashboard`. `/admin/*` is reachable but currently has no layout-level auth gate (see [`security.md`](security.md) gap #1).

## Authentication flows

### Sign Up (new user)

```
User → /sign-up                                       (loader: redirect /dashboard if session)
     → SignupForm submits                             (Effect Schema validation client-side)
     → authClient.signUp.email({ email, password, name })
     → Better Auth handler at /api/auth/sign-up/email
     → Inserts user + account, creates session, sets httpOnly cookie
     → On success, form calls navigate("/dashboard")
```

Key files:
- [`app/routes/authentication/sign-up.tsx`](../../app/routes/authentication/sign-up.tsx)
- [`app/routes/authentication/components/signup-form.tsx`](../../app/routes/authentication/components/signup-form.tsx)
- [`app/auth/server.ts`](../../app/auth/server.ts), [`app/auth/client.ts`](../../app/auth/client.ts)
- [`app/lib/schemas/auth.ts`](../../app/lib/schemas/auth.ts) — `SignupSchema` (with confirm-password filter)

### Login (existing user)

```
User → /login                                         (loader: redirect /dashboard if session)
     → LoginForm submits
     → authClient.signIn.email({ email, password })
     → Better Auth handler verifies, checks ban (admin plugin), creates session
     → On success, form calls navigate("/dashboard")
```

A banned user fails at the Better Auth layer with the ban reason in the error response — the form surfaces it inline.

### Logout

```
User clicks sign-out → authClient.signOut() → /api/auth/sign-out → cookie cleared → client redirects to /login
```

## Dashboard journey

```
User → /dashboard                                     (loader: getSession → redirect /login if absent)
     → /dashboard/_index.tsx                          (placeholder content today)
```

Layout is gated at [`app/routes/dashboard/_layout.tsx`](../../app/routes/dashboard/_layout.tsx).

## Admin journeys

> ⚠ The admin layout currently has no auth gate (see `security.md` gap #1). Data is still gated because every `/admin/*` page calls a `context.trpc.admin.*` method, which goes through `adminProcedure` middleware (`UNAUTHORIZED` if no session, `FORBIDDEN` if `role !== "admin"`). UI shell still renders — only the data fetch fails.

### User management

```
Admin → /admin/users
      → loader: parses ?page, ?pageSize, ?search, ?role, ?status
      → context.trpc.admin.getUsers({ page, limit, search, role, status })
      → Returns { users, total, page, pageSize, ... }
      → Renders UserDataTable with row-level actions
        ├─ Ban (sets banned=true + reason + optional banExpires)
        ├─ Unban (clears ban fields)
        ├─ Update role
        ├─ Bulk ban / delete / role-update
        └─ Impersonate (admin plugin)
```

Key files:
- [`app/routes/admin/users.tsx`](../../app/routes/admin/users.tsx)
- [`app/routes/admin/components/user-data-table.tsx`](../../app/routes/admin/components/user-data-table.tsx)
- [`app/trpc/routes/admin.ts`](../../app/trpc/routes/admin.ts) — full procedure surface (`getUsers`, `getUser`, `updateUser`, `banUser`, `unbanUser`, `deleteUser`, `bulkBanUsers`, `bulkDeleteUsers`, `bulkUpdateUserRoles`)
- [`app/repositories/user.ts`](../../app/repositories/user.ts)

### Admin dashboard

`/admin` (index) now redirects to `/admin/users` — the analytics dashboard that used to live here was cut 2026-07-16 by feat-008 (ui-overhaul Phase 2). See `.brain/features/analytics/analytics.md` (tombstone) for what it was.

## Group karaoke journeys (feat-007)

### Host: create + run a room

```
Host → /dashboard → "Create room"
     → trpc room.create (protectedProcedure)                     → D1 `room` row (code, hostUserId)
     → /room/:code                                                (host big-screen view)
         ├─ useRoomSocket connects GET /api/room/:code/ws          → role resolved "host"
         ├─ QR join panel (QRCodeSVG over the join URL)
         ├─ YouTube <iframe> player, queue rail (dnd-kit reorder — host always allowed)
         └─ host controls: play/pause/skip/volume, allowGuestReorder toggle
              (trpc room.setGuestReorder, host-only — FORBIDDEN otherwise)
     → "End party" → trpc room.close (host-only) → D1 `room.status = "closed"`
```

### Guest: join + sing

```
Guest scans QR (or opens the link) → /join/:code
     → loader: public trpc room.get(code) — resolves room before any auth
     → NicknameForm                                                (anonymous session if none:
         │                                                          authClient.signIn.anonymous())
         ▼
     Search / Queue tabs (+ host-only Controls tab if this guest's
     session happens to be the room's host, e.g. host's own phone)
         ├─ Search tab: query → trpc youtube.search (D1 7-day cache → YouTube
         │   Data API, "karaoke"-biased) OR paste-a-link → trpc
         │   youtube.resolveVideo (oEmbed fallback if no API key)
         │   → add to queue over the room WebSocket
         └─ Queue tab: live queue/roster state from useRoomSocket,
             own items highlighted, drag-to-reorder gated by
             room.allowGuestReorder (dnd-kit UI + DO-side canPerform check)
```

### Room auto-close (idle)

```
No WS activity for 1h (sliding window, re-armed on every connect/message)
     → KaraokeRoom DO alarm() fires with no sockets connected
     → D1 `room` row marked closed (RoomRepository) + DO live state cleared
```

### Error states (group karaoke)

- **Room not found / bad code** — `room.get` / WS upgrade both surface `RoomNotFoundError` → 404 (tRPC) or a plain 404 `Response` (WS route).
- **Room closed** — `RoomClosedError` → 409, shown as a friendly "this room has ended" message on `/join/:code` and the WS route.
- **YouTube quota exceeded** — `youtube.search` fails `YouTubeQuotaExceededError` → `TOO_MANY_REQUESTS`; guest UI falls back to the always-available paste-a-link flow.
- **Video not embeddable / not found** — `youtube.resolveVideo` fails `VideoNotEmbeddableError` (400) or `VideoNotFoundError` (404) with an inline error on the search/paste form.
- **Non-host attempts a host-only action** — `room.close` / `room.setGuestReorder` / `room.recordPlayed` throw `TRPCError({ code: "FORBIDDEN" })` directly (procedure-level control flow, not a tagged error).

Key files: `app/routes/room/$code.tsx`, `app/routes/join/$code.tsx`, `app/components/room/*`, `app/components/join/*`, `app/hooks/use-room-socket.ts`, `app/routes/api/room.$code.ws.ts`, `app/durable-objects/karaoke-room.ts`. Full memory: [`../features/group-karaoke/group-karaoke.md`](../features/group-karaoke/group-karaoke.md).

## Role / route map

```
Public                Protected (session)         Admin (role="admin")
─────────             ──────────────────          ────────────────────
/                     /dashboard/*                /admin/*  ← layout gate currently missing;
/login                /room/:code (host)            data-level enforcement via adminProcedure
/sign-up
/join/:code           (nickname step gets an anonymous session if none exists)
/api/auth/*           /api/room/:code/ws
                        (session required; host vs guest role resolved per-connection)
/api/trpc/*  (mixed — per procedure; room.get + youtube.* accept anonymous sessions)
```

## Error states

### Banned user login attempt
Better Auth's `admin` plugin rejects the sign-in. `authClient.signIn.email` returns an `error` object; the form surfaces `error.message` (which includes the ban reason if Better Auth provides it).

### Session expired
Loader's `getSession` returns `null`. Dashboard layout redirects to `/login`. Admin layout doesn't redirect today — see gap #1.

### Unauthorized admin tRPC call
`adminProcedure` throws `TRPCError({ code: "UNAUTHORIZED" })` if no session, `TRPCError({ code: "FORBIDDEN" })` if `role !== "admin"`. In a loader, this surfaces as a thrown error → React Router error boundary.
