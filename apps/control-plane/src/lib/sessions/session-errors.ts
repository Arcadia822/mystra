export type SessionFailureCode =
  | "session_not_found"
  | "task_not_found"
  | "project_not_found"
  | "task_project_mismatch"
  | "agent_unavailable"
  | "runtime_unavailable"
  | "provider_unavailable"
  | "workspace_unavailable"
  | "workspace_not_ready"
  | "workspace_missing"
  | "workspace_runtime_mismatch"
  | "session_busy"
  | "session_terminal"
  | "session_conflict"
  | "lease_invalid";

export class SessionFailure extends Error {
  constructor(readonly code: SessionFailureCode, message: string) {
    super(message);
    this.name = "SessionFailure";
  }
}
