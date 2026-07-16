# Feature: Analytics

**Status: cut 2026-07-16 by feat-008 (ui-overhaul).** See plan `plans/karaoke-ui-overhaul.html` decision 2 and `.brain/features/feature_list.json` (feat-004 evidence) for the record of what was removed and why.

## What it was

A read-only admin dashboard at `/admin` (the admin index route) showing user-growth time series, role/verification distribution charts, and recent-signup counts — all derived from the `user` table via `AnalyticsRepository` and a dedicated tRPC `analytics` router. It was boilerplate carried over from the cf-saas-starter template with no karaoke-specific value, so feat-008 Phase 2 cut it as part of stripping SaaS-boilerplate surfaces ahead of the karaoke reskin.

## What was removed

The whole chain: `AnalyticsRepository` (`app/repositories/analytics.ts`) was only ever consumed by the deleted `admin/_index.tsx` dashboard, so it — along with its unit tests, the `analytics` tRPC router (`app/trpc/routes/analytics.ts`), the chart components (`app/components/analytics/*`), `app/lib/insights.ts`, and `app/lib/schemas/analytics.ts` — was deleted in full. Nothing survives. `/admin/` now redirects to `/admin/users`, which stayed in scope per the ui-overhaul plan.

## Changelog

| Date | Type | Description |
|------|------|--------------|
| 2026-07-16 | brain | Tombstoned — feature cut by feat-008 Phase 2; whole chain deleted, no surviving layer. `/admin/` now redirects to `/admin/users`. |
| 2026-05-07 | brain | First per-feature memory; documented full procedure surface verified from `analytics.ts`. |
