import { describe, expect, it } from "vitest";

import { FIXED_WORKFLOW_DEFINITION, resolveFixedWorkflowAction } from "./fixed-workflow-definition";

describe("FIXED_WORKFLOW_DEFINITION", () => {
  it("publishes the single program-owned Workflow and its exact Skills", () => {
    expect(FIXED_WORKFLOW_DEFINITION).toMatchObject({
      id: "mystra.workflow",
      initialStageId: "understand",
      globalSkillNames: ["repository-development-guide"],
    });
    expect(FIXED_WORKFLOW_DEFINITION.stages.map(({ id, skillNames }) => ({ id, skillNames }))).toEqual([
      { id: "understand", skillNames: ["idea-refine"] },
      { id: "implement", skillNames: ["incremental-implementation"] },
      { id: "verify", skillNames: ["code-review-and-quality"] },
      { id: "completed", skillNames: [] },
    ]);
  });

  it("resolves only Actions belonging to the authoritative current Stage", () => {
    expect(resolveFixedWorkflowAction("verify", "verification-failed")?.toStageId).toBe("implement");
    expect(resolveFixedWorkflowAction("verify", "verification-passed")?.toStageId).toBe("completed");
    expect(resolveFixedWorkflowAction("implement", "verification-passed")).toBeUndefined();
  });
});
