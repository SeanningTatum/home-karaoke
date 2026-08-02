# Run — Template sync: cf-saas-starter-react-router v1.2.0 → v1.7.0

- **Date**: 2026-08-01
- **Branch**: `chore/sync-template-v1.7.0`
- **Type**: cross-cutting (no single feature slug — touches harness, CI, and app code)
- **Scope**: 4 template groups, ported as 4 commits. No feature status flipped.

## Task framing

"Update our repo with the latest changes from the template." home-karaoke was created
from `SeanningTatum/cf-saas-starter-react-router` via GitHub's *Use this template*, which
produces **unrelated git history** — `git merge-base` returns nothing, so a merge or rebase
is impossible. This is a diff-port.

**Fork point**: template `613c790` (v1.2.0, PR #11 "audit remediation"). Found by
tree-comparing our initial commit `005640f` against each of the last 40 upstream commits and
taking the minimum file-difference count (26 differing files, all README/.brain/wrangler/package
naming). Upstream had moved 18 commits ahead to `e8dd532` (v1.7.0).

A `template` git remote was added and points at upstream, so the next sync starts from
`git fetch template` rather than re-deriving all of this.

## Baseline

`./init.sh --baseline` → typecheck PASS, test PASS (552 tests / 40 files), harness-check PASS.

## What was ported

| Group | Upstream | Commit |
|-------|----------|--------|
| 1. Setup security | #15 | `2bc37ac` |
| 2. Harness / tooling | #14, #16, #18, #21, #22, #23 | `d059e67` |
| 3. OTel tracing | #20 | `d500579` |
| 4. CI/CD | #12, plus the ci.yml rewrite from #22/#23 | `9956e3b` |

Deliberately **not** ported:

- `app/trpc/routes/analytics.ts` — feat-004 was cut from this repo (tombstone doc exists).
- README + `docs/assets/harness-loop.{gif,mp4}` — this repo has its own marketing README
  with its own screenshots (PR #15).
- Upstream #17 (`fix(trpc): tell tRPC it is in production`) — already here as `94f0ea0`;
  `app/trpc/index.ts` was verified byte-identical to `template/main`. Its **doc** half was
  missing though, and got ported into `rules/routes.md`.

## Steps and observations

1. **Classified every upstream-changed file** three ways — `ours == template@fork` (safe
   overwrite), `ours diverged` (hand-merge), `absent here` (new file). Only 11 files were
   genuinely diverged; the rest were mechanical.
   *(Gotcha: zsh does not word-split unquoted expansions, so the first attempt at this loop
   silently treated the whole file list as one item. Redone with `while IFS= read -r`.)*

2. **The new gates immediately failed on pre-existing debt**, which is the point of them:
   - `brain check` — 3 verification docs had verdict lines the single parser can't read
     (`✅ **PASS**` with the word bolded; `🚫` instead of `⛔`), and `layout-evolution` +
     `party-screen-cinema` were missing from `features/index.md`. **Real drift — fixed.**
   - `brain check --strict` — 12 shipped features carry no commit-bound verification receipt,
     and 3 have no verification doc at all. **Not fixable without fabricating evidence.**
     Used upstream's own mechanism: `policy.strict_grandfathered` in `feature_list.json`.
     The gate itself rejected `file-upload`/`analytics` on that list ("status cut, not
     shipped"), which is a good sign the ratchet is real. Result: strict reports `0 evaluated`
     and harness-check prints `⊘`, explicitly *not* a ✓.
   - `check-non-negotiables.ts` — 11 violations in existing karaoke code. All four files are
     structurally outside Effect (raw DO, Better Auth browser form, pure sync parser,
     canvas-only helper), so they went on the same kind of enumerable grandfather list with
     inline rationale. `downscale.ts` already documented its own untestability in a header
     comment.

3. **Tracing hand-merge.** `runProcedure`'s body was identical to upstream's, so the options
   arg applied cleanly. `runtime.ts` and `router.ts` needed the hunks placed by hand around
   karaoke's extra services (`YouTubeLive`, `KaraokeRoomsLive`) and routers.

4. **Span coverage gap found.** Upstream instrumented only its own routers, which would have
   left `room.*` and `youtube.*` (7 procedures) dark while `rules/routes.md` claimed every
   procedure carries a span. Delegated to the `span-instrumenter` sub-agent — the very agent
   this sync introduced. Now 17/17.

5. **`service.name` was still `cf-saas-starter`** in `tracing.ts`, its tests and the doc.
   Renamed to `home-karaoke`; otherwise these traces would show up in a collector under the
   template's identity.

6. **Dangling cross-repo references.** The new `.claude` files and the ported recipe pointed
   at four upstream `.brain` paths. `observability.md` and `add-premium-surface.md` were real
   docs and were ported. The other two were upstream *run notes* — importing them would put
   events that never happened into this repo's history, so the references were rewritten to
   cite the template instead. One of them asserted the app-wide focus ring is broken; that
   claim was softened to "not proven to paint here", since it was not re-confirmed against
   this repo's Velvet Stage tokens. **Open question, not a finding.**

7. **`rule-router` needed a karaoke layer.** `app/durable-objects/*` matched no glob, so DO
   edits routed nowhere. Mapped to `cloudflare` (where the DO is already documented) in both
   the hook and `rules/index.md`; the hook's own sync test pins the pair. Router tests 38 → 39.

8. **CI bun pin deviated from upstream.** Upstream pins `1.2.19`; this repo's `bun.lock`
   (lockfileVersion 1) is written by local bun `1.3.0`. Pinned to `1.3.0` — upstream's intent
   is reproducibility, not that specific version, and pinning below the lockfile writer risks
   a `--frozen-lockfile` mismatch.

## Production deploy — flagged and confirmed

`deploy.yml` ships from upstream as opt-in, gated on `vars.CLOUDFLARE_ACCOUNT_ID != ''`.
**That variable and the `CLOUDFLARE_API_TOKEN` secret are both already set on this repo**
(both dated 2026-07-16), so it is *not* dormant here: merging arms it, and the next green CI
run on `main` performs remote D1 migrations + `wrangler deploy` — which would be this app's
**first ever production deploy**, since v0.1.0 was tagged but never deployed.

Raised with the user before adding the file. Options offered: armed / manual-only
(`workflow_dispatch`) / gated behind a new unset flag / skip. **User chose armed.** Ported
verbatim and called out at the top of the PR body.

## Verification

`CI=1 brain verify --stage verify` → **7/7 pass**:

```
typecheck,pass,0,1.6
test,pass,0,4.5
non-negotiables-selftest,pass,0,0.1
non-negotiables,pass,0,0.2
harness,pass,0,4.5
build,pass,0,12.3
e2e,pass,0,15.4
```

`./scripts/harness-check.sh` → 10 passed, 0 failed, 1 skipped (the honest strict skip).
Suite: 552 → 614 tests, 40 → 42 files. 64 files changed, +5325 / −306.

No browser walk: this sync changes no user-visible surface. Tracing is dark by default
(`OTEL_EXPORTER_OTLP_ENDPOINT` unset), and every span addition is a third argument to
`runProcedure` with no effect on responses.

## Follow-ups

- **Production deploy will fire on merge.** Watch the `Deploy Production` workflow; it runs
  `db:migrate:remote` against production D1 first.
- **Close the strict ratchet one feature at a time**: `brain playbook verify` → feature-verifier
  browser walk → `brain receipt <slug>` → delete the slug from `policy.strict_grandfathered`.
  12 slugs are on it. Same for the 4 entries on the try/catch and test-parity lists.
- `.mcp.json` declares a Refero MCP server needing `REFERO_MCP_TOKEN`; unset, it just fails to
  connect. Delete the file if the claude.ai Refero connector is preferred.
- `.claude/settings.json` enables `ui-ux-pro-max` from a **third-party** marketplace
  (`nextlevelbuilder/ui-ux-pro-max-skill`) and drops `frontend-design`. Inherited from upstream
  #21 — worth a look before relying on it.
- Verify the focus ring actually paints (see step 6) — currently an open question in
  `ui-builder.md`, not a confirmed defect.
