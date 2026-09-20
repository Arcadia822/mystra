import { describe, expect, it } from "vitest";

import {
  DEFAULT_TASK_INITIAL_INSTRUCTION,
  DEFAULT_WORKLOAD_CAPABILITIES,
  taskExecutionContextSchema,
  taskStartRequestSchema,
  taskExecutionContextPayloadSchema,
  workloadExecutionContextSchema,
  workloadExecutionIdentitySchema,
} from "./task-execution-context.js";

const ids = Array.from({ length: 12 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

describe("TaskExecutionContext contracts", () => {
  it("keeps Workflow workload capabilities explicit and static", () => {
    expect(DEFAULT_WORKLOAD_CAPABILITIES).toEqual([
      "context:read", "task-status:read", "task-status:transition",
    ]);
    const workflowCapabilities = [
      "workflow:read", "workflow:transition", "workflow:projection:read", "workflow:projection:report",
    ];
    expect(() => workloadExecutionContextSchema.shape.capabilities.parse(workflowCapabilities)).not.toThrow();
  });

  it("models an executionContext without inventing a parallel lifecycle", () => {
    const parsed = taskExecutionContextSchema.parse({
      id: ids[0], teamId: ids[1], taskId: ids[2], projectId: ids[3],
      agentId: ids[4], agentName: "Reviewer", agentRevision: 2, agentSystemPrompt: "Implement the change.",
      taskTitle: "Frozen title", taskDescription: null, taskIssue: null,
      initialInstruction: "Deliver the design document.",
      runtimeId: ids[5], providerKey: "codex", workspaceId: null,
      plannedSessionId: ids[6], sessionId: null, firstMessageId: ids[7],
      assignIdempotencyKey: "assign-1", assignRequestFingerprint: "a".repeat(64),
      capabilityRevokedAt: null, setupFailureCode: null, setupFailureMessage: null,
      createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
    });
    expect(parsed.sessionId).toBeNull();
    expect("status" in parsed).toBe(false);
    expect("executionCode" in parsed).toBe(false);
  });

  it("treats omitted and null Agent selection as the same Start intent", () => {
    const base = {
      runtimeId: ids[5], providerKey: "codex", expectedRevision: 1, idempotencyKey: "start-052",
    };
    const neutral = { ...base, agentId: null, initialInstruction: DEFAULT_TASK_INITIAL_INSTRUCTION };
    expect(taskStartRequestSchema.parse(base)).toEqual(neutral);
    expect(taskStartRequestSchema.parse({ ...base, agentId: null })).toEqual(neutral);
    expect(taskStartRequestSchema.parse({ ...base, agentId: ids[4] }).agentId).toBe(ids[4]);
    expect(() => taskStartRequestSchema.parse({ ...base, agentId: "" })).toThrow();
  });

  it("resolves one platform-owned neutral first instruction at the request boundary", () => {
    const base = {
      runtimeId: ids[5], providerKey: "codex", expectedRevision: 1, idempotencyKey: "start-059",
    };
    expect(taskStartRequestSchema.parse(base).initialInstruction).toBe(DEFAULT_TASK_INITIAL_INSTRUCTION);
    expect(taskStartRequestSchema.parse({ ...base, initialInstruction: "  Write the design document.  " }).initialInstruction)
      .toBe("Write the design document.");
    expect(() => taskStartRequestSchema.parse({ ...base, initialInstruction: "   " })).toThrow();
    expect(() => taskStartRequestSchema.parse({ ...base, initialInstruction: "x".repeat(64 * 1024 + 1) })).toThrow();
  });

  it("requires the optional TaskExecutionContext Agent snapshot to be wholly present or absent", () => {
    const withAgent = taskExecutionContextSchema.parse({
      id: ids[0], teamId: ids[1], taskId: ids[2], projectId: ids[3],
      agentId: ids[4], agentName: "Reviewer", agentRevision: 2, agentSystemPrompt: "Review precisely.",
      taskTitle: "Frozen title", taskDescription: null, taskIssue: null,
      initialInstruction: "Deliver the design document.",
      runtimeId: ids[5], providerKey: "codex", workspaceId: null,
      plannedSessionId: ids[6], sessionId: null, firstMessageId: ids[7],
      assignIdempotencyKey: "start-052", assignRequestFingerprint: "a".repeat(64),
      capabilityRevokedAt: null, setupFailureCode: null, setupFailureMessage: null,
      createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
    });
    expect(withAgent.agentName).toBe("Reviewer");
    expect(taskExecutionContextSchema.parse({
      ...withAgent,
      agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null,
    }).agentId).toBeNull();
    expect(() => taskExecutionContextSchema.parse({ ...withAgent, agentId: null })).toThrow();
  });

  it("requires exact execution scope and bounded capabilities", () => {
    expect(workloadExecutionIdentitySchema.parse({
      teamId: ids[1], taskId: ids[2], executionContextId: ids[0], sessionId: ids[6],
      agentContext: { agentId: ids[4], name: "Reviewer", revision: 2 },
      expiresAt: "2026-08-11T06:00:00.000Z",
    }).agentContext?.revision).toBe(2);
    expect(workloadExecutionIdentitySchema.parse({
      teamId: ids[1], taskId: ids[2], executionContextId: ids[0], sessionId: ids[6],
      agentContext: null, expiresAt: "2026-08-11T06:00:00.000Z",
    }).agentContext).toBeNull();
    expect(() => workloadExecutionIdentitySchema.parse({
      teamId: ids[1], taskId: ids[2], executionContextId: ids[0], agentContext: null,
      expiresAt: "2026-08-11T06:00:00.000Z",
    })).toThrow();
  });

  it("keeps host root local to the CLI-composed context", () => {
    const logical = taskExecutionContextPayloadSchema.parse({
      version: 1,
      execution: {
        teamId: ids[1], taskId: ids[2], executionContextId: ids[0], sessionId: ids[6],
        agentContext: null, expiresAt: "2026-08-11T06:00:00.000Z",
      },
      task: { title: "Frozen title", description: null, issue: null },
      project: {
        id: ids[3], repositoryConnectionId: ids[8],
        repositoryExternalId: "owner/repo", repositoryBaseBranch: "main",
      },
      workspace: { id: ids[9], branch: "task/frozen-title" },
      capabilities: ["context:read", "task-status:read", "task-status:transition"],
    });
    expect("root" in logical.workspace).toBe(false);
    expect(workloadExecutionContextSchema.parse({
      ...logical,
      workspace: { ...logical.workspace, root: "/tmp/workspace" },
    }).workspace.root).toBe("/tmp/workspace");
    expect(JSON.stringify(logical)).not.toContain("credential");
    expect(JSON.stringify(logical)).not.toContain("executionCode");
  });
});
