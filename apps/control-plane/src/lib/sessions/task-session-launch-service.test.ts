import { describe, expect, it, vi } from "vitest";

import { TaskSessionLaunchService } from "./task-session-launch-service";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const now = "2026-08-17T00:00:00.000Z";

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: id("1"), teamId: id("2"), title: "Task", description: null, projectId: id("3"), issue: null,
    status: "pending" as const, metadata: {}, runtimeId: null, statusRevision: 1, statusNote: null,
    statusUpdatedAt: now,
    statusActor: { kind: "system" as const, actorId: null, agentId: null, attemptId: null, sessionId: null },
    createdAt: now, updatedAt: now, ...overrides,
  };
}

const runtime = {
  id: id("4"), name: "host-a", type: "host" as const, status: "online" as const, lastSeenAt: now,
  metadata: { runnerId: id("5"), platform: "darwin/arm64", workspaceMaterialization: { version: 1 as const, kinds: ["task-repository"] as const, sharingModes: ["shared-mutable"] as const } },
  providers: [{ provider: "codex", discovered: true, available: true, source: "path", resolvedPath: "/usr/bin/codex", version: "1", unavailableReason: null }],
  createdAt: now, updatedAt: now,
};

describe("TaskSessionLaunchService", () => {
  it("resolves and locks the first Runtime, returning preparing until the attempt Session exists", async () => {
    const pending = task();
    const attempt = {
      id: id("6"), teamId: pending.teamId, taskId: pending.id, projectId: pending.projectId!,
      agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null,
      taskTitle: pending.title, taskDescription: null, taskIssue: null, manualContextText: "Inspect first",
      runtimeId: runtime.id, providerKey: "codex" as const, workspaceId: id("7"),
      plannedSessionId: id("8"), sessionId: null, firstMessageId: id("9"),
      assignIdempotencyKey: id("8"), assignRequestFingerprint: "a".repeat(64), capabilityRevokedAt: null,
      setupFailureCode: null, setupFailureMessage: null, createdAt: now, updatedAt: now,
    };
    const production = { start: vi.fn(async () => ({ task: { ...pending, status: "in_progress", runtimeId: runtime.id }, attempt, transition: {}, created: true })), continueAfterWorkspaceReady: vi.fn() };
    const service = new TaskSessionLaunchService({
      db: { getTask: vi.fn(async () => pending), listRuntimes: vi.fn(async () => [runtime]), getExecutionAttemptByTaskId: vi.fn(), getSession: vi.fn() } as never,
      workspace: { setup: vi.fn() } as never,
      sessions: { launchForTask: vi.fn() } as never,
      production: production as never,
      deriveRuntime: (candidate) => candidate,
    });

    await expect(service.launch({
      actor: { actorId: "owner", teamId: pending.teamId, roles: ["owner"] }, taskId: pending.id,
      request: { sessionId: id("8"), providerKey: "codex", manualContext: { text: "Inspect first" } },
    })).resolves.toEqual({ state: "preparing", sessionId: id("8") });
    expect(production.start).toHaveBeenCalledWith(expect.objectContaining({
      launch: { sessionId: id("8"), manualContextText: "Inspect first" },
      request: expect.objectContaining({ runtimeId: runtime.id, expectedRevision: 1, idempotencyKey: id("8") }),
    }));
  });

  it("never changes a locked Runtime and rejects a Provider unavailable on it", async () => {
    const locked = task({ status: "in_progress", runtimeId: runtime.id, statusRevision: 2 });
    const db = {
      getTask: vi.fn(async () => locked),
      listRuntimes: vi.fn(async () => [{ ...runtime, id: id("10"), providers: [{ ...runtime.providers[0]!, provider: "copilot" }] }, runtime]),
      getExecutionAttemptByTaskId: vi.fn(async () => undefined),
      getSession: vi.fn(),
    };
    const service = new TaskSessionLaunchService({
      db: db as never,
      workspace: { setup: vi.fn() } as never,
      sessions: { launchForTask: vi.fn() } as never,
      production: { start: vi.fn(), continueAfterWorkspaceReady: vi.fn() } as never,
      deriveRuntime: (candidate) => candidate,
    });

    await expect(service.launch({
      actor: { actorId: "owner", teamId: locked.teamId, roles: ["owner"] }, taskId: locked.id,
      request: { sessionId: id("11"), providerKey: "copilot" },
    })).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(db.listRuntimes).toHaveBeenCalledOnce();
  });

  it("reuses the locked Runtime Workspace for later Sessions", async () => {
    const locked = task({ status: "in_progress", runtimeId: runtime.id, statusRevision: 2 });
    const session = { id: id("12") };
    const workspace = { setup: vi.fn(async () => ({ workspace: { id: id("13"), state: "ready" }, created: false, retried: false })) };
    const sessions = { launchForTask: vi.fn(async () => ({ session, created: true })) };
    const service = new TaskSessionLaunchService({
      db: { getTask: vi.fn(async () => locked), listRuntimes: vi.fn(async () => [runtime]), getExecutionAttemptByTaskId: vi.fn(async () => undefined), getSession: vi.fn() } as never,
      workspace: workspace as never,
      sessions: sessions as never,
      production: { start: vi.fn(), continueAfterWorkspaceReady: vi.fn() } as never,
      deriveRuntime: (candidate) => candidate,
    });

    await expect(service.launch({
      actor: { actorId: "owner", teamId: locked.teamId, roles: ["owner"] }, taskId: locked.id,
      request: { sessionId: session.id, providerKey: "codex" },
    })).resolves.toEqual({ state: "ready", session, created: true });
    expect(workspace.setup).toHaveBeenCalledWith(expect.objectContaining({ runtimeId: runtime.id }));
  });

  it("surfaces a terminal preparation failure instead of polling forever", async () => {
    const pending = task();
    const failedAttempt = {
      id: id("14"), teamId: pending.teamId, taskId: pending.id, projectId: pending.projectId!,
      agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null,
      taskTitle: pending.title, taskDescription: null, taskIssue: null, manualContextText: null,
      runtimeId: runtime.id, providerKey: "codex" as const, workspaceId: null,
      plannedSessionId: id("15"), sessionId: null, firstMessageId: id("16"),
      assignIdempotencyKey: id("15"), assignRequestFingerprint: "b".repeat(64), capabilityRevokedAt: null,
      setupFailureCode: "workspace_setup_failed", setupFailureMessage: "Workspace setup failed",
      createdAt: now, updatedAt: now,
    };
    const service = new TaskSessionLaunchService({
      db: { getTask: vi.fn(async () => pending), listRuntimes: vi.fn(async () => [runtime]), getExecutionAttemptByTaskId: vi.fn(), getSession: vi.fn() } as never,
      workspace: { setup: vi.fn() } as never,
      sessions: { launchForTask: vi.fn() } as never,
      production: { start: vi.fn(async () => ({ task: pending, attempt: failedAttempt, transition: {}, created: true })), continueAfterWorkspaceReady: vi.fn() } as never,
      deriveRuntime: (candidate) => candidate,
    });

    await expect(service.launch({
      actor: { actorId: "owner", teamId: pending.teamId, roles: ["owner"] }, taskId: pending.id,
      request: { sessionId: id("15"), providerKey: "codex" },
    })).rejects.toMatchObject({ code: "workspace_unavailable" });
  });

  it("replays an already-created Session even when its locked Runtime is now offline", async () => {
    const sessionId = id("17");
    const locked = task({ status: "in_progress", runtimeId: runtime.id, statusRevision: 2 });
    const attempt = {
      id: id("18"), teamId: locked.teamId, taskId: locked.id, projectId: locked.projectId!,
      agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null,
      taskTitle: locked.title, taskDescription: null, taskIssue: null, manualContextText: null,
      runtimeId: runtime.id, providerKey: "codex" as const, workspaceId: id("19"),
      plannedSessionId: sessionId, sessionId, firstMessageId: id("20"),
      assignIdempotencyKey: sessionId, assignRequestFingerprint: "c".repeat(64), capabilityRevokedAt: null,
      setupFailureCode: null, setupFailureMessage: null, createdAt: now, updatedAt: now,
    };
    const session = { id: sessionId };
    const service = new TaskSessionLaunchService({
      db: {
        getTask: vi.fn(async () => locked),
        listRuntimes: vi.fn(async () => [{ ...runtime, status: "offline" as const }]),
        getExecutionAttemptByTaskId: vi.fn(async () => attempt),
        getSession: vi.fn(async () => session),
      } as never,
      workspace: { setup: vi.fn() } as never,
      sessions: { launchForTask: vi.fn() } as never,
      production: { start: vi.fn(), continueAfterWorkspaceReady: vi.fn() } as never,
      deriveRuntime: (candidate) => candidate,
    });

    await expect(service.launch({
      actor: { actorId: "owner", teamId: locked.teamId, roles: ["owner"] }, taskId: locked.id,
      request: { sessionId, providerKey: "codex" },
    })).resolves.toEqual({ state: "ready", session, created: false });
  });
});
