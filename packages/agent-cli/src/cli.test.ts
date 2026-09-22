import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import { ZipFile } from "yazl";

import { runAgentCli } from "./cli.js";

const execution = {
  teamId: "00000000-0000-4000-8000-000000000001",
  taskId: "00000000-0000-4000-8000-000000000002",
  executionContextId: "00000000-0000-4000-8000-000000000003",
  sessionId: "00000000-0000-4000-8000-000000000004",
  agentContext: null,
  expiresAt: "2026-08-11T06:00:00.000Z",
};

function io() {
  let value = "";
  return { write(chunk: string) { value += chunk; }, read: () => value };
}

describe("mystra-agent CLI", () => {
  it("reconciles and reports the exact current generation in the bound cwd before printing authority", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mystra-agent-workflow-"));
    const workspaceId = "00000000-0000-4000-8000-000000000007";
    const skillId = "00000000-0000-4000-8000-000000000008";
    const revisionId = "00000000-0000-4000-8000-000000000009";
    try {
      await writeFile(path.join(root, ".mystra-workspace.json"), JSON.stringify({ version: 1, workspaceId }));
      const archive = new ZipFile();
      archive.addBuffer(Buffer.from("fixed"), "SKILL.md");
      archive.end();
      const chunks: Buffer[] = [];
      for await (const chunk of archive.outputStream) chunks.push(Buffer.from(chunk));
      const zipped = Buffer.concat(chunks);
      const reportBodies: unknown[] = [];
      const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
        const pathname = new URL(String(url)).pathname;
        if (pathname.endsWith("/workflow/current")) return Response.json({
          workflow: { id: "mystra.workflow", name: "Mystra Workflow" },
          state: { stageId: "understand", stateVersion: 1, terminal: false },
          stage: { name: "Understand", instructions: "Understand." },
          requiredSkills: [{ skillId, revisionId, revision: 1, path: `.mystra/skills/${skillId}`, zipSha256: createHash("sha256").update(zipped).digest("hex") }],
          materialization: { workspaceId, generation: 1, removals: [], entries: [{
            skillId, revisionId, relativePath: `.mystra/skills/${skillId}`,
            zipSha256: createHash("sha256").update(zipped).digest("hex"),
            manifest: [{ path: "SKILL.md", sizeBytes: 5, sha256: createHash("sha256").update("fixed").digest("hex"), mediaType: "text/markdown", previewability: "text" }],
            downloadPath: `/api/agent-execution/workflow/skills/${skillId}/revisions/${revisionId}/download`,
          }] },
          availableActions: [{ id: "understanding-complete", label: "Understanding complete", nextStageId: "implement" }],
          projection: { generation: 1, status: "pending", retryable: true },
        });
        if (pathname.endsWith("/download")) return new Response(new Uint8Array(zipped), { headers: { "content-length": String(zipped.length) } });
        if (pathname.endsWith("/skills/report")) {
          reportBodies.push(JSON.parse(String(init?.body)));
          return Response.json({ accepted: true });
        }
        return new Response(null, { status: 404 });
      });
      const stdout = io();
      expect(await runAgentCli({
        argv: ["workflow", "current", "--json"],
        env: { MYSTRA_CONTROL_PLANE_URL: "http://localhost:3000", MYSTRA_EXECUTION_CODE: "secret-code" },
        cwd: () => root, fetch: fetchMock as typeof fetch, stdout, stderr: io(),
      })).toBe(0);
      expect(await readFile(path.join(root, `.mystra/skills/${skillId}/SKILL.md`), "utf8")).toBe("fixed");
      expect(reportBodies).toEqual([{ workspaceId, generation: 1, results: [{ skillId, status: "ready", failureCode: null }] }]);
      expect(JSON.parse(stdout.read()).state.stateVersion).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports only static Workflow current/transition commands and preserves an explicit retry identity", async () => {
    const stdout = io();
    const stderr = io();
    const commandId = "00000000-0000-4000-8000-000000000099";
    const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toContain("/api/agent-execution/workflow/transition");
      expect(JSON.parse(String(init?.body))).toEqual({
        commandId, actionId: "understanding-complete", expectedStateVersion: 1,
      });
      return Response.json({
        transition: { commandId, actionId: "understanding-complete", previousStageId: "understand", currentStageId: "implement", stateVersion: 2, replayed: false },
        current: {
          workflow: { id: "mystra.workflow", name: "Mystra Workflow" },
          state: { stageId: "implement", stateVersion: 2, terminal: false },
          stage: { name: "Implement", instructions: "Implement it." }, requiredSkills: [], materialization: { workspaceId: "00000000-0000-4000-8000-000000000007", generation: 2, entries: [], removals: [] }, availableActions: [],
          projection: { generation: 2, status: "ready", retryable: false },
        },
        skillChanges: { added: [], removed: [], retained: [] },
      });
    });
    expect(await runAgentCli({
      argv: ["workflow", "transition", "understanding-complete", "--expected-revision", "1", "--command-id", commandId, "--json"],
      env: { MYSTRA_CONTROL_PLANE_URL: "http://localhost:3000", MYSTRA_EXECUTION_CODE: "secret-code" },
      cwd: () => "/tmp/workspace", fetch: fetchMock as typeof fetch, stdout, stderr,
    })).toBe(0);
    expect(JSON.parse(stdout.read()).transition.commandId).toBe(commandId);
    expect(stderr.read()).toBe("");

    expect(await runAgentCli({
      argv: ["workflow", "current", "--task-id", execution.taskId],
      env: { MYSTRA_CONTROL_PLANE_URL: "http://localhost:3000", MYSTRA_EXECUTION_CODE: "secret-code" },
      cwd: () => "/tmp", fetch: vi.fn() as never, stdout: io(), stderr: io(),
    })).toBe(2);
  });

  it("maps fixed Workflow failures to stable exit classifications", async () => {
    const stderr = io();
    const exit = await runAgentCli({
      argv: ["workflow", "current", "--json"],
      env: { MYSTRA_CONTROL_PLANE_URL: "http://localhost:3000", MYSTRA_EXECUTION_CODE: "secret-code" },
      cwd: () => "/tmp", stdout: io(), stderr,
      fetch: (async () => Response.json({
        error: { code: "workflow_state_conflict", message: "State changed", retryable: false },
      }, { status: 409 })) as typeof fetch,
    });
    expect(exit).toBe(6);
    expect(JSON.parse(stderr.read()).error.code).toBe("workflow_state_conflict");
  });

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

    const projectedStdout = io();
    expect(await runAgentCli({
      argv: ["context", "get"],
      env: {
        MYSTRA_CONTROL_PLANE_URL: "http://localhost:3000",
        MYSTRA_EXECUTION_CODE: "secret-code",
        MYSTRA_WORKSPACE_ROOT: "/home/agentos/workspace",
      },
      cwd: () => "/host/task/workspace",
      fetch: fetchMock as typeof fetch,
      stdout: projectedStdout,
      stderr: io(),
    })).toBe(0);
    expect(JSON.parse(projectedStdout.read()).workspace.root).toBe("/home/agentos/workspace");
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
