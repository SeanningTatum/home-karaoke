// Guest avatar serving boundary — non-tRPC HTTP route. Per
// `.brain/rules/routes.md` "HTTP boundary routes", the Effect program builds
// a `Response` directly via `Effect.catchTags`, run with `runPromiseExit` +
// `Exit.match` rather than `runProcedure`. Public route — no auth: the
// userId is already broadcast in room state, so the URL leaks nothing new.
import { Effect, Exit } from "effect";
import { BucketRepository } from "@/repositories/bucket";
import { avatarKey } from "@/lib/avatar";
import type { Route } from "./+types/avatar.$userId";

export async function loader({ context, params }: Route.LoaderArgs) {
  const program = Effect.gen(function* () {
    const repo = yield* BucketRepository;
    const object = yield* repo.get(avatarKey(params.userId));

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: object.httpEtag,
      },
    });
  }).pipe(
    Effect.tapErrorCause((cause) => Effect.logError("Avatar fetch failed", cause)),
    Effect.catchTags({
      BucketNotFoundError: () => Effect.succeed(new Response("Not found", { status: 404 })),
      BucketGetError: () =>
        Effect.succeed(new Response("Internal Server Error", { status: 500 })),
    })
  );

  const exit = await context.runtime.runPromiseExit(program);
  return Exit.match(exit, {
    onSuccess: (response) => response,
    onFailure: () => new Response("Internal Server Error", { status: 500 }),
  });
}
