// Guest avatar upload boundary — non-tRPC HTTP route. Per
// `.brain/rules/routes.md` "HTTP boundary routes", the Effect program builds
// a `Response` directly via `Effect.catchTags`, run with `runPromiseExit` +
// `Exit.match` rather than `runProcedure`.
import { Effect, Exit } from "effect";
import { BucketRepository } from "@/repositories/bucket";
import { UserRepository } from "@/repositories/user";
import { ValidationError } from "@/models/errors/repository";
import { BucketValidationError } from "@/models/errors/bucket";
import {
  MAX_AVATAR_BYTES,
  isAllowedAvatarType,
  isWithinAvatarSize,
  avatarKey,
  avatarImageUrl,
} from "@/lib/avatar";

// Multipart framing overhead margin on top of the raw file cap — lets a
// legitimate MAX_AVATAR_BYTES file through while still rejecting oversized
// bodies before `request.formData()` buffers them.
const MAX_UPLOAD_BODY_BYTES = MAX_AVATAR_BYTES + 64 * 1024;
import type { Route } from "./+types/avatar";

export async function action({ request, context }: Route.ActionArgs) {
  const session = await context.auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Reject oversized (or unsized — e.g. chunked) bodies before `formData()`
  // buffers them into Worker memory — the exact per-file guard below still
  // uses `file.size`. Browser fetch always sets Content-Length for FormData.
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? NaN : Number(contentLengthHeader);
  if (!Number.isFinite(contentLength) || contentLength > MAX_UPLOAD_BODY_BYTES) {
    return new Response("Payload Too Large", { status: 413 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  const program = Effect.gen(function* () {
    if (!(file instanceof File)) {
      return yield* Effect.fail(
        new ValidationError({ entity: "file", field: "file", message: "No file provided" })
      );
    }
    if (!isAllowedAvatarType(file.type)) {
      return yield* Effect.fail(
        new BucketValidationError({
          field: "file",
          message: "Unsupported file type",
        })
      );
    }
    if (!isWithinAvatarSize(file.size)) {
      return yield* Effect.fail(
        new BucketValidationError({
          field: "file",
          message: "File too large",
        })
      );
    }

    const repo = yield* BucketRepository;
    yield* repo.upload(file, {
      key: avatarKey(session.user.id),
      contentType: file.type,
    });

    const url = avatarImageUrl(session.user.id, Date.now());

    const userRepo = yield* UserRepository;
    yield* userRepo.setUserImage({ userId: session.user.id, image: url });

    return Response.json({ url });
  }).pipe(
    Effect.tapErrorCause((cause) => Effect.logError("Avatar upload failed", cause)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(new Response(e.message, { status: 400 })),
      BucketValidationError: (e) => Effect.succeed(new Response(e.message, { status: 400 })),
      BucketUploadError: () =>
        Effect.succeed(new Response("Internal Server Error", { status: 500 })),
      UpdateError: () =>
        Effect.succeed(new Response("Internal Server Error", { status: 500 })),
    })
  );

  const exit = await context.runtime.runPromiseExit(program);
  return Exit.match(exit, {
    onSuccess: (response) => response,
    onFailure: () => new Response("Internal Server Error", { status: 500 }),
  });
}
