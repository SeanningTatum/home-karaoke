export * from "./repository";
export * from "./bucket";
export * from "./workflow";
export * from "./room";
export * from "./youtube";

import type { RepositoryError } from "./repository";
import type { BucketError } from "./bucket";
import type { WorkflowError } from "./workflow";
import type { RoomError } from "./room";
import type { YouTubeError } from "./youtube";

export type AppError =
  | RepositoryError
  | BucketError
  | WorkflowError
  | RoomError
  | YouTubeError;
