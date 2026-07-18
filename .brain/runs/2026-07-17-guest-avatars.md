# Run: guest-avatars

_Started: 2026-07-17_
_Status: shipped_

## Task

Guests can upload a profile picture; their face (avatar) shows in the lobby roster and inside the room views (host TV + guest screens).

## Domain

mixed (cloudflare R2 binding + repository + service + tRPC route + DO/WS protocol + frontend)

## Plan

1. Explore (parallel sub-agents): (a) upload/R2 infra status — feat-003 file-upload is CUT, verify what exists; (b) guest identity/roster data path (join flow → WS headers → DO roster → lobby/room UI).
2. Architect design (opus sub-agent): storage (R2), upload endpoint (binary/multipart non-tRPC route or tRPC base64?), user.image column, WS roster avatarUrl threading, UI (Avatar in lobby tiles, queue rows, now-singing banner).
3. New feature entry feat-011 `guest-avatars` in feature_list.json (in-progress) + feature memo from _TEMPLATE.
4. Build in phases via sonnet/opus builders (persistence → binding/service → endpoint → DO/protocol → UI).
5. effect-ts-enforcer review + /verify-done + feature-verifier browser walk.

## Baseline

```
$ ./init.sh --baseline   (after bun install — fresh worktree, vitest missing initially)
typecheck:     PASS
test:          PASS
harness-check: PASS
Baseline green. Proceed to task.
```

State of the tree before any of my changes: clean, branch beaver/08399871 (from main 411d1b4).

---

## Step 1 — Explore: upload/R2 infra status (sonnet sub-agent)

_2026-07-17_

What I learned (feat-003 file-upload was cut by feat-008, but only ABOVE repository layer):

- **Exists & keep unchanged**: `wrangler.jsonc:19-24` + preview env `BUCKET` R2 binding (`home-karaoke-bucket`); `app/services/bucket.ts` (`Bucket` Tag + `BucketLive`, `BucketBindingError` if unbound); `app/repositories/bucket.ts` (`upload`/`get`/`remove`/`list`, key `uploads/${Date.now()}-${uuid}`, upload returns **key not URL**); `app/lib/schemas/bucket.ts`; `app/models/errors/bucket.ts` (7 tagged errors, all in `tagToTRPC`); wired in `app/runtime.ts`; unit tests intact.
- **Missing (deleted 2026-07-16)**: upload HTTP route, GET/serve route (nothing streams `R2ObjectBody` → `Response`), UI component, size/type constants, i18n namespace.
- **`user.image` exists**: `app/db/schema.ts:17` `image: text("image")` nullable — already rendered in admin `AvatarImage`, no write path anywhere.
- **Non-tRPC HTTP route convention**: `.brain/rules/routes.md:145-176` documents exact upload-route target shape (formData → BucketRepository.upload → catchTags → `context.runtime.runPromiseExit` + `Exit.match`); live example `app/routes/api/room.$code.ws.ts`; register flat in `app/routes.ts` (no locale prefix).
- add-cf-binding recipe steps 1-7 already satisfied for R2.

Next: explorer 2 (roster path) → opus architect.

---

## Step 2 — Explore: guest identity/roster path (sonnet sub-agent)

_2026-07-17_

Identity flow map (file:line):

- Join: `app/routes/join/$code.tsx:56-73` loader (session/isHost/userId); `JoinFlow:131-158` holds `{nickname,userId}` in React state. `nickname-form.tsx`: localStorage `karaoke-nickname` prefill, `authClient.signIn.anonymous()` (:82) for new guests, `authClient.updateUser({name})` (:91) only when `!hasSession`.
- WS: `use-room-socket.ts:44-51` appends `?nickname=`; `app/routes/api/room.$code.ws.ts:24-30` resolves session, :49-61 nickname (param beats `user.name`), :72-81 forwards headers `x-user-id`/`x-nickname`/`x-role`/`x-room-id`/`x-allow-guest-reorder` → DO. **Insertion point: read `session.user.image`, forward `x-avatar-url`.**
- DO: `karaoke-room.ts:52-56` `SessionAttachment {userId,nickname,role}` (serializeAttachment :159 — must add avatarUrl to survive hibernation); :122-129 header read; :163-167 `addToRoster`; :224-230 ctx into `applyClientMessage` (`queue.add` → `singerNickname` at `room-state.ts:312`).
- Schemas `room-ws.ts`: `QueueItem` :11-21 (add `singerAvatarUrl: NullOr(String)`), `RosterEntry` :36-41 (add `avatarUrl`). Embedded in room.state/queue.updated/roster.updated — no other schema changes. `use-room-socket.ts` passes through verbatim — zero hook changes.
- Pure state `room-state.ts`: `AddToQueueInput` :92-101, `addToQueue` :103-114, roster helpers :254-270 (avatar rides along), `queue.add` case :305-315.
- UI render targets: `roster-strip.tsx` compact :38-71 / lobby :92-120 (`InitialsAvatar` :61/:107); `$code.tsx:490-496` lobby panel, :601-603 compact strip, :541-571 lobby queue summary (:563 InitialsAvatar); `queue-rail.tsx:306-326` singer block; `now-up-overlay.tsx:127` (singer prop from `$code.tsx:236`, `playback.currentItem.singerNickname` :261); `now-singing-banner.tsx` text-only.
- Avatar primitive: `initials-avatar.tsx` (gradient fallback, SIZE_CLASSES sm/md/lg); `ui/avatar.tsx` exports **unused `AvatarImage`** :24-35 — ready to wire.
- `user.image` (`schema.ts:17`): natural avatar source; anonymous users have real user rows.
- Design tokens: `bg-gradient-accent`, `shadow-glow-accent`, `tv-label`; lobby chips `size-20 text-2xl`, queue TV chip `size-6`.

Next: opus code-architect design.

---

## Final

_Closed: 2026-07-17_

- Shipped: 3 build commits on `beaver/08399871` (6c168a2 data plane, 0a78c0e routes+capture, 8a65f9c display wiring) + brain/docs commit. PR pending.
- Brain docs updated: features/guest-avatars/guest-avatars.md (full), codebase/api.md, codebase/i18n.md, rules/routes.md, rules/repository.md, rules/frontend.md, rules/library.md, CHANGELOG.md. Verification: features/guest-avatars/verifications/2026-07-17.md (PASS, 12 screenshots).
- Left undone: none for this feature. Deferred by plan review: mid-room photo change (applies on next connect); anon-avatar R2 cleanup rides with future account-upgrade-at-session-end feature.
- Surprises worth remembering: feat-003 cut only removed layers ABOVE BucketRepository — R2 infra was ship-ready. BucketBindingError is a layer-construction failure, not in a route program's E channel — catchTags on it is a TS error; Exit.match onFailure covers it (pattern documented in effect-trpc.ts:221-231).
