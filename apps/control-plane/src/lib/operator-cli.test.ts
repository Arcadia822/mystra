import { describe, expect, it, vi } from "vitest";

import { EXIT_CODES, parseArgs, run } from "../../../../scripts/operator-cli.mjs";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function execute(
  argv: string[],
  responder: (url: string, init?: RequestInit) => Response | Promise<Response>,
  overrides: { sleep?: (milliseconds: number) => Promise<void>; now?: () => number } = {},
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fetchImpl = vi.fn(async (url: URL | string, init?: RequestInit) =>
    await responder(String(url), init));
  const exitCode = await run(argv, {
    fetchImpl,
    stdout: (text: string) => void stdout.push(text),
    stderr: (text: string) => void stderr.push(text),
    ...overrides,
  });
  return { exitCode, stdout: stdout.join(""), stderr: stderr.join(""), fetchImpl };
}

const taskId = "00000000-0000-4000-8000-000000000010";
const sessionId = "00000000-0000-4000-8000-000000000011";
const projectId = "00000000-0000-4000-8000-000000000001";

function sessionDetail(state = "succeeded", result: Record<string, unknown> | undefined = {
  status: "succeeded",
  summary: "Created the requested review",
  branch: "codex/task-1",
  reviewResult: { review: { url: "https://example.com/review/1" } },
}) {
  return {
    task: {
      id: taskId,
      projectId,
      objective: "Deliver the change",
      repository: { fullName: "arcadia/mystra" },
    },
    session: {
      id: sessionId,
      taskId,
      title: "Implementation",
      objective: "Implement the slice",
      agent: "copilot",
      branch: "codex/task-1",
      state,
      result,
      updatedAt: "2026-08-03T00:00:00.000Z",
    },
    project: { slug: "mystra", runtime: { image: "mystra:latest" } },
  };
}

describe("operator CLI Task and Session commands", () => {
  it("rejects removed command groups", () => {
    // legacy-term-audit: allow
    expect(parseArgs(["runs", "list"])).toMatchObject({ ok: false });
    // legacy-term-audit: allow
    expect(parseArgs(["jobs", "list"])).toMatchObject({ ok: false });
  });

  it("creates and inspects Tasks through canonical APIs", async () => {
    const created = await execute([
      "tasks", "create", "--project", projectId, "--objective", "Ship it", "--json",
    ], async (url, init) => {
      expect(url).toBe("http://localhost:3000/api/tasks");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        source: "api",
        projectId,
        objective: "Ship it",
      });
      return response({ task: { id: taskId } }, 201);
    });
    const inspected = await execute(["tasks", "inspect", taskId, "--json"], async (url) => {
      expect(url).toBe(`http://localhost:3000/api/tasks/${taskId}`);
      return response({ task: { id: taskId }, sessionSummary: { sessionCount: 0, activeSessionCount: 0 } });
    });

    expect(created.exitCode).toBe(EXIT_CODES.OK);
    expect(inspected.exitCode).toBe(EXIT_CODES.OK);
  });

  it("lists and creates independent Sessions beneath one Task", async () => {
    const listed = await execute(["sessions", "list", taskId, "--json"], async (url) => {
      expect(url).toBe(`http://localhost:3000/api/tasks/${taskId}/sessions`);
      return response({ taskId, sessions: [] });
    });
    const created = await execute([
      "sessions", "create", taskId,
      "--title", "Investigate",
      "--objective", "Find the cause",
      "--agent", "codex",
      "--branch", "codex/investigate",
      "--json",
    ], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/tasks/${taskId}/sessions`);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        title: "Investigate",
        objective: "Find the cause",
        agent: "codex",
        branch: "codex/investigate",
      });
      return response({ session: { id: sessionId } }, 201);
    });

    expect(listed.exitCode).toBe(EXIT_CODES.OK);
    expect(created.exitCode).toBe(EXIT_CODES.OK);
  });

  it("waits for a terminal Session and prints the review handoff", async () => {
    let polls = 0;
    const result = await execute([
      "sessions", "wait", sessionId, "--interval-seconds", "1", "--timeout-seconds", "10",
    ], async (url) => {
      expect(url).toBe(`http://localhost:3000/api/sessions/${sessionId}`);
      polls += 1;
      return response(polls === 1
        ? sessionDetail("running", undefined)
        : sessionDetail("waiting_for_review", {
            status: "waiting_for_review",
            summary: "Ready",
            branch: "codex/task-1",
            reviewResult: { review: { url: "https://example.com/review/1" } },
          }));
    }, { sleep: async () => {}, now: () => 0 });

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(polls).toBe(2);
    expect(result.stdout).toContain("Waiting for review");
    expect(result.stdout).toContain("https://example.com/review/1");
  });

  it("cancels exactly one Session", async () => {
    const result = await execute(["sessions", "cancel", sessionId], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/sessions/${sessionId}/cancel`);
      expect(init?.method).toBe("POST");
      return response({ outcome: "canceled", session: sessionDetail("canceled").session });
    });

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain(`Cancel ${sessionId}`);
  });

  it("maps Session not-found and wait timeout to stable exit codes", async () => {
    const missing = await execute(["sessions", "inspect", sessionId], async () => response({
      error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
    }, 404));
    const times = [0, 1_001];
    const timeout = await execute([
      "sessions", "wait", sessionId, "--timeout-seconds", "1", "--json",
    ], async () => response(sessionDetail("running", undefined)), {
      sleep: async () => {},
      now: () => times.shift() ?? 1_001,
    });

    expect(missing.exitCode).toBe(EXIT_CODES.MISSING);
    expect(timeout.exitCode).toBe(EXIT_CODES.NOT_READY);
    expect(JSON.parse(timeout.stderr)).toMatchObject({
      code: "WAIT_TIMEOUT",
      payload: { sessionId },
    });
  });

  it("returns result and failure projections without exposing internal events", async () => {
    const result = await execute(["sessions", "result", sessionId, "--json"], async () => response(sessionDetail()));
    const failure = await execute(["sessions", "failure", sessionId, "--json"], async () => response(sessionDetail("failed", {
      status: "failed",
      summary: "Tests failed",
      errorCode: "QUALITY_FAILED",
      errorMessage: "Vitest failed",
    })));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(JSON.parse(result.stdout)).toMatchObject({ taskId, sessionId, sessionState: "succeeded" });
    expect(failure.exitCode).toBe(EXIT_CODES.OK);
    expect(JSON.parse(failure.stdout).result.errorCode).toBe("QUALITY_FAILED");
    expect(result.stdout).not.toContain("events");
  });
});
