import { describe, expect, it, vi } from "vitest";

import { EXIT_CODES, parseArgs, run } from "../../../../scripts/operator-cli.mjs";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function execute(argv: string[], payload: unknown) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fetchImpl = vi.fn(async () => response(payload));
  return {
    stdout,
    stderr,
    fetchImpl,
    exitCode: run(argv, {
      fetchImpl,
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
    }),
  };
}

describe("Operator object CLI", () => {
  it("parses the new object command groups and preserves runs", () => {
    expect(parseArgs(["control-plane", "inspect"])).toMatchObject({
      ok: true,
      value: { group: "control-plane", command: "inspect" },
    });
    expect(parseArgs(["runners", "inspect", "runner-1"])).toMatchObject({
      ok: true,
      value: { group: "runners", command: "inspect", target: "runner-1" },
    });
    expect(parseArgs(["tasks", "cancel", "job-1"])).toMatchObject({
      ok: true,
      value: { group: "tasks", command: "cancel", target: "job-1" },
    });
    expect(parseArgs(["runs", "inspect", "job-1"])).toMatchObject({
      ok: true,
      value: { group: "runs", command: "inspect", target: "job-1" },
    });
  });

  it("reads the canonical control-plane projection", async () => {
    const execution = execute(["control-plane", "inspect"], {
      controlPlane: {
        status: "ready",
        checkedAt: "2026-07-25T20:00:00.000Z",
        tasks: {
          total: 2,
          queued: 1,
          active: 1,
          waitingForReview: 0,
          succeeded: 0,
          failed: 0,
        },
        runners: {
          total: 1,
          online: 1,
          stale: 0,
          activeRuns: 1,
          maxConcurrency: 2,
          availableCapacity: 1,
        },
        recentTasks: [],
      },
    });

    expect(await execution.exitCode).toBe(EXIT_CODES.OK);
    expect(execution.fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/api/control-plane" }),
      expect.any(Object),
    );
    expect(execution.stdout.join("")).toContain("Control Plane ready");
    expect(execution.stderr).toEqual([]);
  });

  it("lists and inspects runners through canonical APIs", async () => {
    const runner = {
      id: "runner-1",
      runnerName: "local",
      capabilities: { agents: ["copilot"], executor: "docker", image: "runner:test" },
      activeRunCount: 0,
      maxConcurrency: 2,
      staleAfterSeconds: 90,
      lastHeartbeatAt: new Date().toISOString(),
    };
    const listed = execute(["runners", "list"], { runners: [runner] });
    expect(await listed.exitCode).toBe(EXIT_CODES.OK);
    expect(listed.stdout.join("")).toContain("runner-1");

    const inspected = execute(
      ["runners", "inspect", "runner-1"],
      { runner, assignedTasks: [] },
    );
    expect(await inspected.exitCode).toBe(EXIT_CODES.OK);
    expect(inspected.fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/api/runners/runner-1" }),
      expect.any(Object),
    );
    expect(inspected.stdout.join("")).toContain("Runner local");
  });

  it("uses the existing cancel API for tasks", async () => {
    const execution = execute(["tasks", "cancel", "job-1"], {
      disposition: "canceled",
      snapshot: {
        job: { id: "job-1" },
        run: { state: "canceled" },
      },
    });

    expect(await execution.exitCode).toBe(EXIT_CODES.OK);
    expect(execution.fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/api/jobs/job-1/cancel" }),
      expect.objectContaining({ method: "POST" }),
    );
    expect(execution.stdout.join("")).toContain("Cancel job-1");
  });
});
