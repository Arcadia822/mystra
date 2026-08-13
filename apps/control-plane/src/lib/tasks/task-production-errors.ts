import type { TaskProductionErrorCode } from "@mystra/shared";

export class TaskProductionFailure extends Error {
  readonly code: TaskProductionErrorCode;

  constructor(code: TaskProductionErrorCode, message: string) {
    super(message);
    this.name = "TaskProductionFailure";
    this.code = code;
  }
}
