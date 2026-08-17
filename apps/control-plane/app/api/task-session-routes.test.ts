import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET as getSession } from "./sessions/[id]/route";
import { GET as getSessionEvents } from "./sessions/[id]/events/route";
import { GET as listTaskSessions, POST as launchTaskSession } from "./tasks/[id]/sessions/route";

const services = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  listEvents: vi.fn(),
  launch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/sessions/session-service-factory", () => ({
  createSessionService: vi.fn(() => services),
}));
vi.mock("@/lib/sessions/task-session-launch-service-factory", () => ({
  createTaskSessionLaunchService: vi.fn(() => services),
}));

const userId = randomUUID();
const teamId = randomUUID();
const taskId = randomUUID();
const sessionId = randomUUID();
const runtimeId = randomUUID();
const agentId = randomUUID();
const timestamp = "2026-08-10T00:00:00.000Z";
const session = {
  id: sessionId,
  teamId,
  taskId,
  projectId: null,
  runtimeId,
  providerKey: "codex",
  agentId,
  agentRevision: 1,
  state: "queued" as const,
  activeMessageId: randomUUID(),
  lastMessageId: null,
  interruptKind: null,
  continuationMode: null,
  failureCode: null,
  metadata: {},
  createdAt: timestamp,
  updatedAt: timestamp,
};

function db() {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({
      id: randomUUID(), userId, activeTeamId: teamId, expiresAt: "2027-08-10T00:00:00.000Z",
    })),
    getUserById: vi.fn(async () => ({ id: userId, status: "active", requirePasswordChange: false })),
    resolveActiveTeam: vi.fn(async () => ({ team: { id: teamId, status: "active" }, role: "member" })),
  };
}

function request(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { authorization: "Bearer route-test-token-050", ...init.headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue(db() as never);
  services.get.mockResolvedValue(session);
  services.list.mockResolvedValue([session]);
  services.launch.mockResolvedValue({ state: "ready", session, created: true });
  services.listEvents.mockResolvedValue({
    events: [2, 1].map((globalSequence) => ({
      eventId: randomUUID(),
      sessionId,
      sourceId: "control-plane",
      sourceSequence: globalSequence,
      globalSequence,
      kind: "session.agent_message_chunk" as const,
      version: 1 as const,
      messageId: session.activeMessageId,
      payload: { text: `chunk-${globalSequence}` },
      metadata: {},
      occurredAt: timestamp,
      acceptedAt: timestamp,
    })),
    olderCursor: 1,
  });
});

describe("Task Session human routes", () => {
  it("lists direct Session objects and launches from the authenticated Team", async () => {
    const listed = await listTaskSessions(request(`http://localhost/api/tasks/${taskId}/sessions?limit=50`), {
      params: Promise.resolve({ id: taskId }),
    });
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual({ sessions: [session] });
    expect(services.list).toHaveBeenCalledWith({
      actor: { actorId: userId, teamId, roles: ["member"] }, taskId, limit: 51,
    });

    const input = { sessionId, providerKey: "codex", agentId, manualContext: { text: "Inspect first" } };
    const launched = await launchTaskSession(request(`http://localhost/api/tasks/${taskId}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }), { params: Promise.resolve({ id: taskId }) });
    expect(launched.status).toBe(201);
    expect(services.launch).toHaveBeenCalledWith({
      actor: { actorId: userId, teamId, roles: ["member"] }, taskId, request: input,
    });

    const standardInput = { sessionId: randomUUID(), providerKey: "codex" };
    const standardLaunch = await launchTaskSession(request(`http://localhost/api/tasks/${taskId}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(standardInput),
    }), { params: Promise.resolve({ id: taskId }) });
    expect(standardLaunch.status).toBe(201);
    expect(services.launch).toHaveBeenLastCalledWith({
      actor: { actorId: userId, teamId, roles: ["member"] },
      taskId,
      request: { ...standardInput, agentId: null },
    });
  });

  it("returns Session detail and reverses bounded latest events into global order", async () => {
    const detail = await getSession(request(`http://localhost/api/sessions/${sessionId}`), {
      params: Promise.resolve({ id: sessionId }),
    });
    await expect(detail.json()).resolves.toEqual({ session });

    const events = await getSessionEvents(request(`http://localhost/api/sessions/${sessionId}/events?latest=2`), {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(events.status).toBe(200);
    const payload = await events.json();
    expect(payload.events.map((event: { globalSequence: number }) => event.globalSequence)).toEqual([1, 2]);
    expect(payload).toMatchObject({ olderCursor: 1, nextAfterSequence: 2 });
    expect(services.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      sessionId, limit: 2, order: "desc",
    }));
  });

  it("rejects ambiguous event windows before reading event storage", async () => {
    const response = await getSessionEvents(request(
      `http://localhost/api/sessions/${sessionId}/events?latest=2&afterSequence=1`,
    ), { params: Promise.resolve({ id: sessionId }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "event_window_invalid" } });
    expect(services.listEvents).not.toHaveBeenCalled();
  });

  it("authenticates launch before exposing request validation", async () => {
    const response = await launchTaskSession(new Request(`http://localhost/api/tasks/${taskId}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    }), { params: Promise.resolve({ id: taskId }) });
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(services.launch).not.toHaveBeenCalled();
  });

  it("returns 202 while the locked Runtime prepares the Task Workspace", async () => {
    services.launch.mockResolvedValueOnce({ state: "preparing", sessionId });
    const response = await launchTaskSession(request(`http://localhost/api/tasks/${taskId}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, providerKey: "codex" }),
    }), { params: Promise.resolve({ id: taskId }) });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ state: "preparing", sessionId });
  });
});
