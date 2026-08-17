import { describe, expect, it, vi } from "vitest";

import { runAgentCli } from "./cli.js";

const execution = {
  teamId: "00000000-0000-4000-8000-000000000001",
  taskId: "00000000-0000-4000-8000-000000000002",
  attemptId: "00000000-0000-4000-8000-000000000003",
  sessionId: "00000000-0000-4000-8000-000000000004",
  agentContext: null,
  expiresAt: "2026-08-11T06:00:00.000Z",
};

function io() {
  let value = "";
  return { write(chunk: string) { value += chunk; }, read: () => value };
}

describe("mystra-agent CLI", () => {
  it("composes the actual cwd into context without printing the code", async () => {
    const stdout = io();
    const stderr = io();
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: "Bearer secret-code" });
      return Response.json({
        version: 1,
        execution,
        task: { title: "Frozen", description: null, issue: null },
        project: {
          id: "00000000-0000-4000-8000-000000000006",
          repositoryConnectionId: "00000000-0000-4000-8000-000000000007",
          repositoryExternalId: "owner/repo",
          repositoryBaseBranch: "main",
        },
        workspace: { id: "00000000-0000-4000-8000-000000000008", branch: "task/frozen" },
        capabilities: ["context:read", "task-status:read", "task-status:transition"],
      });
    });
    expect(await runAgentCli({
      argv: ["context", "get"],
      env: { MYSTRA_CONTROL_PLANE_URL: "http://localhost:3000", MYSTRA_EXECUTION_CODE: "secret-code" },
      cwd: () => "/tmp/workspace",
      fetch: fetchMock as typeof fetch,
      stdout,
      stderr,
    })).toBe(0);
    expect(JSON.parse(stdout.read()).workspace.root).toBe("/tmp/workspace");
    expect(stdout.read()).not.toContain("secret-code");
    expect(stderr.read()).toBe("");
  });

  it("sends only allowlisted status fields and emits stable JSON errors", async () => {
    const stdout = io();
    const stderr = io();
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        status: "blocked", expectedRevision: 2, idempotencyKey: "cmd-1", note: "linctl unavailable",
      });
      return Response.json({ taskId: execution.taskId, status: "blocked", statusRevision: 3, statusUpdatedAt: "2026-08-11T00:00:00.000Z", transitionId: "00000000-0000-4000-8000-000000000009" });
    });
    expect(await runAgentCli({
      argv: ["task", "status", "set", "blocked", "--expected-revision", "2", "--idempotency-key", "cmd-1", "--note", "linctl unavailable"],
      env: { MYSTRA_CONTROL_PLANE_URL: "http://localhost:3000", MYSTRA_EXECUTION_CODE: "secret-code" },
      cwd: () => "/tmp/workspace", fetch: fetchMock as typeof fetch, stdout, stderr,
    })).toBe(0);
    expect(JSON.parse(stdout.read()).status).toBe("blocked");
    expect(stderr.read()).toBe("");
  });

  it("fails closed before network access when execution identity is missing", async () => {
    const stdout = io();
    const stderr = io();
    expect(await runAgentCli({
      argv: ["whoami"], env: { MYSTRA_CONTROL_PLANE_URL: "http://localhost:3000" },
      cwd: () => "/tmp", fetch: vi.fn() as unknown as typeof fetch, stdout, stderr,
    })).toBe(1);
    expect(JSON.parse(stderr.read()).error.code).toBe("capability_expired");
    expect(stdout.read()).toBe("");
  });
});
