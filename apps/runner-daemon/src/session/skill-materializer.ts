import { materializeWorkflowSkills, WorkflowMaterializationError } from "@mystra/agent-cli";
import type { SessionClaimAssignment, WorkflowSkillProjectionReport } from "@mystra/shared";

import type { SessionControlPlaneClient } from "./session-client.js";

export async function materializeAssignmentSkills(input: {
  assignment: SessionClaimAssignment;
  workspaceDirectory: string;
  client: Pick<SessionControlPlaneClient, "downloadWorkflowSkill" | "reportWorkflowSkills">;
}): Promise<void> {
  const desired = input.assignment.workflowSkills;
  if (!desired) return;
  try {
    await materializeWorkflowSkills({
      assignment: desired,
      workspaceDirectory: input.workspaceDirectory,
      download: (entry) => input.client.downloadWorkflowSkill(input.assignment, entry.downloadPath),
    });
    const report = reportFor(desired.entries.map(({ skillId }) => skillId), desired.workspaceId, desired.generation, "ready", null);
    if (!(await input.client.reportWorkflowSkills(input.assignment, report))) {
      throw new WorkflowMaterializationError("publish_failed", "Workflow Skill success report was stale");
    }
  } catch (error) {
    const code = error instanceof WorkflowMaterializationError ? error.code : "publish_failed";
    const report = reportFor(desired.entries.map(({ skillId }) => skillId), desired.workspaceId, desired.generation, "failed", code);
    await input.client.reportWorkflowSkills(input.assignment, report).catch(() => false);
    throw error;
  }
}

function reportFor(
  skillIds: string[], workspaceId: string, generation: number,
  status: "ready" | "failed", failureCode: string | null,
): WorkflowSkillProjectionReport {
  return { workspaceId, generation, results: skillIds.map((skillId) => ({ skillId, status, failureCode })) };
}
