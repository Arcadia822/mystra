import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET as getControlPlane } from "./control-plane/route";
import { GET as getRunner } from "./runners/[id]/route";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

const runner = {
  id: "00000000-0000-4000-8000-000000000020",
  runnerName: "local-runner",
  capabilities: {
    agents: ["copilot"],
    executor: "docker",
    image: "mystra-copilot:test",
  },
  maxConcurrency: 2,
  activeRunCount: 1,
  staleAfterSeconds: 90,
  lastHeartbeatAt: "2026-07-25T20:00:00.000Z",
  createdAt: "2026-07-25T19:00:00.000Z",
};

const task = {
  job: {
    id: "00000000-0000-4000-8000-000000000010",
    spec: {
      taskId: "TASK-10",
      source: "api",
      projectId: "00000000-0000-4000-8000-000000000001",
      branchName: "codex/task-10",
      prompt: "Implement task 10",
      metadata: {},
    },
    createdAt: "2026-07-25T19:30:00.000Z",
    updatedAt: "2026-07-25T20:00:00.000Z",
  },
  run: {
    id: "00000000-0000-4000-8000-000000000011",
    jobId: "00000000-0000-4000-8000-000000000010",
    state: "running",
    attempt: 1,
    assignedRunnerSessionId: runner.id,
    createdAt: "2026-07-25T19:30:00.000Z",
    updatedAt: "2026-07-25T20:00:00.000Z",
  },
  events: [],
};

beforeEach(() => {
  vi.setSystemTime(new Date("2026-07-25T20:00:30.000Z"));
  vi.mocked(getDb).mockReturnValue({
    listJobs: () => [task],
    listRunners: () => [runner],
  } as never);
});

describe("Control Plane object APIs", () => {
  it("returns one canonical overview projection", async () => {
    const response = await getControlPlane();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      controlPlane: {
        status: "ready",
        tasks: {
          total: 1,
          active: 1,
          queued: 0,
        },
        runners: {
          total: 1,
          online: 1,
          activeRuns: 1,
          maxConcurrency: 2,
          availableCapacity: 1,
        },
        recentTasks: [{ job: { id: task.job.id } }],
      },
    });
  });

  it("returns runner detail with assigned tasks", async () => {
    const response = await getRunner(
      new Request(`http://localhost/api/runners/${runner.id}`),
      { params: Promise.resolve({ id: runner.id }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      runner: { id: runner.id, runnerName: "local-runner" },
      assignedTasks: [{ job: { id: task.job.id } }],
    });
  });

  it("returns a stable missing-runner error", async () => {
    const response = await getRunner(
      new Request("http://localhost/api/runners/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "RUNNER_NOT_FOUND",
        message: "Runner not found: missing",
      },
    });
  });
});
