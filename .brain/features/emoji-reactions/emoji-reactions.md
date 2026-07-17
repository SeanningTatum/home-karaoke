# Feature: Emoji Reactions

_Last updated: 2026-07-17_

## Purpose
Guests on phones send live emoji reactions while someone sings; emojis fly up the TV screen Google-Meet-style (WS broadcast via KaraokeRoom DO, pure reducers in room-state.ts); at end of each song the TV "next up" transition shows a 3-5s recap of reaction counts for the singer who just finished. Per-song counts live in DO memory only (reset per song).

## When It's Used
- TODO

## How It Works
TODO

### Persistence details
Persistence: none new — live reaction counts in KaraokeRoom DO memory per song; no D1 tables planned (recap is ephemeral).

### Testability
TODO

## Key Files

| File | Role |
|------|------|
| TODO | TODO |

## Dependencies
- TODO

## Tagged Errors
Tagged Errors: none expected — WS-only feature; invalid messages dropped by existing decodeClientMessage path.

## Changelog

| Date | Type | Description |
|------|------|--------------|
| 2026-07-17 | feature | Scoped and started; feature memo scaffolded. |
