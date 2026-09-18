import { describe, expect, it, vi } from "vitest";

import { WorkflowFailure } from "./workflow-errors";
import { WorkflowManagementService } from "./workflow-management-service";

const ids = Array.from({ length: 12 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const now = "2026-08-25T00:00:00.000Z";

function activeState() {
  return {
    id: ids[2]!, teamId: ids[0]!, taskId: ids[1]!, workflowId: "mystra.workflow" as const,
    stageId: "understand" as const, stateVersion: 1, activeKey: "mystra.workflow" as const,
    enabledByUserId: ids[3]!, enableCommandId: ids[4]!, enabledAt: now,
    disabledByUserId: null, disableCommandId: null, disabledAt: null, updatedAt: now,
  };
}

function setup(options: { active?: boolean; missingSkill?: string } = {}) {
  const state = activeState();
  const skillNames = ["repository-development-guide", "idea-refine", "incremental-implementation", "code-review-and-quality"];
  const db = {
    getTask: vi.fn(async () => ({ id: ids[1], teamId: ids[0] })),
    getActiveTaskWorkflowState: vi.fn(async () => options.active ? state : undefined),
    listSkillRecords: vi.fn(async ({ query }: { query?: string }) => ({
      items: query === options.missingSkill ? [] : [{
        id: ids[5], teamId: ids[0], name: query, activeName: query, status: "active",
        currentRevisionId: ids[6], resourceRevision: 1, createdByUserId: ids[3],
        createdAt: now, updatedAt: now, archivedByUserId: null, archivedAt: null,
      }], nextCursor: null,
    })),
    getSkillRevisionRecord: vi.fn(async () => ({
      id: ids[6], skillId: ids[5], baseRevisionId: null, sequence: 1,
      publicationStatus: "ready", description: "Ready", manifest: [],
      compressedSizeBytes: 1, uncompressedSizeBytes: 1,
      zipSha256: "a".repeat(64), contentSha256: "b".repeat(64), objectKey: "private",
      createdByUserId: ids[3], createdAt: now, readyAt: now, failedAt: null, failureCode: null,
    })),
    enableTaskWorkflow: vi.fn(async ({ state: requested }: { state: ReturnType<typeof activeState> }) => ({ state: requested, created: true })),
    disableTaskWorkflow: vi.fn(async () => ({ state: {
      ...state, activeKey: null, stateVersion: 2, disabledByUserId: ids[3],
      disableCommandId: ids[7], disabledAt: now, updatedAt: now,
    }, created: true })),
  };
  return { db, state, skillNames, service: new WorkflowManagementService({
    db: db as never, now: () => now, newId: () => ids[2]!,
  }) };
}

describe("WorkflowManagementService", () => {
  it("allows only Owner/Admin and resolves every fixed Skill before creating state", async () => {
    const { service, db, skillNames } = setup();
    await expect(service.enable({
      teamId: ids[0]!, taskId: ids[1]!, actor: { userId: ids[3]!, role: "member" },
      request: { commandId: ids[4] },
    })).rejects.toEqual(expect.objectContaining<Partial<WorkflowFailure>>({ code: "workflow_forbidden" }));
    expect(db.enableTaskWorkflow).not.toHaveBeenCalled();

    await expect(service.enable({
      teamId: ids[0]!, taskId: ids[1]!, actor: { userId: ids[3]!, role: "admin" },
      request: { commandId: ids[4] },
    })).resolves.toMatchObject({ workflow: { id: "mystra.workflow", stageId: "understand", active: true } });
    expect(db.listSkillRecords.mock.calls.map(([input]) => input.query)).toEqual(skillNames);
    expect(db.enableTaskWorkflow).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a required fixed Skill is unavailable", async () => {
    const { service, db } = setup({ missingSkill: "idea-refine" });
    await expect(service.enable({
      teamId: ids[0]!, taskId: ids[1]!, actor: { userId: ids[3]!, role: "owner" },
      request: { commandId: ids[4] },
    })).rejects.toEqual(expect.objectContaining<Partial<WorkflowFailure>>({ code: "workflow_skill_resolution_failed" }));
    expect(db.enableTaskWorkflow).not.toHaveBeenCalled();
  });

  it("returns an existing active state without resetting or re-running preflight", async () => {
    const { service, db, state } = setup({ active: true });
    await expect(service.enable({
      teamId: ids[0]!, taskId: ids[1]!, actor: { userId: ids[3]!, role: "owner" },
      request: { commandId: ids[7] },
    })).resolves.toMatchObject({ workflow: { stateId: state.id, stateVersion: 1 } });
    expect(db.listSkillRecords).not.toHaveBeenCalled();
    expect(db.enableTaskWorkflow).not.toHaveBeenCalled();
  });

  it("disables by CAS and reports logical cleanup committed", async () => {
    const { service, db } = setup({ active: true });
    await expect(service.disable({
      teamId: ids[0]!, taskId: ids[1]!, actor: { userId: ids[3]!, role: "admin" },
      request: { commandId: ids[7], expectedStateVersion: 1 },
    })).resolves.toMatchObject({
      workflow: { active: false, stateVersion: 2 },
      projectionCleanup: { status: "pending", retryable: true },
    });
    expect(db.disableTaskWorkflow).toHaveBeenCalledWith(expect.objectContaining({ workflowStateId: ids[2], expectedStateVersion: 1 }));
  });
});
