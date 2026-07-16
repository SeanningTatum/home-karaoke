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

// The requested video exists but `status.embeddable` is `false` — raised
// by the `youtube.resolveVideo` tRPC procedure (app/trpc/routes/youtube.ts),
// not by the service itself, since embeddability is a business rule about
// what to do with the metadata rather than a fetch failure.
export class VideoNotEmbeddableError extends Data.TaggedError(
  "VideoNotEmbeddableError"
)<{
  readonly videoId: string;
}> {}

// `videos.list` (or the oEmbed fallback) returned no result for the given
// video id / URL — either it never existed or it's been removed/made
// private.
export class VideoNotFoundError extends Data.TaggedError("VideoNotFoundError")<{
  readonly videoId: string;
}> {}

// Stable client-visible discriminator: `appErrorToTRPC` prefixes the
// VideoNotEmbeddableError message with this exact string, and the client
// (search-tab) matches on it. Both sides import THIS constant, so the copy
// can never silently drift apart. (tRPC's wire shape only exposes the HTTP
// code + message; ValidationError shares BAD_REQUEST, so the message prefix
// is the only reliable signal without a custom error formatter.)
export const VIDEO_NOT_EMBEDDABLE_MESSAGE_PREFIX = "Video can't be embedded";

export type YouTubeError =
  | YouTubeQuotaExceededError
  | YouTubeUnavailableError
  | VideoNotEmbeddableError
  | VideoNotFoundError;
