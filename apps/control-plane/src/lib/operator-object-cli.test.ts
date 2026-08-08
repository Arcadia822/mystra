import { describe, expect, it, vi } from "vitest";

import { EXIT_CODES, run } from "../../../../scripts/operator-cli.mjs";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const operatorSession = {
  version: 1,
  controlPlaneUrl: "http://localhost:3000",
  sessionToken: "operator-session-token-accepted",
  activeTeamId: "00000000-0000-4000-8000-000000000001",
};

async function execute(argv: string[], payload: unknown) {
  const stdout: string[] = [];
  const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.headers).toMatchObject({
      authorization: `Bearer ${operatorSession.sessionToken}`,
    });
    return response(payload);
  });
  const exitCode = await run(argv, {
    fetchImpl,
    stdout: (text: string) => void stdout.push(text),
    stderr: () => {},
    sessionStore: {
      read: async () => operatorSession,
    },
  });
  return { exitCode, stdout: stdout.join(""), fetchImpl };
}

describe("Operator object CLI", () => {
  it("reads the control-plane Task, Session, and Runner projection", async () => {
    const execution = await execute(["control-plane", "inspect"], {
      controlPlane: {
        status: "ready",
        checkedAt: "2026-08-03T00:00:00.000Z",
        tasks: { total: 2, withoutSessions: 1 },
        sessions: { total: 2, queued: 1, active: 1, waitingForReview: 0, failed: 0 },
        runners: { total: 1, online: 1, stale: 0, activeSessions: 1, maxConcurrency: 2, availableCapacity: 1 },
        recentTasks: [],
      },
    });

    expect(execution.exitCode).toBe(EXIT_CODES.OK);
    expect(execution.stdout).toContain("tasks: 2 total");
    expect(execution.stdout).toContain("sessions: 2 total");
  });

  it("lists and inspects stable Runners", async () => {
    const runner = {
      id: "00000000-0000-4000-8000-000000000030",
      name: "local",
      capabilities: { executionProviders: ["copilot"], executor: "docker" },
      activeSessionCount: 0,
      maxConcurrency: 2,
      health: "healthy",
      currentAssignments: [],
      lastHeartbeatAt: "2026-08-03T00:00:00.000Z",
    };
    const listed = await execute(["runners", "list"], { runners: [runner] });
    const inspected = await execute(["runners", "inspect", runner.id], { runner });

    expect(listed.exitCode).toBe(EXIT_CODES.OK);
    expect(listed.stdout).toContain("local | healthy");
    expect(inspected.exitCode).toBe(EXIT_CODES.OK);
    expect(inspected.stdout).toContain("Runner local");
  });
});
