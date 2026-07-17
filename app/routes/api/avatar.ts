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
  isAllowedAvatarType,
  isWithinAvatarSize,
  avatarKey,
  avatarImageUrl,
} from "@/lib/avatar";
import type { Route } from "./+types/avatar";

export async function action({ request, context }: Route.ActionArgs) {
  const session = await context.auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
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
