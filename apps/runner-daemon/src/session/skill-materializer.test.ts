import { describe, expect, it, vi } from "vitest";

import type { SessionClaimAssignment } from "@mystra/shared";

const materializer = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@mystra/agent-cli", async (load) => {
  const actual = await load<typeof import("@mystra/agent-cli")>();
  return { ...actual, materializeWorkflowSkills: materializer.run };
});

import { materializeAssignmentSkills } from "./skill-materializer.js";

const assignment = {
  session: { id: "00000000-0000-4000-8000-000000000001" },
  workflowSkills: {
    workspaceId: "00000000-0000-4000-8000-000000000002", generation: 3, removals: [], entries: [{
      skillId: "00000000-0000-4000-8000-000000000003", revisionId: "00000000-0000-4000-8000-000000000004",
      relativePath: ".mystra/skills/00000000-0000-4000-8000-000000000003", zipSha256: "a".repeat(64),
      manifest: [{ path: "SKILL.md", sizeBytes: 1, sha256: "b".repeat(64), mediaType: "text/markdown", previewability: "text" }],
      downloadPath: "/api/runner/sessions/00000000-0000-4000-8000-000000000001/skills/00000000-0000-4000-8000-000000000003/revisions/00000000-0000-4000-8000-000000000004/download",
    }],
  },
} as unknown as SessionClaimAssignment;

describe("Runner Workflow Skill materializer", () => {
  it("reports the same desired generation ready only after the shared materializer succeeds", async () => {
    materializer.run.mockResolvedValueOnce(undefined);
    const reportWorkflowSkills = vi.fn(async (_assignment: SessionClaimAssignment, _report: unknown) => true);
    await materializeAssignmentSkills({
      assignment, workspaceDirectory: "/workspace",
      client: { downloadWorkflowSkill: vi.fn(), reportWorkflowSkills },
    });
    expect(reportWorkflowSkills).toHaveBeenCalledWith(assignment, {
      workspaceId: assignment.workflowSkills!.workspaceId, generation: 3,
      results: [{ skillId: assignment.workflowSkills!.entries[0]!.skillId, status: "ready", failureCode: null }],
    });
  });

  it("reports a bounded failed status and refuses Provider progress when materialization fails", async () => {
    materializer.run.mockRejectedValueOnce(new Error("private filesystem details"));
    const reportWorkflowSkills = vi.fn(async (_assignment: SessionClaimAssignment, _report: unknown) => true);
    await expect(materializeAssignmentSkills({
      assignment, workspaceDirectory: "/workspace",
      client: { downloadWorkflowSkill: vi.fn(), reportWorkflowSkills },
    })).rejects.toThrow("private filesystem details");
    expect(reportWorkflowSkills.mock.calls[0]![1]).toEqual({
      workspaceId: assignment.workflowSkills!.workspaceId, generation: 3,
      results: [{ skillId: assignment.workflowSkills!.entries[0]!.skillId, status: "failed", failureCode: "publish_failed" }],
    });
  });
});
