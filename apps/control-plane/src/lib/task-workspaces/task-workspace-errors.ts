import type { TaskWorkspaceFailureCode } from "@mystra/shared";

const statusByCode: Record<TaskWorkspaceFailureCode, number> = {
  task_project_required: 409,
  repository_unavailable: 409,
  repository_branches_unavailable: 502,
  issue_branch_unavailable: 409,
  branch_invalid: 409,
  runtime_unavailable: 409,
  workspace_capability_unavailable: 409,
  workspace_already_prepared: 409,
  workspace_not_ready: 409,
  workspace_missing: 404,
  workspace_runtime_mismatch: 409,
  materialization_failed: 409,
  stale_workspace_attempt: 409,
};

export class TaskWorkspaceFailure extends Error {
  readonly code: TaskWorkspaceFailureCode;
  readonly status: number;

  constructor(code: TaskWorkspaceFailureCode, message: string, status = statusByCode[code]) {
    super(message);
    this.name = "TaskWorkspaceFailure";
    this.code = code;
    this.status = status;
  }
}
