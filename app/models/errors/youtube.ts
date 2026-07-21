import { Data } from "effect";

// Raised by `app/services/youtube.ts` when the YouTube Data API itself
// returns HTTP 403 with `errors[].reason === "quotaExceeded"`. Distinct
// from `YouTubeUnavailableError` because the client reacts differently:
// this one means "stop calling search, switch to paste-a-link" rather than
// "transient upstream failure".
export class YouTubeQuotaExceededError extends Data.TaggedError(
  "YouTubeQuotaExceededError"
)<{
  readonly cause?: unknown;
}> {}

// Any other YouTube Data API failure — non-403 HTTP errors, network
// failures, malformed responses, or a 403 whose reason isn't
// "quotaExceeded".
export class YouTubeUnavailableError extends Data.TaggedError(
  "YouTubeUnavailableError"
)<{
  readonly cause?: unknown;
}> {}

// `videos.list` (or the oEmbed fallback) returned no result for the given
// video id / URL — either it never existed or it's been removed/made
// private.
export class VideoNotFoundError extends Data.TaggedError("VideoNotFoundError")<{
  readonly videoId: string;
}> {}

export type YouTubeError =
  | YouTubeQuotaExceededError
  | YouTubeUnavailableError
  | VideoNotFoundError;
