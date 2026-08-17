import { describe, expect, it, vi } from "vitest";

import type { SessionClaimAssignment, SessionEventInput } from "@mystra/shared";
import type { ProviderSessionCommand } from "@mystra/agent-adapters";

import { executeSessionAssignment } from "./session-worker.js";

describe("executeSessionAssignment", () => {
  it("reports initial and resumed responses as started before the Provider exits", async () => {
    const appendEvents = vi.fn(async (_assignment: SessionClaimAssignment, _events: SessionEventInput[]) => undefined);
    let finishProvider: ((result: { exitCode: number; stdout: string; stderr: string }) => void) | undefined;
    const providerResult = new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
      finishProvider = resolve;
    });
    const assignment = {
      session: {
        id: "00000000-0000-4000-8000-000000000001", teamId: "00000000-0000-4000-8000-000000000002",
        taskId: "00000000-0000-4000-8000-000000000003", projectId: null,
        runtimeId: "00000000-0000-4000-8000-000000000005", providerKey: "codex",
        agentId: null, agentRevision: null, state: "dispatched",
        activeMessageId: "00000000-0000-4000-8000-000000000007", lastMessageId: null,
        interruptKind: null, continuationMode: null, failureCode: null, metadata: {},
        createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
      },
      lease: {
        id: "00000000-0000-4000-8000-000000000008", sessionId: "00000000-0000-4000-8000-000000000001",
        runtimeId: "00000000-0000-4000-8000-000000000005", runnerId: "runner-1", leaseToken: "x".repeat(32),
        providerSessionId: "provider-thread-1", leaseExpiresAt: "2026-08-10T00:01:00.000Z",
        claimedAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
      },
      systemPrompt: "System prompt",
      workspace: { kind: "task", taskWorkspaceId: "00000000-0000-4000-8000-000000000009", runtimeId: "00000000-0000-4000-8000-000000000005", workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000009", sharingMode: "shared-mutable" },
      message: { messageId: "00000000-0000-4000-8000-000000000007", content: [{ type: "text", text: "Continue" }] },
    } as SessionClaimAssignment;

    const execution = executeSessionAssignment({
      assignment,
      client: { appendEvents },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      providerExecutable: "/opt/mystra/bin/codex",
      runProcess: vi.fn(async () => providerResult),
    });

    await vi.waitFor(() => expect(appendEvents).toHaveBeenCalledTimes(1));
    expect(appendEvents.mock.calls[0]![1].map((event) => event.kind)).toEqual(["session.response_started"]);

    finishProvider?.({ exitCode: 0, stdout: "", stderr: "" });
    await execution;

    appendEvents.mockClear();
    let finishInitialProvider: ((result: { exitCode: number; stdout: string; stderr: string }) => void) | undefined;
    const initialProviderResult = new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
      finishInitialProvider = resolve;
    });
    const initialExecution = executeSessionAssignment({
      assignment: { ...assignment, lease: { ...assignment.lease, providerSessionId: null } },
      client: { appendEvents },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      providerExecutable: "/opt/mystra/bin/codex",
      runProcess: vi.fn(async (_command, _signal, observer) => {
        observer?.onStdoutChunk?.('{"type":"thread.started","thread_id":"provider-');
        observer?.onStdoutChunk?.('thread-2"}\n');
        return initialProviderResult;
      }),
    });

    await vi.waitFor(() => expect(appendEvents).toHaveBeenCalledTimes(1));
    expect(appendEvents.mock.calls[0]![1].map((event) => event.kind)).toEqual([
      "session.provider_started", "session.response_started",
    ]);
    finishInitialProvider?.({
      exitCode: 0,
      stdout: '{"type":"thread.started","thread_id":"provider-thread-2"}\n',
      stderr: "",
    });
    await initialExecution;
  });

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
      providerExecutable: "/opt/mystra/bin/codex",
      runProcess: vi.fn(async () => ({ exitCode: 0, stdout: '{"type":"thread.started","thread_id":"thread-1"}\n{"type":"item.completed","item":{"type":"agent_message","text":"Done"}}\n', stderr: "" })),
    });
    const events = appendEvents.mock.calls.flatMap((call) => call[1]);
    expect(events.map((event) => event.kind)).toEqual([
      "session.provider_started", "session.response_started", "session.agent_message_chunk", "session.response_completed",
    ]);
    expect(events[0]?.payload).toEqual({ providerSessionId: "thread-1" });

    const runWithCapability = vi.fn(async (_command: ProviderSessionCommand) => ({
      exitCode: 0,
      stdout: '{"type":"item.completed","item":{"type":"agent_message","text":"accidental execution-code-value-which-is-long-enough echo"}}\n',
      stderr: "",
    }));
    await executeSessionAssignment({
      assignment: {
        ...assignment,
        execution: {
          code: "execution-code-value-which-is-long-enough",
          expiresAt: "2026-08-10T02:00:00.000Z",
          capabilities: ["context:read", "task-status:read", "task-status:transition"],
        },
      },
      client: { appendEvents },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      controlPlaneUrl: "http://127.0.0.1:3000",
      providerExecutable: "/opt/mystra/bin/codex",
      runProcess: runWithCapability,
    });
    expect(runWithCapability.mock.calls[0]![0].argv[0]).toBe("/opt/mystra/bin/codex");
    expect(runWithCapability.mock.calls[0]![0].environment).toMatchObject({
      MYSTRA_CONTROL_PLANE_URL: "http://127.0.0.1:3000",
      MYSTRA_EXECUTION_CODE: "execution-code-value-which-is-long-enough",
      MYSTRA_AGENT_PATH: expect.stringMatching(/\/agent-cli\/bin\/mystra-agent$/u),
    });
    expect(runWithCapability.mock.calls[0]![0].environment.PATH).toContain("agent-cli/bin");
    expect(JSON.stringify(appendEvents.mock.calls.at(-1)?.[1])).not.toContain("execution-code-value-which-is-long-enough");
    expect(JSON.stringify(appendEvents.mock.calls.at(-1)?.[1])).toContain("[REDACTED]");

    appendEvents.mockClear();
    await executeSessionAssignment({
      assignment: { ...assignment, lease: { ...assignment.lease, providerSessionId: "thread-1" } },
      client: { appendEvents },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      providerExecutable: "/opt/mystra/bin/codex",
      runProcess: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" })),
    });
    expect(appendEvents.mock.calls.flatMap((call) => call[1]).map((event) => event.kind)).toEqual([
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
      providerExecutable: "/opt/mystra/bin/codex",
    });
    expect(workspaceFailure.mock.calls[0]![1].map((event) => event.kind)).toEqual(["session.failed"]);
    expect(workspaceFailure.mock.calls[0]![1][0]?.payload).toMatchObject({ code: "workspace_unavailable" });

    const providerFailure = vi.fn(async (_assignment: SessionClaimAssignment, _events: SessionEventInput[]) => undefined);
    await executeSessionAssignment({
      assignment: { ...assignment, session: { ...assignment.session, providerKey: "unsupported" } },
      client: { appendEvents: providerFailure },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      providerExecutable: "/opt/mystra/bin/unsupported",
    });
    expect(providerFailure.mock.calls[0]![1][0]?.payload).toMatchObject({ code: "provider_unavailable" });

    const cancellation = vi.fn(async (_assignment: SessionClaimAssignment, _events: SessionEventInput[]) => undefined);
    const controller = new AbortController();
    controller.abort();
    await executeSessionAssignment({
      assignment,
      client: { appendEvents: cancellation },
      workspace: { resolveReadyWorkspace: vi.fn(async () => ({ directory: "/workspace" })) },
      providerExecutable: "/opt/mystra/bin/codex",
      runProcess: vi.fn(async () => { throw new Error("aborted"); }),
      signal: controller.signal,
    });
    expect(cancellation.mock.calls[0]![1].map((event) => event.kind)).toEqual([
      "session.response_started", "session.response_canceled",
    ]);
  });
});
