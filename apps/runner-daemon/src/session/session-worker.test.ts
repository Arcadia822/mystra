import { describe, expect, it, vi } from "vitest";

import type { SessionClaimAssignment, SessionEventInput } from "@mystra/shared";

import { executeSessionAssignment } from "./session-worker.js";

describe("executeSessionAssignment", () => {
  it("releases a provider response as typed events", async () => {
    const appendEvents = vi.fn(async (_assignment: SessionClaimAssignment, _events: SessionEventInput[]) => undefined);
    const assignment = {
      session: {
        id: "00000000-0000-4000-8000-000000000001", teamId: "00000000-0000-4000-8000-000000000002",
        taskId: "00000000-0000-4000-8000-000000000003", projectId: "00000000-0000-4000-8000-000000000004",
        runtimeId: "00000000-0000-4000-8000-000000000005", providerKey: "codex",
        agentId: "00000000-0000-4000-8000-000000000006", agentRevision: 1, state: "dispatched",
        activeMessageId: "00000000-0000-4000-8000-000000000007", lastMessageId: null,
        interruptKind: null, continuationMode: null, failureCode: null, metadata: {},
        createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
      },
      lease: {
        id: "00000000-0000-4000-8000-000000000008", sessionId: "00000000-0000-4000-8000-000000000001",
        runtimeId: "00000000-0000-4000-8000-000000000005", runnerId: "runner-1", leaseToken: "x".repeat(32),
        providerSessionId: null, leaseExpiresAt: "2026-08-10T00:01:00.000Z", claimedAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
      },
      systemPrompt: "System prompt",
      workspace: { kind: "task", taskWorkspaceId: "00000000-0000-4000-8000-000000000009", runtimeId: "00000000-0000-4000-8000-000000000005", workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000009", sharingMode: "shared-mutable" },
      message: { messageId: "00000000-0000-4000-8000-000000000007", content: [{ type: "text", text: "Implement" }] },
    } as SessionClaimAssignment;
    await executeSessionAssignment({
      assignment,
      client: { appendEvents },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      runProcess: vi.fn(async () => ({ exitCode: 0, stdout: '{"type":"thread.started","thread_id":"thread-1"}\n{"type":"item.completed","item":{"type":"agent_message","text":"Done"}}\n', stderr: "" })),
    });
    const events = appendEvents.mock.calls[0]![1];
    expect(events.map((event) => event.kind)).toEqual([
      "session.provider_started", "session.response_started", "session.agent_message_chunk", "session.response_completed",
    ]);
    expect(events[0]?.payload).toEqual({ providerSessionId: "thread-1" });

    appendEvents.mockClear();
    await executeSessionAssignment({
      assignment: { ...assignment, lease: { ...assignment.lease, providerSessionId: "thread-1" } },
      client: { appendEvents },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      runProcess: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" })),
    });
    expect(appendEvents.mock.calls[0]![1].map((event) => event.kind)).toEqual([
      "session.response_started", "session.response_completed",
    ]);
  });

  it("reports workspace, Provider, and cancellation failures as typed events", async () => {
    const assignment = {
      session: {
        id: "00000000-0000-4000-8000-000000000001", teamId: "00000000-0000-4000-8000-000000000002",
        taskId: "00000000-0000-4000-8000-000000000003", projectId: null,
        runtimeId: "00000000-0000-4000-8000-000000000005", providerKey: "codex",
        agentId: "00000000-0000-4000-8000-000000000006", agentRevision: 1, state: "dispatched",
        activeMessageId: "00000000-0000-4000-8000-000000000007", lastMessageId: null,
        interruptKind: null, continuationMode: null, failureCode: null, metadata: {},
        createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
      },
      lease: {
        id: "00000000-0000-4000-8000-000000000008", sessionId: "00000000-0000-4000-8000-000000000001",
        runtimeId: "00000000-0000-4000-8000-000000000005", runnerId: "runner-1", leaseToken: "x".repeat(32),
        providerSessionId: null, leaseExpiresAt: "2026-08-10T00:01:00.000Z", claimedAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
      },
      systemPrompt: "System prompt",
      workspace: { kind: "task", taskWorkspaceId: "00000000-0000-4000-8000-000000000009", runtimeId: "00000000-0000-4000-8000-000000000005", workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000009", sharingMode: "shared-mutable" },
      message: { messageId: "00000000-0000-4000-8000-000000000007", content: [{ type: "text", text: "Implement" }] },
    } as SessionClaimAssignment;

    const workspaceFailure = vi.fn(async (_assignment: SessionClaimAssignment, _events: SessionEventInput[]) => undefined);
    await executeSessionAssignment({
      assignment,
      client: { appendEvents: workspaceFailure },
      workspace: { resolveReadyWorkspace: vi.fn(async () => { throw new Error("missing"); }) },
    });
    expect(workspaceFailure.mock.calls[0]![1].map((event) => event.kind)).toEqual(["session.failed"]);
    expect(workspaceFailure.mock.calls[0]![1][0]?.payload).toMatchObject({ code: "workspace_unavailable" });

    const providerFailure = vi.fn(async (_assignment: SessionClaimAssignment, _events: SessionEventInput[]) => undefined);
    await executeSessionAssignment({
      assignment: { ...assignment, session: { ...assignment.session, providerKey: "unsupported" } },
      client: { appendEvents: providerFailure },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
    });
    expect(providerFailure.mock.calls[0]![1][0]?.payload).toMatchObject({ code: "provider_unavailable" });

    const cancellation = vi.fn(async (_assignment: SessionClaimAssignment, _events: SessionEventInput[]) => undefined);
    const controller = new AbortController();
    controller.abort();
    await executeSessionAssignment({
      assignment,
      client: { appendEvents: cancellation },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      runProcess: vi.fn(async () => { throw new Error("aborted"); }),
      signal: controller.signal,
    });
    expect(cancellation.mock.calls[0]![1].map((event) => event.kind)).toEqual([
      "session.response_started", "session.response_canceled",
    ]);
  });
});
