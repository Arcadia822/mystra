import { describe, expect, it, vi } from "vitest";

import type { RuntimeView, TaskRecord, TaskWorkspaceView } from "@mystra/shared";
import type { SessionLaunchPersistenceInput } from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";

import { SessionService } from "./session-service";

const teamId = "00000000-0000-4000-8000-000000000001";
const taskId = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000003";
const runtimeId = "00000000-0000-4000-8000-000000000004";
const agentId = "00000000-0000-4000-8000-000000000005";
const sessionId = "00000000-0000-4000-8000-000000000006";
const messageId = "00000000-0000-4000-8000-000000000007";

function fixture() {
  const createSessionWithEvents = vi.fn(async (input: SessionLaunchPersistenceInput) => ({ session: input.session, created: true }));
  const db = {
    getTask: vi.fn(async (): Promise<TaskRecord | undefined> => ({ id: taskId, teamId, title: "Task", description: "Description", projectId, issue: null, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z" })),
    getProjectById: vi.fn(async () => ({
      id: projectId, teamId, name: "Mystra", slug: "mystra",
      repositoryConnectionId: "00000000-0000-4000-8000-000000000011",
      repositoryExternalId: "R_mystra", repositoryBaseBranch: "main", metadata: {},
      archivedAt: null, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
    })),
    resolveActiveAgent: vi.fn(async () => ({ agentId, revision: 2, systemPrompt: "You are the assigned Agent." })),
    getRuntime: vi.fn(),
    createSessionWithEvents,
    getSession: vi.fn(), listSessions: vi.fn(), appendSessionEvents: vi.fn(), listSessionEvents: vi.fn(),
  };
  const runtime = {
    id: runtimeId, name: "host", type: "host", status: "online", lastSeenAt: "2026-08-10T00:00:00.000Z",
    metadata: { runnerId: "runner-1", platform: "darwin/arm64", workspaceMaterialization: { version: 1, kinds: ["task-repository"], sharingModes: ["shared-mutable"] } },
    providers: [{ provider: "codex", discovered: true, available: true, source: "path", resolvedPath: "/usr/bin/codex", version: "1", unavailableReason: null }],
    createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
  } satisfies RuntimeView;
  const workspace = {
    get: vi.fn(async (): Promise<TaskWorkspaceView | undefined> => ({
      id: "00000000-0000-4000-8000-000000000008",
      taskId,
      projectId,
      runtimeId,
      state: "ready" as const,
      sharingMode: "shared-mutable" as const,
      configuredBaseBranch: "main",
      baseRef: "refs/heads/main",
      baseCommit: "a".repeat(40),
      branchName: "task/test",
      branchStrategy: "task_fallback" as const,
      failure: null,
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      readyAt: "2026-08-10T00:00:00.000Z",
    })),
    resolveSessionAttachment: vi.fn(async () => ({ kind: "task" as const, taskWorkspaceId: "00000000-0000-4000-8000-000000000008", runtimeId, workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000008", sharingMode: "shared-mutable" as const })),
  };
  return { service: new SessionService({ db, workspace, runtimeResolver: async () => runtime, now: () => "2026-08-10T00:00:00.000Z", newId: vi.fn(() => crypto.randomUUID()) }), createSessionWithEvents, db, workspace };
}

describe("SessionService.launch", () => {
  it("persists Session plus the prompt, Workspace, and first user message atomically", async () => {
    const { service, createSessionWithEvents } = fixture();
    const result = await service.launch({
      actor: { actorId: "user-1", teamId, roles: ["owner"] },
      request: {
        sessionId, runtimeId, providerKey: "codex", agentId,
        context: { taskId, projectId, manual: { note: "untrusted" } },
        firstUserMessage: { messageId, content: [{ type: "text", text: "Implement it" }] },
        metadata: {},
      },
    });

    expect(result.session).toMatchObject({ id: sessionId, taskId, activeMessageId: messageId, state: "queued" });
    const persisted = createSessionWithEvents.mock.calls[0]![0];
    expect(persisted.events.map((event) => event.kind)).toEqual([
      "session.created", "session.system_prompt_configured", "session.workspace_attached", "session.user_message_submitted",
    ]);
    expect(persisted.events[1]!.payload.finalPrompt).toContain("<untrusted_context>");
    expect(JSON.stringify(persisted)).not.toMatch(/turnId|maxConcurrency|slot/iu);
  });

  it("maps archived Agent and launch races to stable Session failures", async () => {
    const archived = fixture();
    archived.db.resolveActiveAgent.mockRejectedValue(new RdbError("AGENT_ARCHIVED", "Agent is archived"));
    await expect(archived.service.launch({
      actor: { actorId: "user-1", teamId, roles: ["owner"] },
      request: {
        sessionId, runtimeId, providerKey: "codex", agentId,
        context: { taskId, projectId },
        firstUserMessage: { messageId, content: [{ type: "text", text: "Implement it" }] },
        metadata: {},
      },
    })).rejects.toMatchObject({ code: "agent_unavailable" });

    const raced = fixture();
    raced.createSessionWithEvents.mockRejectedValue(new RdbError("RDB_CONFLICT", "Launch changed concurrently"));
    await expect(raced.service.launch({
      actor: { actorId: "user-1", teamId, roles: ["owner"] },
      request: {
        sessionId, runtimeId, providerKey: "codex", agentId,
        context: { taskId, projectId },
        firstUserMessage: { messageId, content: [{ type: "text", text: "Implement it" }] },
        metadata: {},
      },
    })).rejects.toMatchObject({ code: "session_conflict" });
  });
});

describe("SessionService.launchForTask", () => {
  it("locks the ready Workspace Runtime, derives Project from Task, and launches once", async () => {
    const { service, createSessionWithEvents } = fixture();
    const result = await service.launchForTask({
      actor: { actorId: "user-1", teamId, roles: ["owner"] },
      taskId,
      request: { sessionId, providerKey: "codex", agentId, manualContext: { text: "Check the regression" } },
    });
    expect(result.session).toMatchObject({ id: sessionId, runtimeId, projectId, state: "queued" });
    expect(createSessionWithEvents).toHaveBeenCalledTimes(1);
    const launch = createSessionWithEvents.mock.calls[0]![0].launchRequest;
    expect(launch).toMatchObject({
      sessionId,
      runtimeId,
      providerKey: "codex",
      agentId,
      context: { taskId, projectId, manual: { text: "Check the regression" } },
    });
    expect(launch.firstUserMessage).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("frozen context") }],
    });
  });

  it("rejects absent or non-ready Workspace before launching", async () => {
    const absent = fixture();
    absent.workspace.get.mockResolvedValue(undefined);
    await expect(absent.service.launchForTask({
      actor: { actorId: "user-1", teamId, roles: ["owner"] }, taskId,
      request: { sessionId, providerKey: "codex", agentId },
    })).rejects.toMatchObject({ code: "workspace_missing" });
    expect(absent.createSessionWithEvents).not.toHaveBeenCalled();

    const preparing = fixture();
    const readyWorkspace = await preparing.workspace.get();
    preparing.workspace.get.mockResolvedValue({ ...readyWorkspace!, state: "preparing", readyAt: null });
    await expect(preparing.service.launchForTask({
      actor: { actorId: "user-1", teamId, roles: ["owner"] }, taskId,
      request: { sessionId, providerKey: "codex", agentId },
    })).rejects.toMatchObject({ code: "workspace_not_ready" });
    expect(preparing.createSessionWithEvents).not.toHaveBeenCalled();
  });
});

describe("SessionService.list", () => {
  it("does not turn a missing or cross-Team Task into an empty successful list", async () => {
    const { service, db } = fixture();
    db.getTask.mockResolvedValue(undefined);
    await expect(service.list({
      actor: { actorId: "user-1", teamId, roles: ["owner"] }, taskId, limit: 50,
    })).rejects.toMatchObject({ code: "task_not_found" });
    expect(db.listSessions).not.toHaveBeenCalled();
  });
});

describe("SessionService.sendMessage", () => {
  const readySession = {
    id: sessionId, teamId, taskId, projectId, runtimeId, providerKey: "codex", agentId, agentRevision: 2,
    state: "ready" as const, activeMessageId: null, lastMessageId: messageId,
    interruptKind: null, continuationMode: null, failureCode: null, metadata: {},
    createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
  };
  const nextMessage = {
    messageId: "00000000-0000-4000-8000-000000000010",
    content: [{ type: "text" as const, text: "Continue" }],
  };

  it("submits one message and returns exact replay without another append", async () => {
    const { service, db } = fixture();
    db.getSession.mockResolvedValue(readySession);
    db.listSessionEvents.mockResolvedValue({ events: [] });
    db.appendSessionEvents.mockResolvedValue({
      session: { ...readySession, state: "message_pending", activeMessageId: nextMessage.messageId },
      events: [],
    });
    await expect(service.sendMessage({
      actor: { actorId: "user-1", teamId, roles: ["owner"] }, sessionId, request: nextMessage,
    })).resolves.toMatchObject({ created: true, session: { state: "message_pending" } });

    db.getSession.mockResolvedValue({ ...readySession, state: "message_pending", activeMessageId: nextMessage.messageId });
    db.listSessionEvents.mockResolvedValue({ events: [{
      eventId: crypto.randomUUID(), sessionId, sourceId: "control-plane", sourceSequence: 5,
      globalSequence: 9, kind: "session.user_message_submitted", version: 1,
      messageId: nextMessage.messageId, payload: { content: nextMessage.content }, metadata: {},
      occurredAt: "2026-08-10T00:00:00.000Z", acceptedAt: "2026-08-10T00:00:00.000Z",
    }] });
    await expect(service.sendMessage({
      actor: { actorId: "user-1", teamId, roles: ["owner"] }, sessionId, request: nextMessage,
    })).resolves.toMatchObject({ created: false });
    expect(db.appendSessionEvents).toHaveBeenCalledTimes(1);
  });

  it("rejects a new message while busy or terminal", async () => {
    const { service, db } = fixture();
    db.listSessionEvents.mockResolvedValue({ events: [] });
    db.getSession.mockResolvedValue({ ...readySession, state: "running", activeMessageId: messageId });
    await expect(service.sendMessage({
      actor: { actorId: "user-1", teamId, roles: ["owner"] }, sessionId, request: nextMessage,
    })).rejects.toMatchObject({ code: "session_busy" });
    db.getSession.mockResolvedValue({ ...readySession, state: "closed" });
    await expect(service.sendMessage({
      actor: { actorId: "user-1", teamId, roles: ["owner"] }, sessionId, request: nextMessage,
    })).rejects.toMatchObject({ code: "session_terminal" });
  });

  it("treats both terminal states as idempotent close outcomes", async () => {
    const { service, db } = fixture();
    const failed = { ...readySession, state: "failed" as const, failureCode: "runtime_lost" };
    db.getSession.mockResolvedValue(failed);
    await expect(service.close({
      actor: { actorId: "user-1", teamId, roles: ["owner"] }, sessionId,
    })).resolves.toEqual(failed);
    expect(db.appendSessionEvents).not.toHaveBeenCalled();
  });
});
