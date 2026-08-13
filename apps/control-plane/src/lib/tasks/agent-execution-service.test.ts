import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AgentExecutionService } from "./agent-execution-service";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

function resolved(expiresAt = "2026-08-11T03:00:00.000Z") {
  const harness = {
    id: id("1"), teamId: id("2"), taskId: id("3"), projectId: id("4"), agentId: id("5"), agentRevision: 2,
    agentName: "Agent", agentSystemPrompt: "Prompt", taskTitle: "Frozen task", taskDescription: "Frozen description",
    taskIssue: { provider: "linear" as const, connectionId: id("6"), scopeExternalId: "team", externalId: "issue", identifier: "ENG-1" },
    runtimeId: id("7"), providerKey: "codex" as const, workspaceId: id("8"), plannedSessionId: id("9"), sessionId: id("9"), firstMessageId: id("10"),
    assignIdempotencyKey: "assign-1", assignRequestFingerprint: "a".repeat(64), capabilityRevokedAt: null,
    setupFailureCode: null, setupFailureMessage: null, createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
  };
  return {
    harness,
    task: { id: harness.taskId, teamId: harness.teamId, title: "Mutable", description: null, projectId: harness.projectId, issue: null, productionStatus: "in_progress" as const, statusRevision: 2, statusNote: null, statusUpdatedAt: "2026-08-11T00:00:00.000Z", statusActor: { kind: "human" as const, actorId: "owner", agentId: null, harnessId: harness.id, sessionId: null }, createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z" },
    project: { id: harness.projectId, teamId: harness.teamId, name: "Mystra", slug: "mystra", repositoryConnectionId: id("11"), repositoryExternalId: "R_repo", repositoryBaseBranch: "main", metadata: { secret: "must-not-return" }, archivedAt: null, createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z" },
    workspace: { id: harness.workspaceId!, teamId: harness.teamId, taskId: harness.taskId, projectId: harness.projectId, runtimeId: harness.runtimeId, state: "ready" as const, sharingMode: "shared-mutable" as const, connectionId: id("11"), repositoryExternalId: "R_repo", configuredBaseBranch: "main", issueProvider: "linear" as const, issueConnectionId: id("6"), issueScopeExternalId: "team", issueExternalId: "issue", baseRef: "refs/heads/main", baseCommit: "a".repeat(40), branchName: "eng-1", branchStrategy: "linear-issue-v1" as const, workspaceRef: "host:workspace", activeAttemptSequence: 1, failureCode: null, failureMessage: null, createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z", readyAt: "2026-08-11T00:00:00.000Z" },
    session: { id: harness.sessionId!, teamId: harness.teamId, taskId: harness.taskId, projectId: harness.projectId, runtimeId: harness.runtimeId, providerKey: "codex" as const, agentId: harness.agentId, agentRevision: 2, state: "dispatched" as const, activeMessageId: harness.firstMessageId, lastMessageId: null, interruptKind: null, continuationMode: null, failureCode: null, metadata: {}, createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z" },
    executionCodeExpiresAt: expiresAt,
  };
}

describe("AgentExecutionService", () => {
  it("resolves only the code hash and returns frozen, secret-free context", async () => {
    const resolveWorkloadExecution = vi.fn(async () => resolved());
    const service = new AgentExecutionService({
      db: { resolveWorkloadExecution, getTask: vi.fn(), transitionTaskStatus: vi.fn(), listTaskStatusTransitions: vi.fn() },
      now: () => new Date("2026-08-11T01:00:00.000Z"),
    });
    const context = await service.context("execution-code");
    expect(resolveWorkloadExecution).toHaveBeenCalledWith(createHash("sha256").update("execution-code").digest("hex"));
    expect(context.task.title).toBe("Frozen task");
    expect(context.workspace).toEqual({ id: id("8"), branch: "eng-1" });
    expect(context.execution.agentContext).toEqual({ agentId: id("5"), name: "Agent", revision: 2 });
    expect(JSON.stringify(context)).not.toMatch(/must-not-return|execution-code/iu);
  });

  it("reports explicit absent Agent Context for a no-Agent attempt", async () => {
    const base = resolved();
    const execution = {
      ...base,
      harness: { ...base.harness, agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null },
      session: { ...base.session, agentId: null, agentRevision: null },
    };
    const service = new AgentExecutionService({
      db: { resolveWorkloadExecution: vi.fn(async () => execution) } as never,
      now: () => new Date("2026-08-11T01:00:00.000Z"),
    });
    await expect(service.whoami("no-agent")).resolves.toMatchObject({
      execution: { agentContext: null },
    });
  });

  it("fails closed for unknown and expired capabilities", async () => {
    const unknown = new AgentExecutionService({ db: { resolveWorkloadExecution: vi.fn(async () => undefined) } as never });
    await expect(unknown.whoami("unknown")).rejects.toMatchObject({ code: "capability_expired" });
    const expired = new AgentExecutionService({
      db: { resolveWorkloadExecution: vi.fn(async () => resolved("2026-08-11T00:00:00.000Z")) } as never,
      now: () => new Date("2026-08-11T01:00:00.000Z"),
    });
    await expect(expired.whoami("expired")).rejects.toMatchObject({ code: "capability_expired" });
  });

  it("fails closed when persisted Harness, Session, or Workspace scope no longer matches", async () => {
    const mismatch = resolved();
    mismatch.session.runtimeId = id("99");
    const service = new AgentExecutionService({
      db: { resolveWorkloadExecution: vi.fn(async () => mismatch) } as never,
      now: () => new Date("2026-08-11T01:00:00.000Z"),
    });

    await expect(service.context("foreign-scope")).rejects.toMatchObject({ code: "scope_mismatch" });
  });
});
