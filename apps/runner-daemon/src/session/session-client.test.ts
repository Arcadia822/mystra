import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionClaimAssignmentSchema, type SessionClaimAssignment } from "@mystra/shared";

import { HttpSessionControlPlaneClient, SessionClientHttpError } from "./session-client.js";

function assignment(): SessionClaimAssignment {
  return sessionClaimAssignmentSchema.parse({
    session: {
      id: "00000000-0000-4000-8000-000000000001",
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
      sessionId: "00000000-0000-4000-8000-000000000001",
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
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("HttpSessionControlPlaneClient", () => {
  it("claims with Runtime and runner identity and validates the assignment", async () => {
    const expected = assignment();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ assignment: expected }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new HttpSessionControlPlaneClient("https://control.example.test").claim(
      expected.session.runtimeId,
      expected.lease.runnerId,
      12,
    );

    expect(result).toEqual(expected);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://control.example.test/api/runner/sessions/claim"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-mystra-runtime-id": expected.session.runtimeId }),
        body: JSON.stringify({ runnerId: expected.lease.runnerId, waitSeconds: 12 }),
      }),
    );
  });

  it("returns undefined for an empty claim", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(new HttpSessionControlPlaneClient("https://control.example.test").claim(
      assignment().session.runtimeId,
      "runner-1",
      0,
    )).resolves.toBeUndefined();
  });

  it("retries an identical event batch on 5xx and sends the lease token in both header and body", async () => {
    vi.useFakeTimers();
    const expected = assignment();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const event = {
      eventId: "00000000-0000-4000-8000-000000000010",
      sessionId: expected.session.id,
      sourceId: "runner-1:message-1",
      sourceSequence: 1,
      kind: "session.response_started" as const,
      version: 1 as const,
      messageId: expected.message.messageId,
      payload: {},
      metadata: {},
      occurredAt: "2026-08-10T00:00:01.000Z",
    };
    const pending = new HttpSessionControlPlaneClient("https://control.example.test")
      .appendEvents(expected, [event]);
    await vi.runAllTimersAsync();
    await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = fetchMock.mock.calls[0]![1] as RequestInit;
    const second = fetchMock.mock.calls[1]![1] as RequestInit;
    expect(first.body).toBe(second.body);
    expect(first.headers).toMatchObject({ "x-mystra-lease-token": expected.lease.leaseToken });
    expect(JSON.parse(String(first.body))).toMatchObject({ leaseToken: expected.lease.leaseToken });
  });

  it("does not retry a 4xx response or expose its body in the thrown error", async () => {
    const secret = "authorization=do-not-leak";
    const fetchMock = vi.fn(async () => new Response(secret, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);

    const expected = assignment();
    const event = {
      eventId: "00000000-0000-4000-8000-000000000010",
      sessionId: expected.session.id,
      sourceId: "runner-1:message-1",
      sourceSequence: 1,
      kind: "session.response_started" as const,
      version: 1 as const,
      messageId: expected.message.messageId,
      payload: {},
      metadata: {},
      occurredAt: "2026-08-10T00:00:01.000Z",
    };
    const error = await new HttpSessionControlPlaneClient("https://control.example.test")
      .appendEvents(expected, [event])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SessionClientHttpError);
    expect(String(error)).not.toContain(secret);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
