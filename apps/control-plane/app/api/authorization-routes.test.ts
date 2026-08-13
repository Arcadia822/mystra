import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET as listTasks } from "./tasks/route";
import { GET as getTask } from "./tasks/[id]/route";
import { PATCH as renameTeam } from "./teams/[teamId]/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/tasks/task-service-factory", () => ({
  createTaskService: vi.fn(async () => ({ resolveIssue: vi.fn(async () => ({ status: "unavailable" })) })),
}));

const userId = randomUUID();
const teamId = randomUUID();
const taskId = randomUUID();
const taskStatus = {
  productionStatus: "pending" as const,
  statusRevision: 1,
  statusNote: null,
  statusUpdatedAt: "2026-08-07T00:00:00.000Z",
  statusActor: { kind: "system" as const, actorId: null, agentId: null, harnessId: null, sessionId: null },
};
const session = {
  id: randomUUID(),
  userId,
  tokenHash: "digest",
  activeTeamId: teamId,
  expiresAt: "2027-08-07T00:00:00.000Z",
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};
const user = {
  id: userId,
  username: "operator",
  displayUsername: "operator",
  displayName: "Operator",
  status: "active" as const,
  requirePasswordChange: false,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

function authenticatedRequest(url: string, method = "GET", body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      authorization: "Bearer route-test-token",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.mocked(getDb).mockResolvedValue({
    getAuthSessionByTokenHash: vi.fn(async () => session),
    getUserById: vi.fn(async () => user),
    deleteAuthSession: vi.fn(async () => undefined),
    resolveActiveTeam: vi.fn(async () => ({
      team: {
        id: teamId,
        displayName: "Primary",
        status: "active",
        createdAt: "2026-08-07T00:00:00.000Z",
        updatedAt: "2026-08-07T00:00:00.000Z",
      },
      role: "owner",
    })),
    listTasks: vi.fn(async () => [{
      id: taskId,
      teamId,
      title: "Team Task",
      description: null,
      projectId: null,
      issue: null,
      ...taskStatus,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    }]),
    getTask: vi.fn(async (_id: string, options?: { teamId?: string }) => (
      options?.teamId === teamId
        ? {
          id: taskId,
          teamId,
          title: "Team Task",
          description: null,
          projectId: null,
          issue: null,
          ...taskStatus,
          createdAt: "2026-08-07T00:00:00.000Z",
          updatedAt: "2026-08-07T00:00:00.000Z",
        }
        : undefined
    )),
    renameTeam: vi.fn(async () => undefined),
  } as never);
});

describe("management route authorization", () => {
  it("returns a stable unauthenticated result before querying tenant resources", async () => {
    const response = await listTasks(new Request("https://control.example.test/api/tasks"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthenticated", message: "unauthenticated" },
    });
  });

  it("gates management resources until a required password change is complete", async () => {
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      getUserById: vi.fn(async () => ({ ...user, requirePasswordChange: true })),
    } as never);

    const response = await listTasks(authenticatedRequest("https://control.example.test/api/tasks"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "password-change-required", message: "password-change-required" },
    });
  });

  it("rejects an admin attempting an owner-only Team rename", async () => {
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      resolveActiveTeam: vi.fn(async () => ({
        team: {
          id: teamId,
          displayName: "Primary",
          status: "active",
          createdAt: "2026-08-07T00:00:00.000Z",
          updatedAt: "2026-08-07T00:00:00.000Z",
        },
        role: "admin",
      })),
    } as never);

    const response = await renameTeam(
      authenticatedRequest(
        `https://control.example.test/api/teams/${teamId}`,
        "PATCH",
        { displayName: "Renamed" },
      ),
      { params: Promise.resolve({ teamId }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "forbidden", message: "forbidden" },
    });
  });

  it("rejects a state-changing cookie request without a same-origin Origin header", async () => {
    const response = await renameTeam(
      new Request(`https://control.example.test/api/teams/${teamId}`, {
        method: "PATCH",
        headers: {
          cookie: "mystra_session=route-test-cookie-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ displayName: "Renamed" }),
      }),
      { params: Promise.resolve({ teamId }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "csrf-failed", message: "csrf-failed" },
    });
  });

  it("hides cross-Team Tasks behind the same not-found response as absent Tasks", async () => {
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      getTask: vi.fn(async () => undefined),
    } as never);

    const response = await getTask(
      authenticatedRequest(`https://control.example.test/api/tasks/${taskId}`),
      { params: Promise.resolve({ id: taskId }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "TASK_NOT_FOUND", message: `Task not found: ${taskId}` },
    });
    expect(vi.mocked(getDb)).toHaveBeenCalled();
  });

  it("filters a successful Task list by the resolved active Team", async () => {
    const response = await listTasks(authenticatedRequest("https://control.example.test/api/tasks"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tasks: [expect.objectContaining({ teamId })],
    });
    const db = await getDb();
    expect(db.listTasks).toHaveBeenCalledWith({ teamId });
  });

  it("keeps an Issue-derived Task readable when live Issue resolution is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      getTask: vi.fn(async () => ({
        id: taskId,
        teamId,
        title: "Issue Task",
        description: null,
        projectId: randomUUID(),
        issue: {
          provider: "github",
          connectionId: randomUUID(),
          scopeExternalId: "repo-42",
          externalId: "issue-42",
          identifier: "42",
        },
        ...taskStatus,
        createdAt: "2026-08-07T00:00:00.000Z",
        updatedAt: "2026-08-07T00:00:00.000Z",
      })),
    } as never);
    const response = await getTask(authenticatedRequest(`https://control.example.test/api/tasks/${taskId}`), {
      params: Promise.resolve({ id: taskId }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      task: { id: taskId, issue: { externalId: "issue-42" } },
      issueResolution: { status: "unavailable" },
    });
  });
});
