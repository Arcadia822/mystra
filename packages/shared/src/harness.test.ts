import { describe, expect, it } from "vitest";

import {
  harnessSchema,
  taskStartRequestSchema,
  taskExecutionContextPayloadSchema,
  taskExecutionContextSchema,
  workloadExecutionIdentitySchema,
} from "./harness.js";

const ids = Array.from({ length: 12 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

describe("Harness contracts", () => {
  it("models an attempt without inventing a Harness lifecycle", () => {
    const parsed = harnessSchema.parse({
      id: ids[0], teamId: ids[1], taskId: ids[2], projectId: ids[3],
      agentId: ids[4], agentName: "Reviewer", agentRevision: 2, agentSystemPrompt: "Implement the change.",
      taskTitle: "Frozen title", taskDescription: null, taskIssue: null,
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
    expect(taskStartRequestSchema.parse(base)).toEqual({ ...base, agentId: null });
    expect(taskStartRequestSchema.parse({ ...base, agentId: null })).toEqual({ ...base, agentId: null });
    expect(taskStartRequestSchema.parse({ ...base, agentId: ids[4] }).agentId).toBe(ids[4]);
    expect(() => taskStartRequestSchema.parse({ ...base, agentId: "" })).toThrow();
  });

  it("requires the optional Harness Agent snapshot to be wholly present or absent", () => {
    const withAgent = harnessSchema.parse({
      id: ids[0], teamId: ids[1], taskId: ids[2], projectId: ids[3],
      agentId: ids[4], agentName: "Reviewer", agentRevision: 2, agentSystemPrompt: "Review precisely.",
      taskTitle: "Frozen title", taskDescription: null, taskIssue: null,
      runtimeId: ids[5], providerKey: "codex", workspaceId: null,
      plannedSessionId: ids[6], sessionId: null, firstMessageId: ids[7],
      assignIdempotencyKey: "start-052", assignRequestFingerprint: "a".repeat(64),
      capabilityRevokedAt: null, setupFailureCode: null, setupFailureMessage: null,
      createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
    });
    expect(withAgent.agentName).toBe("Reviewer");
    expect(harnessSchema.parse({
      ...withAgent,
      agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null,
    }).agentId).toBeNull();
    expect(() => harnessSchema.parse({ ...withAgent, agentId: null })).toThrow();
  });

  it("requires exact execution scope and bounded capabilities", () => {
    expect(workloadExecutionIdentitySchema.parse({
      teamId: ids[1], taskId: ids[2], harnessId: ids[0], sessionId: ids[6],
      agentContext: { agentId: ids[4], name: "Reviewer", revision: 2 },
      expiresAt: "2026-08-11T06:00:00.000Z",
    }).agentContext?.revision).toBe(2);
    expect(workloadExecutionIdentitySchema.parse({
      teamId: ids[1], taskId: ids[2], harnessId: ids[0], sessionId: ids[6],
      agentContext: null, expiresAt: "2026-08-11T06:00:00.000Z",
    }).agentContext).toBeNull();
    expect(() => workloadExecutionIdentitySchema.parse({
      teamId: ids[1], taskId: ids[2], harnessId: ids[0], agentContext: null,
      expiresAt: "2026-08-11T06:00:00.000Z",
    })).toThrow();
  });

  it("keeps host root local to the CLI-composed context", () => {
    const logical = taskExecutionContextPayloadSchema.parse({
      version: 1,
      execution: {
        teamId: ids[1], taskId: ids[2], harnessId: ids[0], sessionId: ids[6],
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
    expect(taskExecutionContextSchema.parse({
      ...logical,
      workspace: { ...logical.workspace, root: "/tmp/workspace" },
    }).workspace.root).toBe("/tmp/workspace");
    expect(JSON.stringify(logical)).not.toContain("credential");
    expect(JSON.stringify(logical)).not.toContain("executionCode");
  });
});
