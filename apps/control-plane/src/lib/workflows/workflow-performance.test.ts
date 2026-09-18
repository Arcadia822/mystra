import { describe, expect, it, vi } from "vitest";

import { ProgramOwnedFixedWorkflowRuntime } from "./fixed-workflow-runtime";
import { WorkflowSessionLaunchService } from "./workflow-session-launch-service";

describe("fixed Workflow bounded overhead", () => {
  it("performs exactly one state lookup and zero Skill/projection object I/O for an inactive Task", async () => {
    const getActiveTaskWorkflowState = vi.fn(async () => undefined);
    const skills = { reconcile: vi.fn() };
    const service = new WorkflowSessionLaunchService({
      db: { getActiveTaskWorkflowState }, runtime: new ProgramOwnedFixedWorkflowRuntime(), skills: skills as never,
    });
    const started = performance.now();
    await expect(service.prepare({
      teamId: crypto.randomUUID(), taskId: crypto.randomUUID(), sessionId: crypto.randomUUID(), workspaceId: crypto.randomUUID(),
    })).resolves.toBeUndefined();
    expect(performance.now() - started).toBeLessThan(100);
    expect(getActiveTaskWorkflowState).toHaveBeenCalledOnce();
    expect(skills.reconcile).not.toHaveBeenCalled();
  });
});
