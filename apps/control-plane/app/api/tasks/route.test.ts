import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { RdbError } from "@/lib/db/prisma-errors";
import { GET, POST } from "./route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const teamId = randomUUID();
const userId = randomUUID();
const taskId = randomUUID();
const timestamp = "2026-08-17T00:00:00.000Z";
const task = {
  id: taskId,
  teamId,
  title: "Frontend fusion",
  description: null,
  projectId: null,
  issue: null,
  status: "blocked" as const,
  metadata: { Area: "FrontEnd", priority: 2 },
  statusRevision: 2,
  statusNote: "Ready for review",
  statusUpdatedAt: timestamp,
  statusActor: { kind: "agent" as const, actorId: null, agentId: randomUUID(), attemptId: randomUUID(), sessionId: randomUUID() },
  createdAt: timestamp,
  updatedAt: timestamp,
};

function request(url: string, init?: RequestInit) {
  return new Request(url, { ...init, headers: { authorization: "Bearer task-route-token", ...(init?.headers ?? {}) } });
}

function database() {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({ id: randomUUID(), userId, tokenHash: "digest", activeTeamId: teamId, expiresAt: "2027-08-17T00:00:00.000Z", createdAt: timestamp, updatedAt: timestamp })),
    getUserById: vi.fn(async () => ({ id: userId, username: "owner", displayUsername: "owner", displayName: "Owner", status: "active", requirePasswordChange: false, createdAt: timestamp, updatedAt: timestamp })),
    resolveActiveTeam: vi.fn(async () => ({ team: { id: teamId, displayName: "Team", status: "active", createdAt: timestamp, updatedAt: timestamp }, role: "owner" })),
    listTaskPage: vi.fn(async () => ({ items: [{ ...task, projectReference: null }], nextCursor: "next-page" })),
    createTask: vi.fn(async (input: { metadata?: Record<string, unknown> }) => ({ task: { ...task, status: "pending" as const, statusRevision: 1, statusNote: null, metadata: input.metadata ?? {} }, created: true })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue(database() as never);
});

describe("Task workbench route", () => {
  it("parses the strict page query, scopes it to the active Team, and keeps metadata inside Task", async () => {
    const response = await GET(request("http://localhost/api/tasks?query=frontend&status=blocked&sort=title&direction=asc&limit=25"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ items: [expect.objectContaining({ id: taskId, status: "blocked", metadata: task.metadata })], nextCursor: "next-page" });
    expect(payload.items[0]).not.toHaveProperty("productionStatus");
    expect(payload).not.toHaveProperty("labels");
    const db = await getDb();
    expect(db.listTaskPage).toHaveBeenCalledWith({ teamId, cursor: null, limit: 25, query: "frontend", statuses: ["blocked"], sort: "title", direction: "asc" });
  });

  it("returns 400 for obsolete filters and invalid or mismatched cursors", async () => {
    expect((await GET(request("http://localhost/api/tasks?status=waiting_for_review"))).status).toBe(400);
    expect((await GET(request("http://localhost/api/tasks?mystery=value"))).status).toBe(400);
    const db = await getDb();
    vi.mocked(db.listTaskPage).mockRejectedValueOnce(new RdbError("RDB_INVALID_INPUT", "Task page cursor does not match this query"));
    expect((await GET(request("http://localhost/api/tasks?cursor=invalid"))).status).toBe(400);
  });

  it("defaults and nests metadata during manual create", async () => {
    const response = await POST(request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Created", idempotencyKey: randomUUID() }),
    }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ task: { metadata: {} }, created: true });
    const db = await getDb();
    expect(db.createTask).toHaveBeenCalledWith(expect.objectContaining({ teamId, metadata: {} }));
  });
});
