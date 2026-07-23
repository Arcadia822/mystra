import { describe, expect, it, vi } from "vitest";

import { EXIT_CODES, parseArgs, run } from "../../../../scripts/operator-cli.mjs";

type ResponseLike = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function projectDetailPayload() {
  return {
    project: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Mystra",
      slug: "mystra",
      repo: "git@example.com:arcadia/mystra.git",
      baseBranch: "main",
      defaultAgent: "codex",
      runtime: {
        provider: "docker",
        image: "ghcr.io/arcadia/mystra-runner:latest",
        contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
        mounts: [],
        exposedPorts: [],
        cache: { coldStartAllowed: true, entries: [] },
        secretRefs: [],
        overridePolicy: {
          allowImageOverride: false,
          allowContextBundleAdditions: false,
          allowedContextBundleSlugs: [],
        },
        metadata: {},
      },
      prewarmConfig: { manager: "pnpm" },
      metadata: {},
      lane: {
        repo: "git@example.com:arcadia/mystra.git",
        baseBranch: "main",
        defaultAgent: "codex",
        runtime: {
          provider: "docker",
          image: "ghcr.io/arcadia/mystra-runner:latest",
          contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
          mounts: [],
          exposedPorts: [],
          cache: { coldStartAllowed: true, entries: [] },
          secretRefs: [],
          overridePolicy: {
            allowImageOverride: false,
            allowContextBundleAdditions: false,
            allowedContextBundleSlugs: [],
          },
          metadata: {},
        },
        contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
        prewarmConfig: { manager: "pnpm" },
        metadata: {},
      },
      archivedAt: null,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  };
}

function jobSnapshot(overrides: Record<string, unknown> = {}) {
  const base = {
    job: {
      id: "00000000-0000-4000-8000-000000000010",
      spec: {
        taskId: "TASK-1",
        source: "api",
        projectId: "00000000-0000-4000-8000-000000000001",
        branchName: "mystra/task-1",
        prompt: "Do the thing",
        metadata: {},
      },
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:01:00.000Z",
    },
    run: {
      id: "00000000-0000-4000-8000-000000000011",
      jobId: "00000000-0000-4000-8000-000000000010",
      state: "succeeded",
      attempt: 1,
      result: {
        status: "succeeded",
        summary: "Created the requested review",
        branch: "mystra/task-1",
        mrUrl: "https://example.com/mr/1",
        errorCode: undefined,
        errorMessage: undefined,
        metadata: {
          frontendPreviewUrl: "https://preview.example.com",
        },
      },
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:02:00.000Z",
      startedAt: "2026-05-17T00:00:10.000Z",
      finishedAt: "2026-05-17T00:02:00.000Z",
    },
    events: [],
    project: projectDetailPayload().project,
    lane: {
      projectId: "00000000-0000-4000-8000-000000000001",
      projectSlug: "mystra",
      repo: "git@example.com:arcadia/mystra.git",
      baseBranch: "main",
      defaultAgent: "codex",
      runtime: {
        environment: {
          provider: "docker",
          image: "ghcr.io/arcadia/mystra-runner:latest",
        },
        contextBundles: [],
        mounts: [],
        exposedPorts: [],
        cache: { entries: [] },
        secrets: [],
        metadata: {},
      },
      contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
      prewarmConfig: { manager: "pnpm" },
      metadata: {},
      submittedAt: "2026-05-17T00:00:00.000Z",
    },
    runtime: {
      environment: {
        provider: "docker",
        image: "ghcr.io/arcadia/mystra-runner:latest",
      },
      contextBundles: [],
      mounts: [],
      exposedPorts: [],
      cache: { entries: [] },
      secrets: [],
      metadata: {},
    },
  };

  return structuredClone({ ...base, ...overrides });
}

async function execute(
  argv: string[],
  responder: (url: string, init?: RequestInit) => ResponseLike | Promise<ResponseLike>,
  overrides: {
    sleep?: (milliseconds: number) => Promise<void>;
    now?: () => number;
  } = {},
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fetchImpl = vi.fn(async (url: URL | string, init?: RequestInit) => await responder(String(url), init));
  const exitCode = await run(argv, {
    fetchImpl,
    stdout: (text: string) => void stdout.push(text),
    stderr: (text: string) => void stderr.push(text),
    ...overrides,
  });

  return {
    exitCode,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
    fetchImpl,
  };
}

