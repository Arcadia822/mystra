import { describe, expect, it, vi } from "vitest";

import { ProgramOwnedFixedWorkflowRuntime } from "./fixed-workflow-runtime";
import { WorkflowSkillProjectionService } from "./workflow-skill-projection-service";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const timestamp = "2026-08-25T00:00:00.000Z";

describe("WorkflowSkillProjectionService", () => {
  it("resolves fixed names to exact ready revisions and preserves two logical sources for one aggregate Skill", async () => {
    const skillId = id(10);
    const revisionId = id(11);
    const runtime = new ProgramOwnedFixedWorkflowRuntime();
    const duplicateRuntime = {
      definition: runtime.definition,
      stage: runtime.stage.bind(runtime),
      action: runtime.action.bind(runtime),
      skills: () => [{ name: "repository-development-guide", scope: "global" as const }, { name: "repository-development-guide", scope: "stage:understand" as const }],
    };
    const replaceWorkflowSkillSources = vi.fn(async ({ sources }: { sources: Array<{ skillId: string; desiredGeneration: number; workspaceId: string; skillRevisionId: string; relativePath: string }> }) => [{
      workspaceId: sources[0]!.workspaceId, skillId, skillRevisionId: revisionId,
      relativePath: sources[0]!.relativePath, desiredGeneration: sources[0]!.desiredGeneration,
      appliedGeneration: null, status: "pending" as const, failureCode: null, updatedAt: timestamp,
    }]);
    const service = new WorkflowSkillProjectionService({
      runtime: duplicateRuntime,
      db: {
        listSkillRecords: vi.fn(async () => ({ items: [{
          id: skillId, teamId: id(1), name: "repository-development-guide", activeName: "repository-development-guide",
          status: "active", currentRevisionId: revisionId, resourceRevision: 1, createdByUserId: id(2),
          createdAt: timestamp, updatedAt: timestamp, archivedByUserId: null, archivedAt: null,
        }], nextCursor: null })),
        getSkillRevisionRecord: vi.fn(async () => ({
          id: revisionId, skillId, baseRevisionId: null, sequence: 3, publicationStatus: "ready",
          description: "fixed", manifest: [{ path: "SKILL.md", sizeBytes: 1, sha256: "a".repeat(64), mediaType: "text/markdown", previewability: "text" }],
          compressedSizeBytes: 1, uncompressedSizeBytes: 1, zipSha256: "b".repeat(64), contentSha256: "c".repeat(64),
          objectKey: "private", createdByUserId: id(2), createdAt: timestamp, readyAt: timestamp, failedAt: null, failureCode: null,
        })),
        replaceWorkflowSkillSources,
        listWorkspaceSkillProjections: vi.fn(),
      } as never,
    });
    const result = await service.reconcile({
      teamId: id(1), workspaceId: id(3), state: {
        id: id(4), teamId: id(1), taskId: id(5), workflowId: "mystra.workflow", stageId: "understand",
        stateVersion: 7, activeKey: "mystra.workflow", enabledByUserId: id(2), enableCommandId: id(6),
        enabledAt: timestamp, disabledByUserId: null, disableCommandId: null, disabledAt: null, updatedAt: timestamp,
      },
    });
    expect(result.sources).toHaveLength(2);
    expect(result.requiredSkills).toEqual([{ skillId, revisionId, revision: 3, path: `.mystra/skills/${skillId}`, zipSha256: "b".repeat(64) }]);
    expect(result.artifacts[0]).not.toHaveProperty("objectKey");
    expect(replaceWorkflowSkillSources.mock.calls[0]![0]).toMatchObject({ desiredGeneration: 7 });
  });

  it("fails closed when a fixed Skill is missing instead of substituting a filesystem or plugin source", async () => {
    const service = new WorkflowSkillProjectionService({
      runtime: new ProgramOwnedFixedWorkflowRuntime(),
      db: {
        listSkillRecords: vi.fn(async () => ({ items: [], nextCursor: null })),
        getSkillRevisionRecord: vi.fn(), replaceWorkflowSkillSources: vi.fn(), listWorkspaceSkillProjections: vi.fn(),
      } as never,
    });
    await expect(service.resolve({ teamId: id(1), workspaceId: id(2), workflowStateId: id(3), stageId: "understand", generation: 1 }))
      .rejects.toMatchObject({ code: "workflow_skill_resolution_failed" });
  });
});
