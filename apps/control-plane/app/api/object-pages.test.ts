import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET as getControlPlane } from "./control-plane/route";
import { GET as getRunner } from "./runners/[id]/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const runner = {
  id: "00000000-0000-4000-8000-000000000020",
  name: "local-runner",
  capabilities: { agents: ["copilot"], executor: "docker" },
  maxConcurrency: 2,
  activeSessionCount: 1,
  health: "healthy",
  staleAfterSeconds: 90,
  currentAssignments: [{
    taskId: "00000000-0000-4000-8000-000000000010",
    sessionId: "00000000-0000-4000-8000-000000000011",
  }],
  lastHeartbeatAt: "2026-08-03T12:00:00.000Z",
  createdAt: "2026-08-03T11:00:00.000Z",
  updatedAt: "2026-08-03T12:00:00.000Z",
};

const task = {
  id: "00000000-0000-4000-8000-000000000010",
  projectId: "00000000-0000-4000-8000-000000000001",
  source: "api",
  objective: "Implement the slice",
  repository: { fullName: "arcadia/mystra" },
  metadata: {},
  sessionCount: 1,
  activeSessionCount: 1,
  createdAt: "2026-08-03T11:30:00.000Z",
  updatedAt: "2026-08-03T12:00:00.000Z",
};

const session = {
  id: "00000000-0000-4000-8000-000000000011",
  taskId: task.id,
  state: "running",
};

beforeEach(() => {
  vi.mocked(getDb).mockReturnValue({
    listTasks: () => [task],
    listSessions: () => [session],
    listRunners: () => [runner],
    getRunner: (id: string) => id === runner.id ? runner : undefined,
  } as never);
});

describe("Control Plane object APIs", () => {
  it("returns distinct Task, Session, and Runner summaries", async () => {
    const response = await getControlPlane();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      controlPlane: {
        status: "ready",
        tasks: { total: 1, withoutSessions: 0 },
        sessions: { total: 1, active: 1, queued: 0 },
        runners: { total: 1, online: 1, activeSessions: 1, maxConcurrency: 2, availableCapacity: 1 },
        recentTasks: [{ id: task.id }],
      },
    });
  });

  it("returns stable Runner identity and current Session assignments", async () => {
    const response = await getRunner(
      new Request(`http://localhost/api/runners/${runner.id}`),
      { params: Promise.resolve({ id: runner.id }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      runner: {
        id: runner.id,
        name: "local-runner",
        currentAssignments: [{ taskId: task.id, sessionId: session.id }],
      },
    });
  });

  it("returns a stable missing Runner error", async () => {
    const response = await getRunner(
      new Request("http://localhost/api/runners/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "RUNNER_NOT_FOUND", message: "Runner not found: missing" },
    });
  });
});
