import { Schema } from "effect";

export const YouTubeSearchInput = Schema.Struct({
  query: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
  roomId: Schema.String,
});
export type YouTubeSearchInput = typeof YouTubeSearchInput.Type;

// Either `videoId` (picked from search results) or `url` (pasted link) must
// be provided — enforced by the `Schema.filter` below rather than a Union,
// so a caller sending neither/both gets one clear validation error instead
// of tRPC's less legible union-mismatch message.
export const YouTubeResolveVideoInput = Schema.Struct({
  videoId: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  searchLogId: Schema.optional(Schema.String),
  roomId: Schema.String,
}).pipe(
  Schema.filter(
    (input) => Boolean(input.videoId) || Boolean(input.url),
    {
      identifier: "YouTubeResolveVideoInput",
      message: () => "Provide either videoId or url",
    }
  )
);
export type YouTubeResolveVideoInput = typeof YouTubeResolveVideoInput.Type;
