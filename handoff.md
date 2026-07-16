# Handoff: `brain watch` dashboard misses hand-authored run notes

**Date:** 2026-07-16
**Found in:** home-karaoke repo, feat-008 `ui-overhaul` run, `brain watch ui-overhaul` dashboard
**Audience:** brain-axi CLI maintainer
**Severity:** Medium — dashboard silently under-reports progress; no data loss

## Symptom

`brain watch ui-overhaul` → "Run steps" section showed **1 step** while 4 phases of work were logged. The single visible step was the only one written via `brain runs append`. Everything else (four detailed phase entries with verify output, decisions, file lists) was invisible to the dashboard, even though it sat in the same `runs/` folder.

Checkpoints section was fine (reads global `.brain/runs/progress.md`).

## Root cause

There are **two run-note channels** and the dashboard only reads one:

| Channel | File | Who writes it | Dashboard reads it? |
|---|---|---|---|
| CLI-managed | `.brain/features/<slug>/runs/<YYYY-MM-DD>-progress.md` | `brain runs append <slug> --step ... --observed ...` | ✅ |
| Hand-authored | `.brain/features/<slug>/runs/<YYYY-MM-DD>-<task>.md` (copied from `.brain/runs/_TEMPLATE.md`) | Agents following the repo's own recipe | ❌ |

The repo's harness **instructs** agents to use the second channel:

- `.brain/recipes/00-before-task.md` step 6: "Copy from `.brain/runs/_TEMPLATE.md`", filename `<date>-<task-slug>.md`
- `_TEMPLATE.md` defines a `## Step N — <label>` structure agents append to
- The `/start-task` command and the brain skill's execute playbook both point at this template flow

So an agent can follow the documented workflow perfectly and produce a run note the watch dashboard never renders. The two channels also fragment the record: step numbering in the CLI file restarts independently of the hand note's step sections.

## Concrete repro (this repo, this run)

1. `.brain/features/ui-overhaul/runs/2026-07-16-ui-overhaul-phase-1.md` — hand note from `_TEMPLATE.md`, contains full Phase 1–4 entries (builder output, verify tails). Created 2026-07-16 during feat-008.
2. One `brain runs append ui-overhaul --step "Phase 1 enforcer review..."` call → created `.brain/features/ui-overhaul/runs/2026-07-16-progress.md` with step 1.
3. `brain watch ui-overhaul` → Run steps renders only file (2) with its single step. File (1) not listed, not parsed, not linked.

## Workaround applied

Backfilled Phases 1–4 as `brain runs append` calls (steps 2–5 in `2026-07-16-progress.md`) and adopted a "mirror every phase into `runs append`" convention for the rest of the feature. Works, but duplicates content and depends on the coordinator remembering to do it.

## Suggested fixes (pick one, roughly in preference order)

1. **Watch reads all run notes.** `brain watch` (and `brain runs view`) already knows the merged layout; render every `*.md` under `features/<slug>/runs/` in the Run steps panel. Parse `## Step` / `### What was done` headings loosely; fall back to showing the file as a collapsible raw block when structure isn't recognized. No writer-side changes needed; existing repos' history lights up retroactively.
2. **Unify the channels.** Deprecate the `_TEMPLATE.md` copy flow: `brain runs open <slug> <task-slug>` scaffolds the note, `brain runs append` targets it (`--file` or most-recent), watch reads the one canonical file per task. Requires updating `00-before-task.md` step 6, `/start-task`, and the execute playbook in lockstep — otherwise agents keep writing orphan notes.
3. **Minimum: surface the gap.** Watch lists unparsed run-note files under Run steps as "N other run notes (not step-tracked)" with links, so a human at least sees the content exists. Cheap, honest, non-breaking.

Whichever lands, also update the help text `brain runs append` prints (it currently implies it is *the* step channel) and the `playbook execute` guidance so agents write to the channel the dashboard reads.

## Pointers

- CLI binary: `~/.nvm/versions/node/v22.14.0/bin/brain` (brain-axi; not on the public npm registry — `npx -y brain-axi` 404s, worth noting in skill docs that PATH install is required)
- Dashboard route: `http://127.0.0.1:4517/watch/<slug>` (review server, port 4517)
- Evidence files in this repo:
  - `.brain/features/ui-overhaul/runs/2026-07-16-ui-overhaul-phase-1.md` (invisible to watch)
  - `.brain/features/ui-overhaul/runs/2026-07-16-progress.md` (visible; steps 1–5 after backfill)
  - `.brain/recipes/00-before-task.md` step 6 + `.brain/runs/_TEMPLATE.md` (the workflow that produces invisible notes)
