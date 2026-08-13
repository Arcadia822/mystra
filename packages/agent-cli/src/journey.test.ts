import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it, vi } from "vitest";

import { runAgentCli } from "./cli.js";

const execute = promisify(execFile);
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

function output() {
  let value = "";
  return { write(chunk: string) { value += chunk; }, read: () => value };
}

describe("accepted local-tool journey", () => {
  it("uses fixture linctl and gh locally, then reports the unverified delivery through mystra-agent", async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "mystra-agent-journey-"));
    const linctl = path.join(fixtureRoot, "linctl");
    const gh = path.join(fixtureRoot, "gh");
    await writeFile(linctl, "#!/bin/sh\nprintf '{\"identifier\":\"%s\",\"title\":\"Fixture issue\"}\\n' \"$3\"\n", { mode: 0o755 });
    await writeFile(gh, "#!/bin/sh\nprintf '{\"url\":\"https://github.example.test/acme/repo/pull/7\"}\\n'\n", { mode: 0o755 });
    const requests: string[] = [];
    const fetchMock = vi.fn(async (request: URL | RequestInfo, init?: RequestInit) => {
      const url = String(request);
      requests.push(url);
      if (url.endsWith("/context")) {
        return Response.json({
          version: 1,
          execution: { teamId: id("1"), taskId: id("2"), harnessId: id("3"), sessionId: id("4"), agentContext: null, expiresAt: "2026-08-11T23:00:00.000Z" },
          task: { title: "Implement fixture", description: null, issue: { provider: "linear", connectionId: id("6"), scopeExternalId: "team", externalId: "issue-1", identifier: "ENG-1" } },
          project: { id: id("7"), repositoryConnectionId: id("8"), repositoryExternalId: "R_fixture", repositoryBaseBranch: "main" },
          workspace: { id: id("9"), branch: "eng-1" },
          capabilities: ["context:read", "task-status:read", "task-status:transition"],
        });
      }
      expect(JSON.parse(String(init?.body))).toEqual({
        status: "waiting_for_review",
        expectedRevision: 2,
        idempotencyKey: "delivery-1",
        note: "PR: https://github.example.test/acme/repo/pull/7; tests: fixture pass",
      });
      return Response.json({ taskId: id("2"), productionStatus: "waiting_for_review", statusRevision: 3, statusUpdatedAt: "2026-08-11T22:00:00.000Z", transitionId: id("10") });
    });
    const env = { MYSTRA_CONTROL_PLANE_URL: "http://control-plane.test", MYSTRA_EXECUTION_CODE: "execution-code" };

    try {
      const contextOut = output();
      expect(await runAgentCli({ argv: ["context", "get"], env, cwd: () => fixtureRoot, fetch: fetchMock as typeof fetch, stdout: contextOut, stderr: output() })).toBe(0);
      const context = JSON.parse(contextOut.read()) as { task: { issue: { identifier: string } } };
      const issue = JSON.parse((await execute(linctl, ["issue", "get", context.task.issue.identifier])).stdout) as { identifier: string };
      const delivery = JSON.parse((await execute(gh, ["pr", "create", "--fill"])).stdout) as { url: string };
      expect(issue.identifier).toBe("ENG-1");

      const statusOut = output();
      expect(await runAgentCli({
        argv: ["task", "status", "set", "waiting_for_review", "--expected-revision", "2", "--idempotency-key", "delivery-1", "--note", `PR: ${delivery.url}; tests: fixture pass`],
        env,
        cwd: () => fixtureRoot,
        fetch: fetchMock as typeof fetch,
        stdout: statusOut,
        stderr: output(),
      })).toBe(0);
      expect(JSON.parse(statusOut.read()).productionStatus).toBe("waiting_for_review");
      expect(requests).toEqual([
        "http://control-plane.test/api/agent-execution/context",
        "http://control-plane.test/api/agent-execution/task-status",
      ]);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
