import { describe, expect, it, vi } from "vitest";

import { workflowSkillProjectionAssignmentSchema } from "@mystra/shared";

import { FIXED_WORKFLOW_DEFINITION } from "./fixed-workflow-definition";
import { WorkflowSkillExecutionDeliveryService } from "./workflow-skill-execution-delivery-service";

describe("fixed Workflow security boundaries", () => {
  it("keeps dynamic authority, execution credentials, absolute paths, content, and storage identity out of frozen guidance and assignment schemas", () => {
    expect(FIXED_WORKFLOW_DEFINITION.prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27}|stateVersion|revisionId|objectKey|execution.?code|\/Users\//iu);
    const valid = {
      workspaceId: "00000000-0000-4000-8000-000000000001", generation: 1, removals: [], entries: [{
        skillId: "00000000-0000-4000-8000-000000000002", revisionId: "00000000-0000-4000-8000-000000000003",
        relativePath: ".mystra/skills/00000000-0000-4000-8000-000000000002", zipSha256: "a".repeat(64),
        manifest: [{ path: "SKILL.md", sizeBytes: 1, sha256: "b".repeat(64), mediaType: "text/markdown", previewability: "text" }],
        downloadPath: "/api/agent-execution/workflow/skills/00000000-0000-4000-8000-000000000002/revisions/00000000-0000-4000-8000-000000000003/download",
      }],
    };
    expect(workflowSkillProjectionAssignmentSchema.parse(valid)).toEqual(valid);
    expect(() => workflowSkillProjectionAssignmentSchema.parse({ ...valid, objectKey: "private/key" })).toThrow();
    expect(() => workflowSkillProjectionAssignmentSchema.parse({
      ...valid, entries: [{ ...valid.entries[0], relativePath: "/Users/operator/.mystra/skills/private" }],
    })).toThrow();
  });

  it("returns one bounded scope error for an unauthorized exact Revision without reading Skill content", async () => {
    const preview = { download: vi.fn() };
    const service = new WorkflowSkillExecutionDeliveryService({
      db: { listWorkspaceSkillProjections: vi.fn(async () => []), reportWorkspaceSkillProjection: vi.fn() },
      execution: { resolveWorkflowExecution: vi.fn(async () => ({
        execution: { session: { teamId: crypto.randomUUID() }, workspace: { id: crypto.randomUUID() } },
      })) } as never,
      preview: preview as never,
    });
    await expect(service.download({ code: "secret-execution-code", skillId: crypto.randomUUID(), revisionId: crypto.randomUUID() }))
      .rejects.toMatchObject({ code: "scope_mismatch", message: "Workflow Skill is outside the Session capability" });
    expect(preview.download).not.toHaveBeenCalled();
  });
});
