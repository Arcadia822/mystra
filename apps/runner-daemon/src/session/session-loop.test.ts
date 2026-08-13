import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionClaimAssignment } from "@mystra/shared";

import { runSessionLoop } from "./session-loop.js";

const worker = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("./session-worker.js", () => ({ executeSessionAssignment: worker.execute }));

function assignment(idSuffix: string): SessionClaimAssignment {
  const sessionId = `00000000-0000-4000-8000-${idSuffix.padStart(12, "0")}`;
  return {
    session: {
      id: sessionId,
      teamId: "00000000-0000-4000-8000-000000000002",
      taskId: "00000000-0000-4000-8000-000000000003",
      projectId: "00000000-0000-4000-8000-000000000004",
      runtimeId: "00000000-0000-4000-8000-000000000005",
      providerKey: "codex",
      agentId: "00000000-0000-4000-8000-000000000006",
      agentRevision: 1,
      state: "dispatched",
      activeMessageId: "00000000-0000-4000-8000-000000000007",
      lastMessageId: null,
      interruptKind: null,
      continuationMode: null,
      failureCode: null,
      metadata: {},
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
    },
    lease: {
      id: "00000000-0000-4000-8000-000000000008",
      sessionId,
      runtimeId: "00000000-0000-4000-8000-000000000005",
      runnerId: "runner-1",
      leaseToken: "l".repeat(32),
      providerSessionId: null,
      leaseExpiresAt: "2026-08-10T06:00:00.000Z",
      claimedAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
    },
    systemPrompt: "System prompt",
    workspace: {
      kind: "task",
      taskWorkspaceId: "00000000-0000-4000-8000-000000000009",
      runtimeId: "00000000-0000-4000-8000-000000000005",
      workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000009",
      sharingMode: "shared-mutable",
    },
    message: {
      messageId: "00000000-0000-4000-8000-000000000007",
      content: [{ type: "text", text: "Implement" }],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  worker.execute.mockResolvedValue(undefined);
});

describe("runSessionLoop", () => {
  it("fans out independent assignments without a configured capacity limit", async () => {
    const controller = new AbortController();
    const first = assignment("11");
    const second = assignment("12");
    const claim = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockImplementationOnce(async () => {
        controller.abort();
        return undefined;
      });

    await runSessionLoop({
      runtimeId: first.session.runtimeId,
      runnerId: "runner-1",
      client: { claim, appendEvents: vi.fn() },
      workspace: { resolveReadyWorkspace: vi.fn() },
      providerExecutables: new Map([["codex", "/opt/mystra/bin/codex"]]),
      waitSeconds: 0,
      retryIntervalSeconds: 0,
      signal: controller.signal,
    });

    expect(worker.execute).toHaveBeenCalledTimes(2);
    expect(worker.execute.mock.calls.map(([input]) => input.assignment.session.id)).toEqual([
      first.session.id,
      second.session.id,
    ]);
    expect(worker.execute.mock.calls.map(([input]) => input.providerExecutable)).toEqual([
      "/opt/mystra/bin/codex",
      "/opt/mystra/bin/codex",
    ]);
  });

  it("does not execute the same Session twice while its worker is active and drains on shutdown", async () => {
    const controller = new AbortController();
    const current = assignment("13");
    let release!: () => void;
    const active = new Promise<void>((resolve) => { release = resolve; });
    worker.execute.mockReturnValueOnce(active);
    const claim = vi.fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current)
      .mockImplementationOnce(async () => {
        release();
        controller.abort();
        return undefined;
      });

    await runSessionLoop({
      runtimeId: current.session.runtimeId,
      runnerId: "runner-1",
      client: { claim, appendEvents: vi.fn() },
      workspace: { resolveReadyWorkspace: vi.fn() },
      providerExecutables: new Map([["codex", "/opt/mystra/bin/codex"]]),
      waitSeconds: 0,
      retryIntervalSeconds: 0,
      signal: controller.signal,
    });

    expect(worker.execute).toHaveBeenCalledOnce();
  });

  it("retries after a claim failure without converting it into a Session event", async () => {
    const controller = new AbortController();
    const current = assignment("14");
    const claim = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(current)
      .mockImplementationOnce(async () => {
        controller.abort();
        return undefined;
      });

    await runSessionLoop({
      runtimeId: current.session.runtimeId,
      runnerId: "runner-1",
      client: { claim, appendEvents: vi.fn() },
      workspace: { resolveReadyWorkspace: vi.fn() },
      providerExecutables: new Map([["codex", "/opt/mystra/bin/codex"]]),
      waitSeconds: 0,
      retryIntervalSeconds: 0,
      signal: controller.signal,
    });

    expect(claim).toHaveBeenCalledTimes(3);
    expect(worker.execute).toHaveBeenCalledOnce();
  });

  it("fails the Session instead of falling back to PATH when the discovered executable is absent", async () => {
    const controller = new AbortController();
    const current = assignment("15");
    const appendEvents = vi.fn();
    const claim = vi.fn()
      .mockResolvedValueOnce(current)
      .mockImplementationOnce(async () => {
        controller.abort();
        return undefined;
      });

    await runSessionLoop({
      runtimeId: current.session.runtimeId,
      runnerId: "runner-1",
      client: { claim, appendEvents },
      workspace: { resolveReadyWorkspace: vi.fn() },
      providerExecutables: new Map(),
      waitSeconds: 0,
      retryIntervalSeconds: 0,
      signal: controller.signal,
    });

    expect(worker.execute).not.toHaveBeenCalled();
    expect(appendEvents.mock.calls[0]![1][0]).toMatchObject({
      kind: "session.failed",
      payload: { code: "provider_unavailable" },
    });
  });
});
