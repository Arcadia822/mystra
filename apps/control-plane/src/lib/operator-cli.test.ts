import { rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createSessionStore, EXIT_CODES, parseArgs, run } from "../../../../scripts/operator-cli.mjs";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function execute(
  argv: string[],
  responder: (url: string, init?: RequestInit) => Response | Promise<Response>,
  overrides: {
    sleep?: (milliseconds: number) => Promise<void>;
    now?: () => number;
    sessionStore?: {
      read: () => Promise<unknown>;
      write: (state: unknown) => Promise<void>;
      clear: () => Promise<void>;
    };
    readPassword?: () => Promise<string>;
    readBinary?: (path: string) => Promise<Uint8Array>;
    writeBinary?: (path: string, value: Uint8Array) => Promise<void>;
  } = {},
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fetchImpl = vi.fn(async (url: URL | string, init?: RequestInit) =>
    await responder(String(url), init));
  const exitCode = await run(argv, {
    fetchImpl,
    stdout: (text: string) => void stdout.push(text),
    stderr: (text: string) => void stderr.push(text),
    sessionStore: {
      read: async () => ({
        version: 1,
        controlPlaneUrl: "http://localhost:3000",
        sessionToken: "operator-cli-test-session-token",
      }),
      write: async () => {},
      clear: async () => {},
    },
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
      provider: "copilot",
      branch: "codex/task-1",
      state,
      result,
      updatedAt: "2026-08-03T00:00:00.000Z",
    },
    project: { slug: "mystra", runtime: { image: "mystra:latest" } },
  };
}

