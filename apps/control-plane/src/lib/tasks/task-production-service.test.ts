import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";
import type { Harness } from "@mystra/shared";

import { TaskProductionService } from "./task-production-service";
import { getHostLivenessRegistry } from "../runtime/runtime-liveness";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const now = new Date().toISOString();

describe("TaskProductionService", () => {
  it("commits Start before requesting Workspace setup and freezes optional Agent Context and Task inputs", async () => {
    const task = {
      id: id("1"), teamId: id("2"), title: "Frozen title", description: "Frozen description", projectId: id("3"), issue: null,
      productionStatus: "pending" as const, statusRevision: 1, statusNote: null, statusUpdatedAt: now,
      statusActor: { kind: "system" as const, actorId: null, agentId: null, harnessId: null, sessionId: null },
      createdAt: now, updatedAt: now,
    };
    const calls: string[] = [];
    getHostLivenessRegistry().markSeen(id("7"), new Date());
    const updateHarness = vi.fn(async (input) => ({ ...assignedHarness!, workspaceId: input.workspaceId ?? null }));
    let assignedHarness: Harness | undefined;
    const db = {
      getTask: vi.fn(async () => task),
      getProjectById: vi.fn(async () => ({ id: task.projectId!, teamId: task.teamId, name: "Mystra", slug: "mystra", repositoryConnectionId: id("4"), repositoryExternalId: "R_repo", repositoryBaseBranch: "main", metadata: {}, archivedAt: null, createdAt: now, updatedAt: now })),
      getRuntime: vi.fn(async () => ({ id: id("6"), name: "host", type: "host", status: "online", lastSeenAt: now, metadata: { runnerId: id("7"), platform: "darwin/arm64", workspaceMaterialization: { version: 1, kinds: ["task-repository"], sharingModes: ["shared-mutable"] } }, providers: [{ provider: "codex", discovered: true, available: true, source: "path", resolvedPath: "/usr/bin/codex", version: "1", unavailableReason: null }], createdAt: now, updatedAt: now })),
      getHarnessByTaskId: vi.fn(),
      startTaskProduction: vi.fn(async (input) => {
        calls.push("assigned");
        assignedHarness = {
          ...input.harness,
          agentId: input.agentId,
          agentName: input.agentId ? "Production Agent" : null,
          agentRevision: input.agentId ? 7 : null,
          agentSystemPrompt: input.agentId ? "Frozen Agent prompt." : null,
        };
        return { task: { ...task, productionStatus: "in_progress" as const, statusRevision: 2 }, harness: assignedHarness, transition: input.transition, created: true };
      }),
      updateHarness,
    };
    const workspace = {
      setup: vi.fn(async () => {
        calls.push("workspace");
        return { workspace: { id: id("8"), state: "queued" as const }, created: true, retried: false };
      }),
      get: vi.fn(),
    };
    const service = new TaskProductionService({
      db: db as never,
      workspace: workspace as never,
      sessions: { launchHarness: vi.fn() },
      now: () => "2026-08-11T00:00:00.000Z",
      newId: vi.fn().mockReturnValueOnce(id("9")).mockReturnValueOnce(id("10")).mockReturnValueOnce(id("11")).mockReturnValueOnce(id("12")),
    });
    const result = await service.start({
      actor: { actorId: "owner-1", teamId: task.teamId },
      taskId: task.id,
      request: { agentId: id("5"), runtimeId: id("6"), providerKey: "codex", expectedRevision: 1, idempotencyKey: "assign-1" },
    });
    expect(calls).toEqual(["assigned", "workspace"]);
    expect(result.harness).toMatchObject({ agentName: "Production Agent", agentRevision: 7, agentSystemPrompt: "Frozen Agent prompt.", taskTitle: "Frozen title", workspaceId: id("8") });
    expect(updateHarness).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: id("8") }));
  });

  it("launches the planned Session once when Workspace becomes ready", async () => {
    const harness = {
      id: id("1"), teamId: id("2"), taskId: id("3"), projectId: id("4"), agentId: id("5"), agentName: "Agent", agentRevision: 1,
      agentSystemPrompt: "Prompt", taskTitle: "Task", taskDescription: null, taskIssue: null, runtimeId: id("6"), providerKey: "codex" as const,
      workspaceId: null, plannedSessionId: id("7"), sessionId: null, firstMessageId: id("8"), assignIdempotencyKey: "assign-1",
      assignRequestFingerprint: "a".repeat(64), capabilityRevokedAt: null, setupFailureCode: null, setupFailureMessage: null,
      createdAt: now, updatedAt: now,
    };
    let current = harness;
    const updateHarness = vi.fn(async (input) => {
      current = { ...current, ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}), ...(input.sessionId ? { sessionId: input.sessionId } : {}) };
      return current;
    });
    const launchHarness = vi.fn(async () => ({ session: { id: harness.plannedSessionId }, created: true }));
    const service = new TaskProductionService({
      db: { getHarnessByTaskId: vi.fn(async () => current), updateHarness } as never,
      workspace: { get: vi.fn(async () => ({ id: id("9"), state: "ready" })), setup: vi.fn() } as never,
      sessions: { launchHarness } as never,
    });
    await service.continueAfterWorkspaceReady({ teamId: harness.teamId, taskId: harness.taskId });
    await service.continueAfterWorkspaceReady({ teamId: harness.teamId, taskId: harness.taskId });
    expect(launchHarness).toHaveBeenCalledTimes(1);
    expect(current.sessionId).toBe(harness.plannedSessionId);
  });

  it("replays a committed assignment without revalidating mutable Agent or Runtime availability", async () => {
    const actor = { actorId: "owner-1", teamId: id("2") };
    const request = { agentId: id("5"), runtimeId: id("6"), providerKey: "codex" as const, expectedRevision: 1, idempotencyKey: "assign-1" };
    const requestFingerprint = createHash("sha256").update(JSON.stringify({
      teamId: actor.teamId,
      actorId: actor.actorId,
      taskId: id("1"),
      agentId: request.agentId,
      runtimeId: request.runtimeId,
      providerKey: request.providerKey,
      expectedRevision: request.expectedRevision,
    })).digest("hex");
    const task = {
      id: id("1"), teamId: actor.teamId, title: "Frozen title", description: null, projectId: id("3"), issue: null,
      productionStatus: "in_progress" as const, statusRevision: 2, statusNote: null, statusUpdatedAt: now,
      statusActor: { kind: "human" as const, actorId: actor.actorId, agentId: null, harnessId: id("9"), sessionId: null },
      createdAt: now, updatedAt: now,
    };
    const harness: Harness = {
      id: id("9"), teamId: actor.teamId, taskId: task.id, projectId: task.projectId, agentId: request.agentId, agentName: "Agent", agentRevision: 1,
      agentSystemPrompt: "Frozen prompt", taskTitle: task.title, taskDescription: null, taskIssue: null,
      runtimeId: request.runtimeId, providerKey: request.providerKey, workspaceId: null, plannedSessionId: id("10"), sessionId: null,
      firstMessageId: id("11"), assignIdempotencyKey: request.idempotencyKey, assignRequestFingerprint: requestFingerprint,
      capabilityRevokedAt: null, setupFailureCode: null, setupFailureMessage: null, createdAt: now, updatedAt: now,
    };
    const transition = {
      id: id("12"), teamId: actor.teamId, taskId: task.id, fromStatus: "pending" as const, toStatus: "in_progress" as const,
      revision: 2, actor: task.statusActor, note: null, idempotencyKey: request.idempotencyKey, requestFingerprint, occurredAt: now,
    };
    const getRuntime = vi.fn(async () => undefined);
    const workspace = {
      setup: vi.fn(async () => ({ workspace: { id: id("13"), state: "queued" as const }, created: false, retried: true })),
      get: vi.fn(),
    };
    const updateHarness = vi.fn(async (input) => ({ ...harness, workspaceId: input.workspaceId ?? null }));
    const service = new TaskProductionService({
      db: {
        getTask: vi.fn(async () => task),
        getProjectById: vi.fn(),
        getRuntime,
        startTaskProduction: vi.fn(),
        getHarnessByTaskId: vi.fn(async () => harness),
        listTaskStatusTransitions: vi.fn(async () => [transition]),
        updateHarness,
      } as never,
      workspace: workspace as never,
      sessions: { launchHarness: vi.fn() },
    });

    const result = await service.start({ actor, taskId: task.id, request });

    expect(result.created).toBe(false);
    expect(result.transition).toEqual(transition);
    expect(getRuntime).not.toHaveBeenCalled();
    expect(workspace.setup).toHaveBeenCalledOnce();
  });
});
