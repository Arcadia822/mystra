export type IssueTaskActionState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "error"; message: string }
  | { status: "linked"; taskId: string };

export function issueTaskActionInitial(taskId?: string): IssueTaskActionState {
  return taskId ? { status: "linked", taskId } : { status: "idle" };
}

export function issueTaskActionStarted(): IssueTaskActionState {
  return { status: "creating" };
}

export function issueTaskActionSucceeded(taskId: string): IssueTaskActionState {
  return { status: "linked", taskId };
}

export function issueTaskActionFailed(message: string): IssueTaskActionState {
  return { status: "error", message };
}