describe("operator CLI", () => {
  it("parses commands and shared flags", () => {
    expect(parseArgs(["--", "runs", "inspect", "job-123", "--json", "--control-plane-url", "http://localhost:4000"])).toEqual({
      ok: true,
      value: {
        group: "runs",
        command: "inspect",
        target: "job-123",
        json: true,
        controlPlaneUrl: "http://localhost:4000",
      },
    });
  });

  it("lists Issues through the canonical API with cursor pagination", async () => {
    const result = await execute(
      [
        "issues",
        "list",
        "--integration",
        "linear",
        "--limit",
        "10",
        "--cursor",
        "opaque cursor",
      ],
      async (url) => {
        expect(url).toBe(
          "http://localhost:3000/api/integrations/linear/issues?limit=10&cursor=opaque+cursor",
        );
        return response({
          items: [{
            reference: {
              integration: "linear",
              provider: "linear",
              externalId: "issue-id",
              identifier: "MYS-101",
              url: "https://linear.app/mystra/issue/MYS-101",
            },
            title: "Ship the demo",
            state: { id: "todo", name: "Todo" },
          }],
          pageInfo: { hasNextPage: true, endCursor: "next-cursor" },
        });
      },
    );

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("MYS-101 | Todo | Ship the demo");
    expect(result.stdout).toContain("nextCursor: next-cursor");
  });

  it("gets one Issue through the canonical API", async () => {
    const result = await execute(
      ["issues", "get", "MYS-101", "--integration", "linear", "--json"],
      async (url) => {
        expect(url).toBe("http://localhost:3000/api/integrations/linear/issues/MYS-101");
        return response({
          issue: {
            reference: {
              identifier: "MYS-101",
              url: "https://linear.app/mystra/issue/MYS-101",
            },
            title: "Ship the demo",
            description: "Complete the vertical slice.",
            state: { id: "todo", name: "Todo" },
          },
        });
      },
    );

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(JSON.parse(result.stdout).issue.reference.identifier).toBe("MYS-101");
  });

  it("resolves a Project slug then dispatches the Issue with an HTTP POST", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await execute(
      [
        "issues",
        "dispatch",
        "MYS-101",
        "--integration",
        "linear",
        "--project",
        "mystra-demo",
        "--agent",
        "copilot",
        "--branch",
        "codex/mys-101-demo",
        "--json",
      ],
      async (url, init) => {
        requests.push({ url, ...(init ? { init } : {}) });
        if (url.endsWith("/api/projects/mystra-demo")) {
          return response({ project: { id: "00000000-0000-4000-8000-000000000001" } });
        }
        return response(jobSnapshot({
          job: {
            ...jobSnapshot().job,
            spec: {
              ...jobSnapshot().job.spec,
              source: "issue",
              taskId: "MYS-101",
            },
          },
        }), 201);
      },
    );

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(requests.map((request) => request.url)).toEqual([
      "http://localhost:3000/api/projects/mystra-demo",
      "http://localhost:3000/api/integrations/linear/issues/MYS-101/dispatch",
    ]);
    expect(requests[1]?.init?.method).toBe("POST");
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
      projectId: "00000000-0000-4000-8000-000000000001",
      agent: "copilot",
      branchName: "codex/mys-101-demo",
    });
    expect(JSON.parse(result.stdout).job.spec.taskId).toBe("MYS-101");
  });

  it("maps structured Issue server errors and transport failures to stable exit codes", async () => {
    const missing = await execute(
      ["issues", "get", "MYS-404", "--integration", "linear"],
      async () => response({
        error: {
          code: "ISSUE_NOT_FOUND",
          message: "Issue not found: MYS-404",
        },
      }, 404),
    );
    const conflict = await execute(
      [
        "issues",
        "dispatch",
        "MYS-101",
        "--integration",
        "linear",
        "--project",
        "mystra-demo",
        "--agent",
        "copilot",
        "--branch",
        "codex/mys-101-demo",
      ],
      async (url) => url.endsWith("/api/projects/mystra-demo")
        ? response({ project: { id: "00000000-0000-4000-8000-000000000001" } })
        : response({
            error: {
              code: "DISPATCH_CONFLICT",
              message: "Issue dispatch already exists",
            },
          }, 409),
    );
    const transport = await execute(
      ["issues", "list", "--integration", "linear"],
      async () => {
        throw new Error("control plane unavailable");
      },
    );

    expect(missing.exitCode).toBe(EXIT_CODES.MISSING);
    expect(conflict.exitCode).toBe(EXIT_CODES.UNAVAILABLE);
    expect(transport.exitCode).toBe(EXIT_CODES.TRANSPORT_ERROR);
    expect(transport.stderr).toContain("control plane unavailable");
  });

  it("prints a human-readable project list", async () => {
    const result = await execute(["projects", "list"], async () => response({
      projects: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Mystra",
          slug: "mystra",
          repo: "git@example.com:arcadia/mystra.git",
          baseBranch: "main",
          defaultAgent: "codex",
          archivedAt: null,
          createdAt: "2026-05-17T00:00:00.000Z",
          updatedAt: "2026-05-17T00:00:00.000Z",
        },
      ],
    }));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("Projects");
    expect(result.stdout).toContain("mystra");
    expect(result.stderr).toBe("");
  });

  it("prints project detail as JSON when requested", async () => {
    const result = await execute(["projects", "inspect", "mystra", "--json"], async () => response(projectDetailPayload()));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(JSON.parse(result.stdout)).toEqual(projectDetailPayload());
  });

  it("prints a human-readable run list", async () => {
    const result = await execute(["runs", "list"], async () => response({
      jobs: [jobSnapshot()],
    }));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("Runs");
    expect(result.stdout).toContain("state=succeeded");
    expect(result.stdout).toContain("project=mystra");
    expect(result.stdout).toContain("updated=2026-05-17T00:02:00.000Z");
  });

  it("prints direct execution and context facts for run inspection", async () => {
    const result = await execute(["runs", "inspect", "job-1"], async () => response(jobSnapshot()));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("currentLaneContext: agent-skills");
    expect(result.stdout).toContain("submittedLaneContext: agent-skills");
    expect(result.stdout).not.toContain("workflow:");
  });

  it("waits for waiting_for_review and prints the complete handoff as success", async () => {
    const active = jobSnapshot({
      run: {
        ...jobSnapshot().run,
        state: "running",
        result: undefined,
        finishedAt: undefined,
      },
    });
    const ready = jobSnapshot({
      job: {
        ...jobSnapshot().job,
        spec: {
          ...jobSnapshot().job.spec,
          taskId: "MYS-101",
          source: "issue",
          issue: {
            reference: {
              identifier: "MYS-101",
              url: "https://linear.app/mystra/issue/MYS-101",
            },
          },
        },
      },
      run: {
        ...jobSnapshot().run,
        state: "waiting_for_review",
        result: {
          status: "waiting_for_review",
          summary: "Ready for review",
          branch: "codex/mys-101-demo",
          commitSha: "0123456789abcdef",
          issue: {
            identifier: "MYS-101",
            url: "https://linear.app/mystra/issue/MYS-101",
          },
          quality: {
            test: { status: "passed", command: "pnpm test", durationMs: 1000 },
            build: { status: "passed", command: "pnpm build", durationMs: 2000 },
          },
          preview: {
            url: "http://127.0.0.1:49152",
            containerName: "mystra-preview-mys-101",
            probeCount: 2,
          },
          reviewResult: {
            status: "review_created",
            branch: {
              status: "pushed",
              branchName: "codex/mys-101-demo",
              commitSha: "0123456789abcdef",
            },
            review: {
              provider: "github",
              url: "https://github.com/Arcadia822/mystra-demo/pull/1",
              number: 1,
              displayId: "#1",
            },
          },
          sandboxOutcome: {
            status: "succeeded",
            session: {
              provider: "docker",
              sessionId: "container-1",
              status: "retained",
              retained: true,
            },
          },
          agentExecution: {
            agent: "copilot",
            cliVersion: "1.0.69-0",
            mode: "autopilot",
            maxAutopilotContinues: 10,
            exitCode: 0,
            changedFiles: ["src/demo.ts"],
          },
        },
      },
      runtime: {
        environment: {
          provider: "docker",
          image: "mystra-copilot-runner:1.0.69-0",
        },
      },
    });
    let polls = 0;
    const result = await execute(
      [
        "runs",
        "wait",
        "job-1",
        "--interval-seconds",
        "1",
        "--timeout-seconds",
        "10",
      ],
      async (url) => {
        expect(url).toBe("http://localhost:3000/api/jobs/job-1");
        polls += 1;
        return response(polls === 1 ? active : ready);
      },
      { sleep: async () => {}, now: () => 0 },
    );

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(polls).toBe(2);
    expect(result.stdout).toContain("Waiting for review MYS-101");
    expect(result.stdout).toContain("test: passed | pnpm test");
    expect(result.stdout).toContain("build: passed | pnpm build");
    expect(result.stdout).toContain("preview: http://127.0.0.1:49152");
    expect(result.stdout).toContain("review: https://github.com/Arcadia822/mystra-demo/pull/1");
    expect(result.stdout).toContain("sandbox: docker | container-1 | retained");
    expect(result.stdout).toContain("agent: copilot 1.0.69-0 | autopilot | cap=10");
    expect(result.stderr).toBe("");
  });

  it("returns a local timeout while waiting for an active Run", async () => {
    const active = jobSnapshot({
      run: {
        ...jobSnapshot().run,
        state: "running",
        result: undefined,
        finishedAt: undefined,
      },
    });
    const times = [0, 1_001];
    const result = await execute(
      ["runs", "wait", "job-1", "--timeout-seconds", "1", "--json"],
      async () => response(active),
      { sleep: async () => {}, now: () => times.shift() ?? 1_001 },
    );

    expect(result.exitCode).toBe(EXIT_CODES.NOT_READY);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "WAIT_TIMEOUT",
      message: "Run did not reach a terminal state before the local timeout.",
      payload: {
        jobId: "job-1",
        timeoutSeconds: 1,
      },
    });
  });

  it("propagates server and transport errors while waiting", async () => {
    const missing = await execute(
      ["runs", "wait", "missing"],
      async () => response({
        error: {
          code: "JOB_NOT_FOUND",
          message: "Job not found: missing",
        },
      }, 404),
    );
    const transport = await execute(
      ["runs", "wait", "job-1"],
      async () => {
        throw new Error("socket closed");
      },
    );

    expect(missing.exitCode).toBe(EXIT_CODES.MISSING);
    expect(transport.exitCode).toBe(EXIT_CODES.TRANSPORT_ERROR);
  });

  it("prints a terminal result summary", async () => {
    const result = await execute(["runs", "result", "job-1"], async () => response(jobSnapshot()));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("Result 00000000-0000-4000-8000-000000000010");
    expect(result.stdout).toContain("Created the requested review");
    expect(result.stdout).toContain("https://example.com/mr/1");
  });

  it("returns RESULT_NOT_READY when the run is still active", async () => {
    const active = jobSnapshot({
      run: {
        ...jobSnapshot().run,
        state: "running",
        result: undefined,
        finishedAt: undefined,
      },
    });
    const result = await execute(["runs", "result", "job-1", "--json"], async () => response(active));

    expect(result.exitCode).toBe(EXIT_CODES.NOT_READY);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "RESULT_NOT_READY",
      message: "Run result is not ready yet.",
      payload: {
        jobId: "00000000-0000-4000-8000-000000000010",
        runState: "running",
      },
    });
  });

  it("prints failure context for failed runs", async () => {
    const failed = jobSnapshot({
      run: {
        ...jobSnapshot().run,
        state: "failed",
        result: {
          status: "failed",
          summary: "Tests failed",
          branch: "mystra/task-1",
          errorCode: "QUALITY_GATE_FAILED",
          errorMessage: "Vitest failed",
          metadata: {},
        },
      },
    });
    const result = await execute(["runs", "failure", "job-1"], async () => response(failed));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("Failure 00000000-0000-4000-8000-000000000010");
    expect(result.stdout).toContain("QUALITY_GATE_FAILED");
    expect(result.stdout).toContain("Vitest failed");
  });

  it("returns RESULT_NOT_READY when failure context is requested for an active run", async () => {
    const active = jobSnapshot({
      run: {
        ...jobSnapshot().run,
        state: "running",
        result: undefined,
        finishedAt: undefined,
      },
    });
    const result = await execute(["runs", "failure", "job-1", "--json"], async () => response(active));

    expect(result.exitCode).toBe(EXIT_CODES.NOT_READY);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "RESULT_NOT_READY",
      message: "Failure context is not ready yet.",
      payload: {
        jobId: "00000000-0000-4000-8000-000000000010",
        runState: "running",
      },
    });
  });

  it("returns RESULT_UNAVAILABLE when failure context is requested for a successful run", async () => {
    const result = await execute(["runs", "failure", "job-1", "--json"], async () => response(jobSnapshot()));

    expect(result.exitCode).toBe(EXIT_CODES.UNAVAILABLE);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "RESULT_UNAVAILABLE",
      message: "Failure context is unavailable for this run.",
      payload: {
        jobId: "00000000-0000-4000-8000-000000000010",
        runState: "succeeded",
      },
    });
  });

  it("maps management API errors to operator outcomes", async () => {
    const result = await execute(["runs", "inspect", "missing"], async () => response({
      error: {
        code: "JOB_NOT_FOUND",
        message: "Job not found: missing",
      },
    }, 404));

    expect(result.exitCode).toBe(EXIT_CODES.MISSING);
    expect(result.stderr).toContain("ERROR JOB_NOT_FOUND: Job not found: missing");
  });

  it("maps body-stream failures to a transport outcome instead of crashing", async () => {
    const result = await execute(["projects", "list", "--json"], async () => ({
      ok: true,
      status: 200,
      text: async () => {
        throw new Error("stream lost");
      },
    }));

    expect(result.exitCode).toBe(EXIT_CODES.TRANSPORT_ERROR);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "TRANSPORT_ERROR",
      message: "stream lost",
      payload: {
        url: "http://localhost:3000/api/projects",
      },
    });
  });
});
