import type { TaskWorkspaceView } from "@mystra/shared";

export type TaskWorkspacePresentation = {
  state: "absent" | TaskWorkspaceView["state"];
  canSetup: boolean;
  canRetry: boolean;
  canStartSession: boolean;
  runtimeLocked: boolean;
  reason: string | null;
};

export function taskWorkspacePresentation(
  workspace: TaskWorkspaceView | undefined,
  hasProject: boolean,
): TaskWorkspacePresentation {
  if (!workspace) {
    return {
      state: "absent",
      canSetup: hasProject,
      canRetry: false,
      canStartSession: false,
      runtimeLocked: false,
      reason: hasProject ? null : "task_project_required",
    };
  }
  return {
    state: workspace.state,
    canSetup: false,
    canRetry: workspace.state === "failed",
    canStartSession: workspace.state === "ready",
    runtimeLocked: true,
    reason: workspace.failure?.code ?? null,
  };
}
