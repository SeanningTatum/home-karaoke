# Feature: File Upload

**Status: cut 2026-07-16 by feat-008 (ui-overhaul).** See plan `plans/karaoke-ui-overhaul.html` decision 2 and `.brain/features/feature_list.json` (feat-003 evidence) for the record of what was removed and why.

## What it was

A server-side multipart upload endpoint (`POST /api/upload-file`) that wrote files to Cloudflare R2 via `BucketRepository`, fronted by a `<FileUpload>` UI dropzone component. It was boilerplate carried over from the cf-saas-starter template — no production karaoke surface ever called it — so feat-008 Phase 2 removed it as part of stripping SaaS-boilerplate surfaces ahead of the karaoke reskin.

## What was removed vs. what survives

- **Removed**: `app/components/file-upload.tsx` (UI component), `app/routes/api/upload-file.ts` (action handler), `app/lib/constants/upload.ts` (size/type allowlist), the `upload` i18n namespace (`app/locales/{en,zh}/upload.json`).
- **Survives**: `app/repositories/bucket.ts` (`BucketRepository`) + `app/services/bucket.ts` (`Bucket` Effect Tag/Layer) + `app/lib/schemas/bucket.ts` + `app/models/errors/bucket.ts` and their unit tests. The R2 binding and repo layer were kept — nothing in the karaoke app currently consumes them, but no other feature depended on the deletion, so the lower layer was left in place rather than torn out along with the UI/route.

## Changelog

| Date | Type | Description |
|------|------|--------------|
| 2026-07-16 | brain | Tombstoned — feature cut by feat-008 Phase 2; UI/route/i18n removed, `BucketRepository` layer retained. |
| 2026-05-07 | brain | First per-feature memory; documented real return shape (`key`, not `url`) and security gaps. |
