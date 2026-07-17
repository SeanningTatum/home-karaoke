# Run: emoji-reactions

_Started: 2026-07-17_
_Status: in-progress_

## Task

Guests on phones send live emoji reactions while someone sings; emojis fly up the TV screen (Google Meet style); at the end of each song, during the "next up" transition, the TV shows a short (3-5s) recap of how many reactions the finished singer got.

## Domain

mixed (DO/WS protocol + pure reducers + TV frontend + phone frontend)

## Plan

Coordinated multi-agent build (user requested coordinator + opus/sonnet subagents):

1. Explore agents map extension points (room-ws schema, room-state reducers, DO, useRoomSocket, TV route, join tabs).
2. Opus architect produces implementation blueprint (protocol messages, reducer changes, recap timing, animation approach).
3. Phase A (opus builder): WS protocol messages + pure reducers + DO wiring + useRoomSocket + unit tests.
4. Phase B (sonnet builders, parallel): phone reaction bar UI; TV flying-emoji overlay + end-of-song recap card.
5. effect-ts-enforcer review → fixes.
6. verify-done + feature-verifier browser walk.
7. Brain updates (feature MD, feature_list.json feat-010, CHANGELOG) + PR.

## Baseline

```
$ ./init.sh --baseline
typecheck:     PASS
test:          PASS
harness-check: PASS
Baseline green. Proceed to task.
```

(First run failed with `vitest: command not found` — fresh worktree, fixed by `bun install`.)

---
