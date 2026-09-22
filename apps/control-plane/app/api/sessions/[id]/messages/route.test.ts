import { describe, expect, it, vi } from "vitest";

import { SessionFailure } from "@/lib/sessions/session-errors";
import { POST } from "./route";

const sessionId = "00000000-0000-4000-8000-000000000049";
const messageId = "00000000-0000-4000-8000-000000000050";

const services = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock("@/lib/sessions/session-service-factory", () => ({
  createSessionService: () => ({
    sendMessage: services.sendMessage,
  }),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => ({})),
}));

vi.mock("../../../_auth", () => ({
  requireHumanSession: vi.fn(async () => ({
    user: { id: "user-1" },
  })),
  requireTeamPermission: vi.fn(async () => ({
    team: { id: "team-1" },
    role: "owner",
  })),
  authorizationErrorResponse: vi.fn(() => {
    throw new Error("not auth error");
  }),
}));

function dummySession() {
  return {
    id: sessionId,
    teamId: "00000000-0000-4000-8000-000000000001",
    taskId: "00000000-0000-4000-8000-000000000002",
    projectId: null,
    runtimeId: "00000000-0000-4000-8000-000000000003",
    providerKey: "codex",
    agentId: null,
    agentRevision: null,
    state: "ready" as const,
    activeMessageId: null,
    lastMessageId: messageId,
    interruptKind: null,
    continuationMode: null,
    failureCode: null,
    metadata: {},
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  };
}

describe("POST /api/sessions/[id]/messages", () => {
  it("returns one accepted status and reports dispatch delivery", async () => {
    services.sendMessage.mockResolvedValueOnce({
      session: dummySession(),
      created: true,
      delivery: "dispatch",
      messageId,
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Hello from test" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.created).toBe(true);
    expect(body.delivery).toBe("dispatch");
    expect(body.messageId).toBe(messageId);
  });

  it("returns 409 Conflict while the Session is busy", async () => {
    services.sendMessage.mockRejectedValueOnce(
      new SessionFailure("session_busy", "Session Provider cannot append while execution is active"),
    );

    const request = new Request(`http://localhost/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Concurrent instruction" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("session_busy");
  });

  it("uses the same accepted status for idempotent replay", async () => {
    services.sendMessage.mockResolvedValueOnce({
      session: dummySession(),
      created: false,
      delivery: "dispatch",
      messageId,
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, content: "Replay" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.created).toBe(false);
    expect(body.delivery).toBe("dispatch");
  });

  it("returns 400 Bad Request on terminal session", async () => {
    services.sendMessage.mockRejectedValueOnce(
      new SessionFailure("session_terminal", "Terminal Session cannot accept messages"),
    );

    const request = new Request(`http://localhost/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Should fail" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("session_terminal");
  });

  it("returns 409 Conflict on message conflict", async () => {
    services.sendMessage.mockRejectedValueOnce(
      new SessionFailure("session_conflict", "messageId was reused with different content"),
    );

    const request = new Request(`http://localhost/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, content: "Conflicting" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("session_conflict");
  });
});