describe("operator CLI Task and Session commands", () => {
  it("parses the canonical Skill command surface and rejects incomplete mutations", () => {
    expect(parseArgs(["skills", "list", "--include-archived", "--json"])).toMatchObject({
      ok: true,
      value: { group: "skills", command: "list", includeArchived: true },
    });
    expect(parseArgs(["skills", "show", "skill-1", "--revision", "2"])).toMatchObject({
      ok: true,
      value: { target: "skill-1", revision: "2" },
    });
    expect(parseArgs(["skills", "upload", "bundle.zip"])).toMatchObject({
      ok: true,
      value: { target: "bundle.zip" },
    });
    expect(parseArgs(["skills", "publish", "skill-1", "bundle.zip", "--expected-revision", "3"])).toMatchObject({
      ok: true,
      value: { target: "skill-1", source: "bundle.zip", expectedRevision: 3 },
    });
    expect(parseArgs(["skills", "preview", "skill-1", "--revision", "rev-1", "--path", "SKILL.md"])).toMatchObject({
      ok: true,
      value: { revision: "rev-1", path: "SKILL.md" },
    });
    expect(parseArgs(["skills", "download", "skill-1", "--revision", "1", "--output", "out.zip"])).toMatchObject({
      ok: true,
      value: { revision: "1", output: "out.zip" },
    });
    expect(parseArgs(["skills", "archive", "skill-1"])).toMatchObject({ ok: false });
    expect(parseArgs(["skills", "publish", "skill-1", "bundle.zip"])).toMatchObject({ ok: false });
    expect(parseArgs(["skills", "preview", "skill-1", "--revision", "1"])).toMatchObject({ ok: false });
  });

  it("executes Skill JSON, raw ZIP, preview, download, and archive requests through canonical APIs", async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const writes: Array<{ path: string; value: Uint8Array }> = [];
    const skillId = "00000000-0000-4000-8000-000000000056";
    const common = {
      readBinary: async (path: string) => {
        expect(path).toBe("bundle.zip");
        return zip;
      },
      writeBinary: async (path: string, value: Uint8Array) => void writes.push({ path, value }),
    };

    const listed = await execute(["skills", "list", "--include-archived", "--json"], async (url) => {
      expect(url).toBe("http://localhost:3000/api/skills?includeArchived=true");
      return response({ skills: [], nextCursor: null });
    }, common);
    const shown = await execute(["skills", "show", skillId, "--revision", "2", "--json"], async (url) => {
      expect(url).toBe(`http://localhost:3000/api/skills/${skillId}/revisions/2`);
      return response({ revision: { id: "revision-2", sequence: 2 } });
    }, common);
    const uploaded = await execute(["skills", "upload", "bundle.zip", "--json"], async (url, init) => {
      expect(url).toBe("http://localhost:3000/api/skills");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ "content-type": "application/zip", "content-length": "4" });
      expect(new Uint8Array(init?.body as ArrayBuffer)).toEqual(zip);
      return response({ skill: { id: skillId, resourceRevision: 1 }, revision: { sequence: 1 } }, 201);
    }, common);
    const published = await execute([
      "skills", "publish", skillId, "bundle.zip", "--expected-revision", "1", "--json",
    ], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/skills/${skillId}/revisions`);
      expect(init?.headers).toMatchObject({ "if-match": '"1"', "content-type": "application/zip" });
      return response({ skill: { id: skillId, resourceRevision: 2 }, revision: { sequence: 2 } }, 201);
    }, common);
    const previewed = await execute([
      "skills", "preview", skillId, "--revision", "2", "--path", "SKILL.md", "--json",
    ], async (url) => {
      expect(url).toBe(`http://localhost:3000/api/skills/${skillId}/revisions/2/file?path=SKILL.md`);
      return response({ kind: "text", content: "# Skill" });
    }, common);
    const downloaded = await execute([
      "skills", "download", skillId, "--revision", "2", "--output", "saved.zip", "--json",
    ], async (url) => {
      expect(url).toBe(`http://localhost:3000/api/skills/${skillId}/revisions/2/download`);
      return new Response(zip, { headers: { "content-type": "application/zip" } });
    }, common);
    const archived = await execute([
      "skills", "archive", skillId, "--expected-revision", "2", "--json",
    ], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/skills/${skillId}/archive`);
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ "if-match": '"2"' });
      return response({ skill: { id: skillId, status: "archived", resourceRevision: 3 } });
    }, common);

    for (const result of [listed, shown, uploaded, published, previewed, downloaded, archived]) {
      expect(result.exitCode).toBe(EXIT_CODES.OK);
    }
    expect(writes).toEqual([{ path: "saved.zip", value: zip }]);
    expect(JSON.parse(downloaded.stdout)).toEqual({ output: "saved.zip", size: 4 });
  });

  it("maps stable Skill failures to operator exit categories without exposing transport internals", async () => {
    const missing = await execute(["skills", "show", sessionId, "--json"], async () => response({
      error: { code: "skill_not_found", message: "Skill not found" },
    }, 404));
    const conflict = await execute(["skills", "archive", sessionId, "--expected-revision", "1", "--json"], async () => response({
      error: { code: "revision_conflict", message: "Skill changed" },
    }, 409));
    const invalid = await execute(["skills", "upload", "bundle.zip", "--json"], async () => response({
      error: { code: "invalid_skill_zip", message: "Invalid ZIP" },
    }, 400), { readBinary: async () => new Uint8Array([1]) });
    expect(missing.exitCode).toBe(EXIT_CODES.MISSING);
    expect(conflict.exitCode).toBe(EXIT_CODES.UNAVAILABLE);
    expect(invalid.exitCode).toBe(EXIT_CODES.INVALID);
  });
  it("does not expose the obsolete Project execution-default create command", () => {
    expect(parseArgs([
      "projects", "create",
      "--name", "Mystra",
      "--slug", "mystra",
      "--repository-integration", "github",
      "--repository", "Arcadia822/mystra",
      "--runtime-image", "mystra:latest",
    ])).toMatchObject({ ok: false });
  });

  it("stores the local human session in a mode-0600 file", async () => {
    const statePath = join(process.cwd(), ".operator-cli-session.test.json");
    const store = createSessionStore(statePath);
    try {
      await rm(statePath, { force: true });
      await store.write({
        version: 1,
        controlPlaneUrl: "http://localhost:3000",
        sessionToken: "operator-cli-test-session-token",
      });

      expect((await stat(statePath)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(statePath, { force: true });
    }
  });

  it("logs in from stdin, persists the opaque session, and never prints it", async () => {
    const saved: unknown[] = [];
    const result = await execute(
      ["auth", "login", "--username", "operator", "--password-stdin", "--json"],
      async (url, init) => {
        expect(url).toBe("http://localhost:3000/api/auth/login");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          username: "operator",
          password: "correct horse battery staple",
        });
        return new Response(JSON.stringify({ user: { id: "user-1", username: "operator" } }), {
          headers: {
            "content-type": "application/json",
            "set-cookie": "mystra_session=opaque-human-session-token; Path=/; HttpOnly",
          },
        });
      },
      {
        readPassword: async () => "correct horse battery staple\n",
        sessionStore: {
          read: async () => undefined,
          write: async (state) => void saved.push(state),
          clear: async () => {},
        },
      },
    );

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(saved).toEqual([{
      version: 1,
      controlPlaneUrl: "http://localhost:3000",
      sessionToken: "opaque-human-session-token",
    }]);
    expect(result.stdout).toContain("operator");
    expect(result.stdout).not.toContain("opaque-human-session-token");
  });

  it("attaches the persisted human session and updates its active Team context", async () => {
    const state = {
      version: 1,
      controlPlaneUrl: "http://localhost:3000",
      sessionToken: "operator-cli-test-session-token",
    };
    const writes: unknown[] = [];
    const teamId = "00000000-0000-4000-8000-000000000099";
    const result = await execute(["teams", "use", teamId, "--json"], async (url, init) => {
      expect(url).toBe("http://localhost:3000/api/teams/switch");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer operator-cli-test-session-token",
      });
      expect(JSON.parse(String(init?.body))).toEqual({ teamId });
      return response({ team: { id: teamId, displayName: "Operations", currentUserRole: "owner" } });
    }, {
      sessionStore: {
        read: async () => state,
        write: async (value) => void writes.push(value),
        clear: async () => {},
      },
    });

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(writes).toEqual([{ ...state, activeTeamId: teamId }]);
    expect(JSON.parse(result.stdout)).toEqual({
      team: { id: teamId, displayName: "Operations", currentUserRole: "owner" },
    });
  });

  it("fails closed before sending protected requests when no local human session exists", async () => {
    const result = await execute(["tasks", "list"], async () => {
      throw new Error("protected request must not be sent");
    }, {
      sessionStore: {
        read: async () => undefined,
        write: async () => {},
        clear: async () => {},
      },
    });

    expect(result.exitCode).toBe(EXIT_CODES.UNAVAILABLE);
    expect(result.stderr).toContain("UNAUTHENTICATED");
  });

  it("rejects removed command groups", () => {
    // legacy-term-audit: allow
    expect(parseArgs(["runs", "list"])).toMatchObject({ ok: false });
    // legacy-term-audit: allow
    expect(parseArgs(["jobs", "list"])).toMatchObject({ ok: false });
  });

  it("creates and inspects Tasks through canonical APIs", async () => {
    const created = await execute([
      "tasks", "create", "--title", "Ship it", "--description", "Durable context",
      "--idempotency-key", "00000000-0000-4000-8000-000000000090", "--json",
    ], async (url, init) => {
      expect(url).toBe("http://localhost:3000/api/tasks");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        title: "Ship it",
        description: "Durable context",
        idempotencyKey: "00000000-0000-4000-8000-000000000090",
      });
      return response({ task: { id: taskId, title: "Ship it", projectId: null, issue: null, description: "Durable context" }, created: true }, 201);
    });
    const inspected = await execute(["tasks", "inspect", taskId, "--json"], async (url) => {
      expect(url).toBe(`http://localhost:3000/api/tasks/${taskId}`);
      return response({ task: { id: taskId, title: "Ship it", projectId: null, issue: null, description: "Durable context" } });
    });

    expect(created.exitCode).toBe(EXIT_CODES.OK);
    expect(inspected.exitCode).toBe(EXIT_CODES.OK);
  });

  it("creates with optional Project and updates Task-owned text", async () => {
    const created = await execute([
      "tasks", "create", "--title", "Project Task", "--project", projectId, "--json",
    ], async (url, init) => {
      expect(url).toBe("http://localhost:3000/api/tasks");
      expect(JSON.parse(String(init?.body))).toMatchObject({ title: "Project Task", projectId });
      expect(JSON.parse(String(init?.body)).idempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
      return response({ task: { id: taskId }, created: true }, 201);
    });
    const updated = await execute([
      "tasks", "update", taskId, "--title", "Renamed", "--description", "New context", "--json",
    ], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/tasks/${taskId}`);
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(String(init?.body))).toEqual({ title: "Renamed", description: "New context" });
      return response({ task: { id: taskId, title: "Renamed" } });
    });
    expect(created.exitCode).toBe(EXIT_CODES.OK);
    expect(updated.exitCode).toBe(EXIT_CODES.OK);
  });

  it("starts Task production without Agent Context through the canonical Start API", async () => {
    const runtimeId = "00000000-0000-4000-8000-000000000020";
    const started = await execute([
      "tasks", "start", taskId,
      "--runtime-id", runtimeId,
      "--provider", "codex",
      "--expected-revision", "1",
      "--idempotency-key", "start-052-1",
      "--json",
    ], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/tasks/${taskId}/production/start`);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        runtimeId,
        providerKey: "codex",
        expectedRevision: 1,
        idempotencyKey: "start-052-1",
      });
      return response({ task: { id: taskId }, created: true });
    });
    expect(started.exitCode).toBe(EXIT_CODES.OK);
    expect(parseArgs(["tasks", "start", taskId, "--runtime-id", runtimeId, "--provider", "codex"]))
      .toMatchObject({ ok: false });
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
      "--provider", "codex",
      "--branch", "codex/investigate",
      "--json",
    ], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/tasks/${taskId}/sessions`);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        title: "Investigate",
        objective: "Find the cause",
        provider: "codex",
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

  it("manages Team-owned Agents through canonical APIs", async () => {
    const agentId = "00000000-0000-4000-8000-000000000012";
    const created = await execute([
      "agents", "create",
      "--name", "Reviewer",
      "--system-prompt", "Review evidence.",
      "--json",
    ], async (url, init) => {
      expect(url).toBe("http://localhost:3000/api/agents");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        name: "Reviewer",
        systemPrompt: "Review evidence.",
      });
      return response({ agent: { id: agentId, name: "Reviewer", revision: 1 } }, 201);
    });
    const listed = await execute([
      "agents", "list", "--limit", "10", "--include-archived", "--json",
    ], async (url) => {
      expect(url).toBe("http://localhost:3000/api/agents?limit=10&includeArchived=true");
      return response({ agents: [{ id: agentId, name: "Reviewer" }], nextCursor: null });
    });
    const inspected = await execute(["agents", "inspect", agentId, "--json"], async (url) => {
      expect(url).toBe(`http://localhost:3000/api/agents/${agentId}`);
      return response({ agent: { id: agentId, name: "Reviewer", revision: 1 } });
    });
    const updated = await execute([
      "agents", "update", agentId,
      "--expected-revision", "1",
      "--system-prompt", "Reject unsupported claims.",
      "--json",
    ], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/agents/${agentId}`);
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(String(init?.body))).toEqual({
        expectedRevision: 1,
        systemPrompt: "Reject unsupported claims.",
      });
      return response({ agent: { id: agentId, revision: 2 } });
    });
    const archived = await execute([
      "agents", "archive", agentId, "--expected-revision", "2", "--json",
    ], async (url, init) => {
      expect(url).toBe(`http://localhost:3000/api/agents/${agentId}/archive`);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ expectedRevision: 2 });
      return response({ agent: { id: agentId, status: "archived", revision: 2 } });
    });

    for (const result of [created, listed, inspected, updated, archived]) {
      expect(result.exitCode).toBe(EXIT_CODES.OK);
    }
  });

  it("requires revision protection for Agent mutations", () => {
    expect(parseArgs(["agents", "update", sessionId, "--name", "Renamed"]))
      .toMatchObject({ ok: false });
    expect(parseArgs(["agents", "archive", sessionId]))
      .toMatchObject({ ok: false });
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
