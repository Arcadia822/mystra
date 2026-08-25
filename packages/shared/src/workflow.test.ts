import { describe, expect, it } from "vitest";

import {
  FIXED_WORKFLOW_ID,
  fixedWorkflowDefinitionSchema,
  taskWorkflowStateSchema,
  taskWorkflowTransitionSchema,
  workflowCurrentResponseSchema,
  workflowTransitionRequestSchema,
  workspaceSkillProjectionSchema,
} from "./workflow.js";

const ids = Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

describe("fixed Workflow contracts", () => {
  it("accepts exactly the program-owned graph and rejects dangling or duplicate edges", () => {
    const definition = fixedWorkflowDefinitionSchema.parse({
      id: FIXED_WORKFLOW_ID,
      name: "Mystra Workflow",
      prompt: "Use the workload Workflow commands.",
      globalSkillNames: ["repository-development-guide"],
      initialStageId: "understand",
      stages: [
        { id: "understand", name: "Understand", instructions: "Understand the Task.", skillNames: ["idea-refine"], actions: [{ id: "understanding-complete", label: "Understanding complete", toStageId: "implement" }] },
        { id: "implement", name: "Implement", instructions: "Implement the change.", skillNames: ["incremental-implementation"], actions: [{ id: "implementation-complete", label: "Implementation complete", toStageId: "verify" }] },
        { id: "verify", name: "Verify", instructions: "Verify the result.", skillNames: ["code-review-and-quality"], actions: [
          { id: "verification-failed", label: "Verification failed", toStageId: "implement" },
          { id: "verification-passed", label: "Verification passed", toStageId: "completed" },
        ] },
        { id: "completed", name: "Completed", instructions: "Workflow complete.", skillNames: [], actions: [] },
      ],
    });
    expect(definition.id).toBe("mystra.workflow");
    expect(definition.stages.map(({ id }) => id)).toEqual(["understand", "implement", "verify", "completed"]);
    expect(() => fixedWorkflowDefinitionSchema.parse({
      ...definition,
      stages: definition.stages.map((stage) => stage.id === "understand"
        ? { ...stage, actions: [{ ...stage.actions[0]!, toStageId: "completed" }] }
        : stage),
    })).toThrow();
  });

  it("requires workload transition concurrency and retry identities", () => {
    expect(workflowTransitionRequestSchema.parse({
      commandId: ids[0], actionId: "implementation-complete", expectedStateVersion: 2,
    })).toEqual({ commandId: ids[0], actionId: "implementation-complete", expectedStateVersion: 2 });
    expect(() => workflowTransitionRequestSchema.parse({ actionId: "implementation-complete", expectedStateVersion: 2 })).toThrow();
    expect(() => workflowTransitionRequestSchema.parse({
      commandId: ids[0], actionId: "implementation-complete", expectedStateVersion: 0,
    })).toThrow();
  });

  it("returns exact Skill revisions and no caller-selected object identity", () => {
    const parsed = workflowCurrentResponseSchema.parse({
      workflow: { id: "mystra.workflow", name: "Mystra Workflow" },
      state: { stageId: "implement", stateVersion: 2, terminal: false },
      stage: { name: "Implement", instructions: "Implement the change." },
      requiredSkills: [{
        skillId: ids[1], revisionId: ids[2], revision: 3,
        path: `.mystra/skills/${ids[1]}`, zipSha256: "a".repeat(64),
      }],
      materialization: {
        workspaceId: ids[3], generation: 2, removals: [], entries: [{
          skillId: ids[1], revisionId: ids[2], relativePath: `.mystra/skills/${ids[1]}`,
          zipSha256: "a".repeat(64),
          manifest: [{ path: "SKILL.md", sizeBytes: 1, sha256: "b".repeat(64), mediaType: "text/markdown", previewability: "text" }],
          downloadPath: `/api/agent-execution/workflow/skills/${ids[1]}/revisions/${ids[2]}/download`,
        }],
      },
      availableActions: [{
        id: "implementation-complete", label: "Implementation complete", nextStageId: "verify",
      }],
      projection: { generation: 2, status: "ready", retryable: false },
    });
    expect(parsed.requiredSkills[0]?.revision).toBe(3);
    expect("taskId" in parsed).toBe(false);
    expect("stateId" in parsed).toBe(false);
  });

  it("keeps persisted state audit and transition versions internally consistent", () => {
    const active = {
      id: ids[0], teamId: ids[1], taskId: ids[2], workflowId: FIXED_WORKFLOW_ID,
      stageId: "understand" as const, stateVersion: 1, activeKey: FIXED_WORKFLOW_ID,
      enabledByUserId: ids[3], enableCommandId: ids[4], enabledAt: "2026-08-25T00:00:00.000Z",
      disabledByUserId: null, disableCommandId: null, disabledAt: null,
      updatedAt: "2026-08-25T00:00:00.000Z",
    };
    expect(taskWorkflowStateSchema.parse(active).activeKey).toBe(FIXED_WORKFLOW_ID);
    expect(() => taskWorkflowStateSchema.parse({ ...active, activeKey: null })).toThrow();
    expect(() => taskWorkflowTransitionSchema.parse({
      id: ids[5], workflowStateId: ids[0], teamId: ids[1], taskId: ids[2], sessionId: ids[6],
      commandId: ids[7], payloadHash: "a".repeat(64), actionId: "understanding-complete",
      fromStageId: "understand", toStageId: "implement", fromStateVersion: 1, toStateVersion: 3,
      occurredAt: "2026-08-25T00:00:00.000Z",
    })).toThrow();
  });

  it("requires bounded projection failure evidence", () => {
    const projection = {
      workspaceId: ids[0], skillId: ids[1], skillRevisionId: ids[2],
      relativePath: `.mystra/skills/${ids[1]}`, desiredGeneration: 2,
      appliedGeneration: null, status: "failed" as const, failureCode: "hash_mismatch",
      updatedAt: "2026-08-25T00:00:00.000Z",
    };
    expect(workspaceSkillProjectionSchema.parse(projection).failureCode).toBe("hash_mismatch");
    expect(() => workspaceSkillProjectionSchema.parse({ ...projection, failureCode: null })).toThrow();
  });
});
