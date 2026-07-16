import { Data } from "effect";

export class RoomNotFoundError extends Data.TaggedError("RoomNotFoundError")<{
  readonly identifier: string;
}> {}

export class RoomClosedError extends Data.TaggedError("RoomClosedError")<{
  readonly roomId: string;
}> {}

export type RoomError = RoomNotFoundError | RoomClosedError;
