import type { WorkflowErrorCode } from "@mystra/shared";

export class WorkflowFailure extends Error {
  constructor(
    readonly code: WorkflowErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "WorkflowFailure";
  }
}

export function workflowHttpStatus(code: WorkflowErrorCode): number {
  switch (code) {
    case "workflow_task_not_found": return 404;
    case "workflow_forbidden": return 403;
    case "workflow_skill_resolution_failed": return 422;
    case "workflow_skill_projection_failed":
    case "control_plane_unavailable": return 503;
    case "invalid_request": return 400;
    default: return 409;
  }
}
