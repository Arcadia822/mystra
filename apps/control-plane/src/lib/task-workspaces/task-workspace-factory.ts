import {
  isValidGitBranchName,
  workspaceBranchDecisionSchema,
  type WorkspaceBranchDecision,
} from "@mystra/shared";

import { TaskWorkspaceFailure } from "./task-workspace-errors";

export function taskFallbackBranch(taskId: string): WorkspaceBranchDecision {
  return workspaceBranchDecisionSchema.parse({
    branchName: `mystra/task-${taskId.toLowerCase().slice(0, 12)}`,
    strategy: "mystra-task-fallback-v1",
    source: "task-fallback",
  });
}

export function requireSafeGitBranchDecision(
  decision: WorkspaceBranchDecision,
): WorkspaceBranchDecision {
  if (!isValidGitBranchName(decision.branchName)) {
    throw new TaskWorkspaceFailure("branch_invalid", "Workspace branch name is invalid");
  }
  return workspaceBranchDecisionSchema.parse(decision);
}
